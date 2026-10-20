import { createHmac, timingSafeEqual } from "crypto";
import { MercadoPagoConfig, OAuth, Payment, Preference } from "mercadopago";
import { installMpMock } from "@/server/mp-mock";

installMpMock();

export function mpConfigured() {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

const TEST_MODE_CACHE = Symbol.for("ofixio.mp.testmode.cache");

type TestModeCache = { token: string; testUser: boolean; expiresAt: number };

function testModeCache() {
  return globalThis as typeof globalThis & { [TEST_MODE_CACHE]?: TestModeCache | null };
}

export function clearMpTestModeCache() {
  testModeCache()[TEST_MODE_CACHE] = null;
}

/** `1` fuerza el modo de prueba, `0` lo apaga. Vacío o ausente no decide. */
function forcedTestMode(): boolean | null {
  const raw = process.env.MP_TEST_MODE;
  if (raw == null || raw.trim() === "") return null;
  if (raw.trim() === "1") return true;
  if (raw.trim() === "0") return false;
  return null;
}

async function accountHasTestUserTag(token: string) {
  const bag = testModeCache();
  const hit = bag[TEST_MODE_CACHE];
  if (hit && hit.token === token && hit.expiresAt > Date.now()) return hit.testUser;
  const remember = (testUser: boolean, ttlMs: number) => {
    bag[TEST_MODE_CACHE] = { token, testUser, expiresAt: Date.now() + ttlMs };
    return testUser;
  };
  try {
    const response = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return remember(false, 60_000);
    const body = (await response.json()) as { tags?: unknown };
    const tags = Array.isArray(body.tags) ? body.tags : [];
    return remember(tags.some((tag) => String(tag) === "test_user"), 15 * 60_000);
  } catch {
    return remember(false, 60_000);
  }
}

export async function mpTestMode() {
  const forced = forcedTestMode();
  if (forced != null) return forced;
  const token = process.env.MP_ACCESS_TOKEN ?? "";
  if (token.startsWith("TEST-")) return true;
  if (!token) return false;
  return accountHasTestUserTag(token);
}

export function mpOAuthConfigured() {
  return Boolean(process.env.MP_CLIENT_ID && process.env.MP_CLIENT_SECRET);
}

export function publicBaseUrl(fallbackOrigin: string) {
  return (process.env.OFICIO_PUBLIC_URL || fallbackOrigin).replace(/\/$/, "");
}

function config(accessToken: string) {
  return new MercadoPagoConfig({ accessToken, options: { timeout: 12_000 } });
}

export type RemotePayment = {
  id: string;
  status: "pending" | "approved" | "rejected" | "refunded";
  statusDetail: string;
  amountMxn: number;
  method: "CARD" | "OXXO" | "SPEI" | "MP";
  methodDetail: string;
  externalReference: string;
  liveMode: boolean;
  ticketUrl: string;
};

export function mapPaymentStatus(status: string | undefined, statusDetail: string | undefined): RemotePayment["status"] {
  const detail = (statusDetail ?? "").toLowerCase();
  if (status === "refunded" || status === "charged_back" || detail.includes("refund")) return "refunded";
  if (status === "approved" || status === "authorized") return "approved";
  if (status === "rejected" || status === "cancelled") return "rejected";
  return "pending";
}

function methodOf(paymentType: string | undefined, paymentMethod: string | undefined): RemotePayment["method"] {
  const type = paymentType ?? "";
  const method = paymentMethod ?? "";
  if (type === "ticket" || method === "oxxo") return "OXXO";
  if (type === "bank_transfer" || method === "clabe" || method === "spei") return "SPEI";
  if (type === "credit_card" || type === "debit_card" || type === "prepaid_card") return "CARD";
  return "MP";
}

export async function createCheckoutPreference(input: {
  accessToken: string;
  requestId: string;
  title: string;
  amountMxn: number;
  marketplaceFeeMxn: number | null;
  origin: string;
  payerEmail?: string;
}) {
  const preference = new Preference(config(input.accessToken));
  const base = publicBaseUrl(input.origin);
  const back = `${base}/solicitudes/${input.requestId}/pago`;
  const created = await preference.create({
    body: {
      items: [
        {
          id: input.requestId,
          title: input.title.slice(0, 120) || "Servicio Ofixio",
          quantity: 1,
          unit_price: input.amountMxn,
          currency_id: "MXN",
        },
      ],
      external_reference: input.requestId,
      notification_url: `${base}/api/payments/mercadopago/webhook`,
      back_urls: { success: back, failure: back, pending: back },
      auto_return: "approved",
      statement_descriptor: "OFIXIO",
      binary_mode: false,
      metadata: { request_id: input.requestId },
      ...(input.payerEmail ? { payer: { email: input.payerEmail } } : {}),
      ...(input.marketplaceFeeMxn != null && input.marketplaceFeeMxn > 0 ? { marketplace_fee: input.marketplaceFeeMxn } : {}),
    },
  });
  const test = await mpTestMode();
  const url = (test && created.sandbox_init_point) || created.init_point;
  if (!created.id || !url) throw new Error("Mercado Pago no devolvió el checkout.");
  return { preferenceId: created.id, url };
}

export async function fetchRemotePayment(paymentId: string, accessToken: string): Promise<RemotePayment> {
  const payment = new Payment(config(accessToken));
  const remote = await payment.get({ id: paymentId });
  const amount = Number(remote.transaction_amount);
  if (!Number.isFinite(amount)) throw new Error("Mercado Pago no devolvió el monto.");
  const ticket = remote.point_of_interaction?.transaction_data?.ticket_url ?? "";
  return {
    id: String(remote.id ?? paymentId),
    status: mapPaymentStatus(remote.status, remote.status_detail),
    statusDetail: remote.status_detail ?? "",
    amountMxn: Math.round(amount),
    method: methodOf(remote.payment_type_id, remote.payment_method_id),
    methodDetail: remote.payment_method_id ?? remote.payment_type_id ?? "",
    externalReference: remote.external_reference ?? "",
    liveMode: Boolean(remote.live_mode),
    ticketUrl: ticket,
  };
}

export function verifyWebhookSignature(headers: Headers, searchParams: URLSearchParams) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;
  const signature = headers.get("x-signature");
  const requestId = headers.get("x-request-id");
  if (!signature || !requestId) return false;
  let ts = "";
  let v1 = "";
  for (const part of signature.split(",")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "ts") ts = value;
    if (key === "v1") v1 = value;
  }
  if (!ts || !v1) return false;
  const rawId = searchParams.get("data.id");
  const dataId = rawId && /[a-z]/i.test(rawId) ? rawId.toLowerCase() : rawId;
  const pieces = [];
  if (dataId) pieces.push(`id:${dataId}`);
  pieces.push(`request-id:${requestId}`, `ts:${ts}`);
  const manifest = `${pieces.join(";")};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(v1);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function webhookPaymentId(searchParams: URLSearchParams, body: Record<string, unknown>) {
  const fromQuery = searchParams.get("data.id") || searchParams.get("id");
  const data = body.data;
  const fromBody =
    data && typeof data === "object" && "id" in data && data.id != null ? String((data as { id: unknown }).id) : "";
  const id = (fromQuery || fromBody || "").trim();
  return id;
}

export function authorizationUrl(state: string, redirectUri: string) {
  const oauth = new OAuth(config(process.env.MP_ACCESS_TOKEN || "oauth"));
  return oauth.getAuthorizationURL({
    options: {
      client_id: process.env.MP_CLIENT_ID,
      state,
      redirect_uri: redirectUri,
    },
  });
}

export async function exchangeAuthorizationCode(code: string, redirectUri: string) {
  const oauth = new OAuth(config(process.env.MP_CLIENT_SECRET || "oauth"));
  return oauth.create({
    body: {
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    },
  });
}

export async function refreshSellerToken(refreshToken: string) {
  const oauth = new OAuth(config(process.env.MP_CLIENT_SECRET || "oauth"));
  return oauth.refresh({
    body: {
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      refresh_token: refreshToken,
    },
  });
}
