import { createSign, randomUUID } from "crypto";
import { HttpError } from "@/server/errors";
import { prisma } from "@/lib/prisma";
import { MOBILE_APP_ID } from "@/lib/mobile";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

type TokenCache = { value: string; expiresAt: number };

const FCM_CACHE = Symbol.for("ofixio.fcm.token");
const APNS_CACHE = Symbol.for("ofixio.apns.jwt");

function bag() {
  return globalThis as typeof globalThis & {
    [FCM_CACHE]?: TokenCache | null;
    [APNS_CACHE]?: TokenCache | null;
  };
}

export function fcmConfigured() {
  return Boolean(readServiceAccount());
}

export function apnsConfigured() {
  return Boolean(process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && applePrivateKey());
}

export function pushDeliveryConfigured() {
  return fcmConfigured() || apnsConfigured();
}

function applePrivateKey() {
  const raw = process.env.APPLE_PRIVATE_KEY;
  if (!raw) return "";
  return raw.replace(/\\n/g, "\n").trim();
}

function readServiceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    return {
      project_id: parsed.project_id,
      client_email: parsed.client_email,
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

function b64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

async function fcmAccessToken(account: ServiceAccount) {
  const store = bag();
  const hit = store[FCM_CACHE];
  if (hit && hit.expiresAt > Date.now() + 30_000) return hit.value;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(account.private_key).toString("base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) return null;
  store[FCM_CACHE] = {
    value: body.access_token,
    expiresAt: Date.now() + Number(body.expires_in ?? 3600) * 1000,
  };
  return body.access_token;
}

function apnsJwt() {
  const store = bag();
  const hit = store[APNS_CACHE];
  if (hit && hit.expiresAt > Date.now() + 30_000) return hit.value;
  const key = applePrivateKey();
  const team = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  if (!key || !team || !keyId) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const payload = b64url(JSON.stringify({ iss: team, iat: now }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign("SHA256");
  signer.update(unsigned);
  const signature = signer.sign({ key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  const token = `${unsigned}.${signature}`;
  store[APNS_CACHE] = { value: token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return token;
}

async function sendFcm(token: string, title: string, body: string, href: string) {
  const account = readServiceAccount();
  if (!account) return "skipped" as const;
  const access = await fcmAccessToken(account);
  if (!access) return "failed" as const;
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "content-type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: { href },
      },
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 404 || response.status === 410) return "stale" as const;
  if (!response.ok) {
    const text = await response.text();
    if (/UNREGISTERED|NOT_FOUND/i.test(text)) return "stale" as const;
    return "failed" as const;
  }
  return "sent" as const;
}

async function sendApns(token: string, title: string, body: string, href: string) {
  const jwt = apnsJwt();
  if (!jwt) return "skipped" as const;
  const host = process.env.APNS_SANDBOX === "1" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  const response = await fetch(`${host}/3/device/${token}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": process.env.APPLE_BUNDLE_ID || MOBILE_APP_ID,
      "apns-push-type": "alert",
      "content-type": "application/json",
    },
    body: JSON.stringify({ aps: { alert: { title, body }, sound: "default" }, href }),
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 410 || response.status === 400) return "stale" as const;
  if (!response.ok) return "failed" as const;
  return "sent" as const;
}

export async function savePushDevice(userId: string, token: string, platform: string) {
  const clean = token.trim();
  if (clean.length < 8 || clean.length > 4096) throw new HttpError(400, "Ese token de avisos no sirve.");
  const kind = platform === "ios" ? "ios" : "android";
  await prisma.pushDevice.upsert({
    where: { token: clean },
    update: { userId, platform: kind },
    create: { id: randomUUID(), userId, token: clean, platform: kind },
  });
  return { ok: true, delivery: pushDeliveryConfigured() };
}

export async function removePushDevice(userId: string, token: string) {
  await prisma.pushDevice.deleteMany({ where: { userId, token: token.trim() } });
  return { ok: true };
}

export async function sendPush(userId: string, title: string, body: string, href: string) {
  if (!pushDeliveryConfigured()) return;
  try {
    const devices = await prisma.pushDevice.findMany({ where: { userId } });
    const stale: string[] = [];
    for (const device of devices) {
      const result =
        device.platform === "ios"
          ? await sendApns(device.token, title, body.slice(0, 180), href)
          : await sendFcm(device.token, title, body.slice(0, 180), href);
      if (result === "stale") stale.push(device.id);
    }
    if (stale.length > 0) await prisma.pushDevice.deleteMany({ where: { id: { in: stale } } });
  } catch {
    /* un push que falla no debe tumbar el aviso dentro de la app */
  }
}
