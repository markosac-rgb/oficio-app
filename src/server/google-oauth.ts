import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { establishGoogleUser, sessionCookieHeader } from "@/server/auth";

const STATE_COOKIE = "oficio_oauth";

export function googleOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function publicOrigin(request: NextRequest) {
  const configured = process.env.OFICIO_PUBLIC_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || "localhost";
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

function redirectUri(request: NextRequest) {
  return `${publicOrigin(request)}/api/auth/google/callback`;
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

export function beginGoogleOAuth(request: NextRequest) {
  const role = request.nextUrl.searchParams.get("role") === "PROVIDER" ? "PROVIDER" : "CLIENT";
  const back = new URL("/entrar", publicOrigin(request));
  if (request.nextUrl.searchParams.get("acepto") !== "1") {
    back.searchParams.set("error", "Acepta los términos y el aviso de privacidad para continuar con Google.");
    return NextResponse.redirect(back);
  }
  if (!googleOAuthConfigured()) {
    back.searchParams.set("error", "Google no está conectado. El botón de demostración sigue disponible.");
    return NextResponse.redirect(back);
  }
  const secondary = request.nextUrl.searchParams.get("secundarias") === "1" ? "1" : "0";
  const state = randomBytes(16).toString("hex");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID || "");
  url.searchParams.set("redirect_uri", redirectUri(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, `${state}.${role}.${secondary}`, cookieOptions());
  return response;
}

export async function finishGoogleOAuth(request: NextRequest) {
  const origin = publicOrigin(request);
  const fail = (message: string) => {
    const url = new URL("/entrar", origin);
    url.searchParams.set("error", message);
    const response = NextResponse.redirect(url);
    response.cookies.set(STATE_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
    return response;
  };

  if (!googleOAuthConfigured()) return fail("Google no está conectado en este servidor.");
  const error = request.nextUrl.searchParams.get("error");
  if (error) return fail("Cancelaste el acceso con Google o Google no lo permitió.");

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const stored = request.cookies.get(STATE_COOKIE)?.value || "";
  const [savedState, savedRole, savedSecondary] = stored.split(".");
  const role = savedRole === "PROVIDER" ? "PROVIDER" : "CLIENT";
  if (!code || !state || !savedState || state !== savedState) {
    return fail("La entrada con Google no coincidió. Intenta de nuevo.");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: redirectUri(request),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) return fail("Google no entregó el acceso. Revisa la URL de retorno.");
  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) return fail("Google no entregó el acceso.");

  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!profileResponse.ok) return fail("No pudimos leer tu cuenta de Google.");
  const profile = (await profileResponse.json()) as { email?: string; email_verified?: boolean; name?: string };
  if (!profile.email || profile.email_verified === false) {
    return fail("Google no confirmó el correo de esa cuenta.");
  }

  let session: { name: string; value: string; options: Parameters<typeof NextResponse.prototype.cookies.set>[2] };
  try {
    const { token } = await establishGoogleUser({
      email: profile.email,
      name: profile.name || profile.email.split("@")[0] || "Cuenta Google",
      role,
      simulated: false,
      legalAccepted: true,
      secondary: savedSecondary === "1",
    });
    const cookie = sessionCookieHeader(token);
    session = { name: cookie.name, value: cookie.value, options: cookie.options };
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "No se pudo entrar con Google.";
    return fail(message);
  }

  const response = NextResponse.redirect(new URL("/inicio", origin));
  response.cookies.set(session.name, session.value, session.options);
  response.cookies.set(STATE_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  return response;
}
