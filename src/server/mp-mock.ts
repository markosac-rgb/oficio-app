/**
 * Doble de la API de Mercado Pago. Solo corre con MP_MOCK=1 (las pruebas).
 * El SDK oficial sigue haciendo fetch a api.mercadopago.com; aquí se responde en memoria.
 */

type MockPreference = {
  id: string;
  externalReference: string;
  amount: number;
  marketplaceFee: number;
  backUrl: string;
};

type MockPayment = {
  id: number;
  status: string;
  status_detail: string;
  transaction_amount: number;
  currency_id: "MXN";
  payment_method_id: string;
  payment_type_id: string;
  external_reference: string;
  live_mode: false;
  point_of_interaction?: { transaction_data?: { ticket_url?: string } };
};

type Store = {
  seq: number;
  preferences: Map<string, MockPreference>;
  payments: Map<string, MockPayment>;
};

const STORE = Symbol.for("ofixio.mp.mock.store");

function store(): Store {
  const bag = globalThis as typeof globalThis & { [STORE]?: Store };
  if (!bag[STORE]) {
    bag[STORE] = { seq: 880000, preferences: new Map(), payments: new Map() };
  }
  return bag[STORE];
}

export function installMpMock() {
  if (process.env.MP_MOCK !== "1") return;
  const flag = Symbol.for("ofixio.mp.mock.fetch");
  const bag = globalThis as typeof globalThis & { [flag]?: boolean };
  if (bag[flag]) return;
  bag[flag] = true;
  const realFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.startsWith("https://api.mercadopago.com")) return realFetch(input, init);
    return mockResponse(url, init);
  };
}

function outcomeShape(outcome: string, amount: number, reference: string, id: number): MockPayment {
  if (outcome === "pending") {
    return {
      id,
      status: "pending",
      status_detail: "pending_waiting_payment",
      transaction_amount: amount,
      currency_id: "MXN",
      payment_method_id: "oxxo",
      payment_type_id: "ticket",
      external_reference: reference,
      live_mode: false,
      point_of_interaction: { transaction_data: { ticket_url: `https://www.mercadopago.com.mx/payments/${id}/ticket` } },
    };
  }
  if (outcome === "rejected") {
    return {
      id,
      status: "rejected",
      status_detail: "cc_rejected_other_reason",
      transaction_amount: amount,
      currency_id: "MXN",
      payment_method_id: "visa",
      payment_type_id: "credit_card",
      external_reference: reference,
      live_mode: false,
    };
  }
  if (outcome === "refunded") {
    return {
      id,
      status: "refunded",
      status_detail: "refunded",
      transaction_amount: amount,
      currency_id: "MXN",
      payment_method_id: "visa",
      payment_type_id: "credit_card",
      external_reference: reference,
      live_mode: false,
    };
  }
  return {
    id,
    status: "approved",
    status_detail: "accredited",
    transaction_amount: amount,
    currency_id: "MXN",
    payment_method_id: "visa",
    payment_type_id: "credit_card",
    external_reference: reference,
    live_mode: false,
  };
}

export function mockRecordOutcome(input: { preferenceId?: string; paymentId?: string; outcome: string }) {
  const bag = store();
  if (input.paymentId && bag.payments.has(input.paymentId)) {
    const current = bag.payments.get(input.paymentId)!;
    const next = outcomeShape(input.outcome, current.transaction_amount, current.external_reference, current.id);
    bag.payments.set(input.paymentId, next);
    return { paymentId: input.paymentId, redirect: "" };
  }
  const preference = input.preferenceId ? bag.preferences.get(input.preferenceId) : undefined;
  if (!preference) return null;
  const id = ++bag.seq;
  const payment = outcomeShape(input.outcome, preference.amount, preference.externalReference, id);
  bag.payments.set(String(id), payment);
  const back = new URL(preference.backUrl);
  back.searchParams.set("payment_id", String(id));
  back.searchParams.set("status", payment.status);
  return { paymentId: String(id), redirect: back.toString() };
}

async function mockResponse(url: string, init?: RequestInit) {
  const parsed = new URL(url);
  const path = parsed.pathname.replace(/\/$/, "");
  const method = (init?.method ?? "GET").toUpperCase();
  const bag = store();

  if (method === "POST" && path === "/checkout/preferences") {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      external_reference?: string;
      items?: { unit_price?: number }[];
      marketplace_fee?: number;
      back_urls?: { success?: string };
    };
    const id = `pref_mock_${++bag.seq}`;
    const amount = Number(body.items?.[0]?.unit_price ?? 0);
    const back = body.back_urls?.success || "http://127.0.0.1:43123/";
    const origin = new URL(back).origin;
    bag.preferences.set(id, {
      id,
      externalReference: body.external_reference || "",
      amount,
      marketplaceFee: Number(body.marketplace_fee ?? 0),
      backUrl: back,
    });
    const checkout = `${origin}/pago/mercadopago/prueba?preference_id=${id}`;
    return json(201, { id, init_point: checkout, sandbox_init_point: checkout, external_reference: body.external_reference });
  }

  const paymentMatch = path.match(/^\/v1\/payments\/([^/]+)$/);
  if (method === "GET" && paymentMatch) {
    const payment = bag.payments.get(paymentMatch[1]);
    if (!payment) return json(404, { message: "payment not found", status: 404 });
    return json(200, payment);
  }

  if (method === "POST" && path === "/oauth/token") {
    return json(200, {
      access_token: "TEST-seller-mock",
      refresh_token: "TEST-refresh-mock",
      public_key: "TEST-seller-public",
      user_id: 424242,
      expires_in: 15_552_000,
      live_mode: false,
      token_type: "bearer",
    });
  }

  return json(404, { message: `mock sin ruta ${method} ${path}`, status: 404 });
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
