import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/server/auth";
import { publicOrigin } from "@/server/google-oauth";
import { authorizationUrl, exchangeAuthorizationCode, mpOAuthConfigured, publicBaseUrl } from "@/server/mercadopago";

const STATE_COOKIE = "oficio_mp_oauth";

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  };
}

function redirectUri(request: NextRequest) {
  return `${publicBaseUrl(publicOrigin(request))}/api/provider/mercadopago/callback`;
}

export async function beginMercadoPagoConnect(request: NextRequest) {
  const origin = publicBaseUrl(publicOrigin(request));
  const back = new URL("/panel", origin);
  const user = await getCurrentUser();
  if (!user?.providerProfile) {
    back.searchParams.set("mp", "error");
    return NextResponse.redirect(back);
  }
  if (!mpOAuthConfigured()) {
    back.searchParams.set("mp", "apagado");
    return NextResponse.redirect(back);
  }
  const state = randomBytes(16).toString("hex");
  const response = NextResponse.redirect(authorizationUrl(state, redirectUri(request)));
  response.cookies.set(STATE_COOKIE, `${state}.${user.providerProfile.id}`, cookieOptions());
  return response;
}

export async function finishMercadoPagoConnect(request: NextRequest) {
  const origin = publicBaseUrl(publicOrigin(request));
  const back = new URL("/panel", origin);
  const done = (code: string) => {
    back.searchParams.set("mp", code);
    const response = NextResponse.redirect(back);
    response.cookies.set(STATE_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
    return response;
  };
  if (!mpOAuthConfigured()) return done("apagado");
  if (request.nextUrl.searchParams.get("error")) return done("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const stored = request.cookies.get(STATE_COOKIE)?.value || "";
  const [savedState, providerId] = stored.split(".");
  const user = await getCurrentUser();
  if (!code || !state || !savedState || state !== savedState || !providerId || user?.providerProfile?.id !== providerId) {
    return done("error");
  }
  try {
    const tokens = await exchangeAuthorizationCode(code, redirectUri(request));
    if (!tokens.access_token || !tokens.user_id) return done("error");
    const expires = new Date(Date.now() + Number(tokens.expires_in ?? 15_552_000) * 1000);
    await prisma.providerProfile.update({
      where: { id: providerId },
      data: {
        mpUserId: String(tokens.user_id),
        mpAccessToken: tokens.access_token,
        mpRefreshToken: tokens.refresh_token || "",
        mpPublicKey: tokens.public_key || "",
        mpTokenExpiresAt: expires,
      },
    });
    return done("conectado");
  } catch {
    return done("error");
  }
}
