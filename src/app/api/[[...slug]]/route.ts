import type { NextRequest } from "next/server";
import {
  changePassword,
  clearSession,
  getCurrentUser,
  loginWithGoogle,
  loginWithPassword,
  registerAccount,
  startOtp,
  toAccount,
  updateAccount,
  verifyOtp,
} from "@/server/auth";
import {
  addDocument,
  addReview,
  addWorkPhoto,
  adminDemoSettings,
  adminPayments,
  adminReports,
  adminSetChecks,
  adminSetDemoData,
  adminSetSuspended,
  adminSummary,
  adminUpdateReport,
  adminUsers,
  advanceStatus,
  cancelRequest,
  createReport,
  createRequest,
  decideQuote,
  deleteService,
  demoPostalCodes,
  searchPlaces,
  getHome,
  getProvider,
  getRequest,
  helpContent,
  listFavorites,
  listMessages,
  listNotifications,
  listRequests,
  listThreads,
  lookupPostalCode,
  markNotificationsRead,
  postMessage,
  providerDashboard,
  recordPayment,
  syncPaymentReturn,
  saveSchedule,
  saveService,
  scheduleRequest,
  searchProviders,
  sendQuote,
  setAvailability,
  toggleFavorite,
  updateClientLocation,
  updateProviderProfile,
} from "@/server/domain";
import { beginGoogleOAuth, finishGoogleOAuth, googleOAuthConfigured, publicOrigin } from "@/server/google-oauth";
import { beginMercadoPagoConnect, finishMercadoPagoConnect } from "@/server/mp-oauth";
import { HttpError } from "@/server/errors";
import { prisma } from "@/lib/prisma";

async function readJson(request: NextRequest) {
  const text = await request.text();
  if (!text) return {} as Record<string, unknown>;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "No entendimos los datos enviados.");
  }
}

function num(value: string | null) {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function dispatch(method: string, request: NextRequest, slug: string[]) {
  const path = slug.map((part) => decodeURIComponent(part)).join("/");
  const url = request.nextUrl;

  if (method === "GET" && path === "health") {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, service: "oficio" };
  }
  if (method === "GET" && path === "help") return helpContent();
  if (method === "GET" && path === "geo/codigos") return demoPostalCodes();
  if (method === "GET" && path === "geo/cp") return lookupPostalCode(url.searchParams.get("cp") ?? "");
  if (method === "GET" && path === "geo/buscar") return searchPlaces(url.searchParams.get("q") ?? "");
  if (method === "GET" && path === "auth/google/status") return { configured: googleOAuthConfigured() };

  if (method === "POST" && path === "auth/register") return registerAccount(await readJson(request));
  if (method === "POST" && path === "auth/login") return loginWithPassword(await readJson(request));
  if (method === "POST" && path === "auth/logout") {
    await clearSession();
    return { ok: true };
  }
  if (method === "GET" && path === "auth/me") {
    const current = await getCurrentUser();
    return { user: current ? toAccount(current) : null };
  }
  if (method === "POST" && path === "auth/otp/start") return startOtp(await readJson(request));
  if (method === "POST" && path === "auth/otp/verify") return verifyOtp(await readJson(request));
  if (method === "POST" && path === "auth/google") return loginWithGoogle(await readJson(request));

  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Inicia sesión para continuar.");

  if (method === "PATCH" && path === "me") return updateAccount(user, await readJson(request));
  if (method === "PATCH" && path === "me/location") return updateClientLocation(user, await readJson(request));
  if (method === "PATCH" && path === "me/password") return changePassword(user, await readJson(request));
  if (method === "GET" && path === "home") return getHome(user);
  if (method === "GET" && path === "favorites") return listFavorites(user);
  if (method === "GET" && path === "providers") {
    return searchProviders(user, {
      q: url.searchParams.get("q") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      maxKm: num(url.searchParams.get("maxKm")),
      maxPrice: num(url.searchParams.get("maxPrice")),
      minRating: num(url.searchParams.get("minRating")),
      available: url.searchParams.get("available") === "1",
      emergency: url.searchParams.get("emergency") === "1",
      sort: (url.searchParams.get("sort") as "distance" | "price" | "rating" | null) ?? undefined,
      ids: url.searchParams.get("ids")?.split(",").map((item) => item.trim()).filter(Boolean),
    });
  }

  const providerMatch = path.match(/^providers\/([^/]+)$/);
  if (method === "GET" && providerMatch) return getProvider(user, providerMatch[1]);

  const favoriteMatch = path.match(/^favorites\/([^/]+)$/);
  if (favoriteMatch && (method === "POST" || method === "DELETE")) {
    return toggleFavorite(user, favoriteMatch[1]);
  }

  if (method === "GET" && path === "requests") return { requests: await listRequests(user) };
  if (method === "POST" && path === "requests") return createRequest(user, await readJson(request));

  const requestMatch = path.match(/^requests\/([^/]+)$/);
  if (method === "GET" && requestMatch) return getRequest(user, requestMatch[1]);

  const actionMatch = path.match(/^requests\/([^/]+)\/(cancel|schedule|payment|status|review|messages|quotes)$/);
  if (actionMatch) {
    const [, id, action] = actionMatch;
    if (method === "POST" && action === "cancel") return cancelRequest(user, id, await readJson(request));
    if (method === "POST" && action === "schedule") return scheduleRequest(user, id, await readJson(request));
    if (method === "POST" && action === "payment") return recordPayment(user, id, await readJson(request), publicOrigin(request));
    if (method === "POST" && action === "status") return advanceStatus(user, id);
    if (method === "POST" && action === "review") return addReview(user, id, await readJson(request));
    if (method === "GET" && action === "messages") return listMessages(user, id);
    if (method === "POST" && action === "messages") return postMessage(user, id, await readJson(request));
    if (method === "POST" && action === "quotes") return sendQuote(user, id, await readJson(request));
  }

  const paymentSync = path.match(/^requests\/([^/]+)\/payment\/sync$/);
  if (method === "POST" && paymentSync) return syncPaymentReturn(user, paymentSync[1], await readJson(request));

  const quoteMatch = path.match(/^quotes\/([^/]+)\/(accept|reject)$/);
  if (method === "POST" && quoteMatch) {
    return decideQuote(user, quoteMatch[1], quoteMatch[2] === "accept");
  }

  if (method === "GET" && path === "threads") return { threads: await listThreads(user) };
  if (method === "GET" && path === "notifications") return listNotifications(user);
  if (method === "POST" && path === "notifications/read") return markNotificationsRead(user);
  if (method === "POST" && path === "reports") return createReport(user, await readJson(request));

  if (method === "GET" && path === "provider/dashboard") return providerDashboard(user);
  if (method === "PATCH" && path === "provider/profile") return updateProviderProfile(user, await readJson(request));
  if (method === "PATCH" && path === "provider/availability") return setAvailability(user, await readJson(request));
  if (method === "PUT" && path === "provider/schedule") return saveSchedule(user, await readJson(request));
  if (method === "POST" && path === "provider/services") return saveService(user, await readJson(request));
  if (method === "POST" && path === "provider/photos") return addWorkPhoto(user, await readJson(request));
  if (method === "POST" && path === "provider/documents") return addDocument(user, await readJson(request));

  const serviceMatch = path.match(/^provider\/services\/([^/]+)$/);
  if (serviceMatch && method === "PATCH") return saveService(user, await readJson(request), serviceMatch[1]);
  if (serviceMatch && method === "DELETE") return deleteService(user, serviceMatch[1]);

  if (method === "GET" && path === "admin/summary") return adminSummary(user);
  if (method === "GET" && path === "admin/payments") return adminPayments(user);
  if (method === "GET" && path === "admin/settings") return adminDemoSettings(user);
  if (method === "POST" && path === "admin/settings") {
    const body = await readJson(request);
    return adminSetDemoData(user, body.demoData !== false);
  }
  if (method === "GET" && path === "admin/users") return { users: await adminUsers(user) };
  if (method === "GET" && path === "admin/requests") return { requests: await listRequests(user) };
  if (method === "GET" && path === "admin/reports") return { reports: await adminReports(user) };

  const adminUserMatch = path.match(/^admin\/users\/([^/]+)$/);
  if (method === "PATCH" && adminUserMatch) {
    const body = await readJson(request);
    return adminSetSuspended(user, adminUserMatch[1], body.suspended === true);
  }
  const checksMatch = path.match(/^admin\/providers\/([^/]+)\/checks$/);
  if (method === "POST" && checksMatch) return adminSetChecks(user, checksMatch[1], await readJson(request));
  const reportMatch = path.match(/^admin\/reports\/([^/]+)$/);
  if (method === "PATCH" && reportMatch) return adminUpdateReport(user, reportMatch[1], await readJson(request));

  throw new HttpError(404, "No encontramos esa acción.");
}

type ApiContext = { params: Promise<{ slug?: string[] }> };

async function handle(method: string, request: NextRequest, context: ApiContext) {
  try {
    const { slug } = await context.params;
    const result = await dispatch(method, request, slug ?? []);
    return Response.json(result ?? { ok: true });
  } catch (error) {
    if (error instanceof HttpError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json({ error: "Tuvimos un problema. Intenta de nuevo." }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: ApiContext) {
  const { slug } = await context.params;
  const path = (slug ?? []).join("/");
  if (path === "auth/google/start") return beginGoogleOAuth(request);
  if (path === "auth/google/callback") return finishGoogleOAuth(request);
  if (path === "provider/mercadopago/connect") return beginMercadoPagoConnect(request);
  if (path === "provider/mercadopago/callback") return finishMercadoPagoConnect(request);
  return handle("GET", request, context);
}

export function POST(request: NextRequest, context: ApiContext) {
  return handle("POST", request, context);
}

export function PATCH(request: NextRequest, context: ApiContext) {
  return handle("PATCH", request, context);
}

export function PUT(request: NextRequest, context: ApiContext) {
  return handle("PUT", request, context);
}

export function DELETE(request: NextRequest, context: ApiContext) {
  return handle("DELETE", request, context);
}
