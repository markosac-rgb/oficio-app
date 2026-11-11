import { createSign, randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { establishAppleUser, sessionCookieHeader, toAccount } from "@/server/auth";
import { HttpError, asText } from "@/server/errors";
import { publicOrigin } from "@/server/google-oauth";
import { MOBILE_APP_ID } from "@/lib/mobile";
import { cookies } from "next/headers";

const STATE_COOKIE = "oficio_apple_oauth";

type AppleKey = JsonWebKey & { kid?: string };

type AppleIdentity = {
  sub: string;
  email: string;
};

const KEY_CACHE = Symbol.for("ofixio.apple.jwks");

function keyBag() {
  return globalThis as typeof globalThis & { [KEY_CACHE]?: { at: number; keys: AppleKey[] } };
}

export function appleAuthConfigured() {
  return Boolean(
    process.env.APPLE_CLIENT_ID &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_KEY_ID &&
      applePrivateKey(),
  );
}

function applePrivateKey() {
  const raw = process.env.APPLE_PRIVATE_KEY;
  if (!raw) return "";
  return raw.replace(/\\n/g, "\n").trim();
}

function b64urlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodePart(part: string) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
}

export function appleClientSecret() {
  const key = applePrivateKey();
  const team = process.env.APPLE_TEAM_ID || "";
  const keyId = process.env.APPLE_KEY_ID || "";
  const clientId = process.env.APPLE_CLIENT_ID || "";
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlJson({ alg: "ES256", kid: keyId });
  const payload = b64urlJson({
    iss: team,
    iat: now,
    exp: now + 60 * 60 * 24 * 150,
    aud: "https://appleid.apple.com",
    sub: clientId,
  });
  const unsigned = `${header}.${payload}`;
  const signer = createSign("SHA256");
  signer.update(unsigned);
  return `${unsigned}.${signer.sign({ key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}

async function appleKeys() {
  const bag = keyBag();
  const hit = bag[KEY_CACHE];
  if (hit && Date.now() - hit.at < 60 * 60 * 1000) return hit.keys;
  const response = await fetch("https://appleid.apple.com/auth/keys", { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("No se pudieron leer las llaves de Apple.");
  const body = (await response.json()) as { keys?: AppleKey[] };
  const keys = body.keys ?? [];
  bag[KEY_CACHE] = { at: Date.now(), keys };
  return keys;
}

export async function verifyAppleIdentityToken(token: string): Promise<AppleIdentity> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("El token de Apple no tiene el formato esperado.");
  const header = decodePart(parts[0]);
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("El token de Apple no es RS256.");
  const keys = await appleKeys();
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("Apple no publicó la llave de ese token.");
  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = Buffer.from(parts[2], "base64url");
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, signature, data);
  if (!valid) throw new Error("La firma del token de Apple no coincide.");
  const payload = decodePart(parts[1]);
  const now = Math.floor(Date.now() / 1000);
  const exp = Number(payload.exp);
  if (!Number.isFinite(exp) || exp < now) throw new Error("El token de Apple ya venció.");
  if (payload.iss !== "https://appleid.apple.com") throw new Error("El token no viene de Apple.");
  const audiences = Array.isArray(payload.aud) ? payload.aud.map(String) : [String(payload.aud ?? "")];
  const allowed = [process.env.APPLE_CLIENT_ID, process.env.APPLE_BUNDLE_ID || MOBILE_APP_ID].filter(Boolean);
  if (!audiences.some((aud) => allowed.includes(aud))) throw new Error("El token de Apple es de otra app.");
  const sub = String(payload.sub ?? "");
  if (!sub) throw new Error("Apple no mandó el identificador de la cuenta.");
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  return { sub, email };
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  };
}

export async function loginWithAppleIdentity(input: Record<string, unknown>) {
  if (!appleAuthConfigured()) throw new HttpError(400, "Iniciar sesión con Apple no está activado en este servidor.");
  let identity: AppleIdentity;
  try {
    identity = await verifyAppleIdentityToken(requiredToken(input.identityToken));
  } catch (reason) {
    throw new HttpError(400, reason instanceof Error ? reason.message : "No pudimos comprobar el token de Apple.");
  }
  const name = [asText(input.givenName), asText(input.familyName), asText(input.name)].filter(Boolean).join(" ");
  const role = input.role === "PROVIDER" ? "PROVIDER" : "CLIENT";
  const { user, token } = await establishAppleUser({
    sub: identity.sub,
    email: identity.email || asText(input.email).toLowerCase(),
    name,
    role,
    legalAccepted: input.acceptedRules === true,
    secondary: input.acceptedSecondaryPurposes === true,
  });
  const jar = await cookies();
  const cookie = sessionCookieHeader(token);
  jar.set(cookie.name, cookie.value, cookie.options);
  return { user: toAccount(user) };
}

function requiredToken(value: unknown) {
  const token = asText(value);
  if (token.split(".").length !== 3) throw new HttpError(400, "Falta el token de Apple.");
  return token;
}

export function beginAppleOAuth(request: NextRequest) {
  const origin = publicOrigin(request);
  const back = new URL("/entrar", origin);
  if (!appleAuthConfigured()) {
    back.searchParams.set("error", "Iniciar sesión con Apple no está activado en este servidor.");
    return NextResponse.redirect(back);
  }
  if (request.nextUrl.searchParams.get("acepto") !== "1") {
    back.searchParams.set("error", "Acepta los términos y el aviso de privacidad para continuar con Apple.");
    return NextResponse.redirect(back);
  }
  const role = request.nextUrl.searchParams.get("role") === "PROVIDER" ? "PROVIDER" : "CLIENT";
  const secondary = request.nextUrl.searchParams.get("secundarias") === "1" ? "1" : "0";
  const state = randomBytes(16).toString("hex");
  const url = new URL("https://appleid.apple.com/auth/authorize");
  url.searchParams.set("client_id", process.env.APPLE_CLIENT_ID || "");
  url.searchParams.set("redirect_uri", `${origin}/api/auth/apple/callback`);
  url.searchParams.set("response_type", "code id_token");
  url.searchParams.set("response_mode", "form_post");
  url.searchParams.set("scope", "name email");
  url.searchParams.set("state", state);
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, `${state}.${role}.${secondary}`, cookieOptions());
  return response;
}

export async function finishAppleOAuth(request: NextRequest) {
  const origin = publicOrigin(request);
  const fail = (message: string) => {
    const url = new URL("/entrar", origin);
    url.searchParams.set("error", message);
    const response = NextResponse.redirect(url);
    response.cookies.set(STATE_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
    return response;
  };
  if (!appleAuthConfigured()) return fail("Iniciar sesión con Apple no está activado en este servidor.");
  const form = await request.formData();
  const error = String(form.get("error") || "");
  if (error) return fail("Cancelaste el acceso con Apple o Apple no lo permitió.");
  const idToken = String(form.get("id_token") || "");
  const state = String(form.get("state") || "");
  const stored = request.cookies.get(STATE_COOKIE)?.value || "";
  const [savedState, savedRole, savedSecondary] = stored.split(".");
  if (!idToken || !state || !savedState || state !== savedState) return fail("La entrada con Apple no coincidió. Intenta de nuevo.");
  let identity: AppleIdentity;
  try {
    identity = await verifyAppleIdentityToken(idToken);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "No pudimos comprobar el token de Apple.";
    return fail(message);
  }
  const userField = String(form.get("user") || "");
  let name = "";
  if (userField) {
    try {
      const parsed = JSON.parse(userField) as { name?: { firstName?: string; lastName?: string } };
      name = [parsed.name?.firstName, parsed.name?.lastName].filter(Boolean).join(" ");
    } catch {
      name = "";
    }
  }
  const role = savedRole === "PROVIDER" ? "PROVIDER" : "CLIENT";
  try {
    const { token } = await establishAppleUser({
      sub: identity.sub,
      email: identity.email,
      name,
      role,
      legalAccepted: true,
      secondary: savedSecondary === "1",
    });
    const response = NextResponse.redirect(new URL("/inicio", origin));
    const cookie = sessionCookieHeader(token);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    response.cookies.set(STATE_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
    return response;
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "No se pudo abrir la sesión con Apple.";
    return fail(message);
  }
}
