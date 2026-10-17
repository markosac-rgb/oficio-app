import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { listDemoCodes, lookupPostalCode as geocodePostalCode, searchPlaces as geocodePlaces } from "@/adapters/geocoding";
import { demoIdentityAdapter } from "@/adapters/identity";
import { demoPaymentAdapter } from "@/adapters/payments";
import {
  ADVANCE_LABEL,
  CANCELLATION_RULES,
  CATEGORIES,
  DAY_KEYS,
  DEFAULT_SCHEDULE,
  INTEGRATIONS,
  NEXT_STATUS,
  PAYMENT_METHODS,
  PLATFORM_FEE_RATE,
  POLICY_VERSION,
  PROBLEM_HINTS,
  STATUS_LABEL,
  breakdown,
  normalizeText,
  type PaymentMethodId,
} from "@/lib/constants";
import { displayName } from "@/lib/format";
import { distanceKm, fuzzyCoord } from "@/lib/geo";
import { prisma } from "@/lib/prisma";
import { demoDataEnabled, setDemoDataEnabled } from "@/server/settings";
import { statusHeadline } from "@/lib/status";
import type {
  AdminUser,
  ChatMessage,
  Achievement,
  ProviderCard,
  ProviderProfile,
  QuoteView,
  ReportItem,
  RequestDetail,
  RequestSummary,
  ThreadSummary,
} from "@/lib/types";
import type { AppUser } from "./auth";
import { HttpError, asText, requiredText } from "./errors";

const providerBundle = {
  user: true,
  services: { include: { category: true } },
  reviews: { include: { author: true } },
  photos: true,
  documents: true,
} satisfies Prisma.ProviderProfileInclude;

type ProviderBundle = Prisma.ProviderProfileGetPayload<{ include: typeof providerBundle }>;

const requestBundle = {
  category: true,
  client: true,
  payment: true,
  review: true,
  reports: true,
  quotes: {
    include: {
      provider: { include: { user: true, reviews: true } },
    },
    orderBy: { amountMxn: "asc" },
  },
} satisfies Prisma.ServiceRequestInclude;

type RequestBundle = Prisma.ServiceRequestGetPayload<{ include: typeof requestBundle }>;

const CONFIRMED_STATES = ["CONFIRMED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED"];

function ratingOf(reviews: { rating: number; isExample: boolean }[]) {
  if (reviews.length === 0) {
    return { rating: null as number | null, reviewCount: 0, exampleReviewCount: 0 };
  }
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return {
    rating: Math.round((total / reviews.length) * 10) / 10,
    reviewCount: reviews.length,
    exampleReviewCount: reviews.filter((review) => review.isExample).length,
  };
}

function priceOf(services: { priceType: string; priceMxn: number | null; unit?: string }[]) {
  const hourly = services.filter((service) => service.unit === "hora" && service.priceMxn != null);
  const hourlyMxn = hourly.length === 0 ? null : Math.min(...hourly.map((service) => service.priceMxn as number));
  const priced = services.filter((service) => service.priceType !== "QUOTE" && service.priceMxn != null);
  if (priced.length === 0) return { minPriceMxn: null as number | null, hourlyMxn, priceLabel: "Cotización" };
  const minPriceMxn = Math.min(...priced.map((service) => service.priceMxn as number));
  if (hourlyMxn != null) {
    return { minPriceMxn, hourlyMxn, priceLabel: `$${hourlyMxn.toLocaleString("es-MX")} MXN/h` };
  }
  if (services.length === 1 && services[0]?.priceType === "FIXED") {
    return { minPriceMxn, hourlyMxn, priceLabel: `$${minPriceMxn.toLocaleString("es-MX")} MXN` };
  }
  return { minPriceMxn, hourlyMxn, priceLabel: `Desde $${minPriceMxn.toLocaleString("es-MX")} MXN` };
}

function parseSchedule(raw: string) {
  try {
    const data = JSON.parse(raw) as Record<string, string>;
    const schedule = { ...DEFAULT_SCHEDULE };
    for (const day of DAY_KEYS) {
      if (typeof data[day] === "string" && data[day].trim()) schedule[day] = data[day].trim();
    }
    return schedule;
  } catch {
    return { ...DEFAULT_SCHEDULE };
  }
}

function parsePhotoList(raw: string) {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function originOf(user: AppUser | null) {
  if (user?.role === "CLIENT" && user.clientProfile?.locationSet) {
    return { lat: user.clientProfile.lat, lng: user.clientProfile.lng };
  }
  return null;
}

async function notify(userId: string, title: string, body: string, href: string) {
  await prisma.notification.create({
    data: { id: randomUUID(), userId, title, body: body.slice(0, 180), href },
  });
}

function toCard(provider: ProviderBundle, origin: { lat: number; lng: number } | null): ProviderCard {
  const stats = ratingOf(provider.reviews);
  const price = priceOf(provider.services);
  const distance =
    origin == null
      ? null
      : Math.round(distanceKm(origin.lat, origin.lng, provider.lat, provider.lng) * 10) / 10;
  return {
    id: provider.id,
    name: provider.user.name,
    trade: provider.trade,
    zoneLabel: provider.zoneLabel,
    city: provider.city,
    state: provider.state,
    distanceKm: distance,
    ...stats,
    ...price,
    availableNow: provider.availableNow,
    emergency: provider.emergency,
    identityStatus: provider.identityStatus,
    certStatus: provider.certStatus,
    referencesStatus: provider.referencesStatus,
    isExample: provider.isExample,
    isDemo: provider.user.isDemo,
    coverageKm: provider.coverageKm,
    responseMinutes: provider.responseMinutes,
    experienceYears: provider.experienceYears,
    zoneLat: fuzzyCoord(provider.lat),
    zoneLng: fuzzyCoord(provider.lng),
  };
}

export async function searchProviders(user: AppUser | null, filters: {
  q?: string;
  category?: string;
  maxKm?: number;
  maxPrice?: number;
  minRating?: number;
  available?: boolean;
  emergency?: boolean;
  sort?: "distance" | "price" | "rating";
  ids?: string[];
}) {
  const showExamples = await demoDataEnabled();
  const providers = await prisma.providerProfile.findMany({
    where: {
      profileReady: true,
      user: { suspended: false },
      ...(showExamples ? {} : { isExample: false }),
      ...(filters.ids ? { id: { in: filters.ids } } : {}),
    },
    include: providerBundle,
  });
  const origin = originOf(user);
  const query = normalizeText(filters.q ?? "");
  const hinted = PROBLEM_HINTS.filter((hint) =>
    hint.words.some((word) => query.includes(normalizeText(word))),
  ).map((hint) => hint.categoryId);

  let cards = providers.map((provider) => toCard(provider, origin));
  const byId = new Map(providers.map((provider) => [provider.id, provider]));

  cards = cards.filter((card) => {
    const provider = byId.get(card.id)!;
    if (filters.category && !provider.services.some((service) => service.categoryId === filters.category)) {
      return false;
    }
    if (query.length >= 2) {
      const blob = normalizeText(
        [
          provider.user.name,
          provider.trade,
          provider.bio,
          provider.zoneLabel,
          provider.city,
          ...provider.services.map((service) => `${service.title} ${service.category.name}`),
        ].join(" "),
      );
      const textHit = blob.includes(query);
      const hintHit = provider.services.some((service) => (hinted as string[]).includes(service.categoryId));
      if (!textHit && !hintHit) return false;
    }
    if (filters.available && !provider.availableNow) return false;
    if (filters.emergency && !(provider.emergency && provider.availableNow)) return false;
    if (filters.maxPrice != null && (card.minPriceMxn == null || card.minPriceMxn > filters.maxPrice)) return false;
    if (filters.minRating != null && (card.rating == null || card.rating < filters.minRating)) return false;
    if (filters.maxKm != null && origin) {
      if (card.distanceKm == null || card.distanceKm > filters.maxKm || card.distanceKm > provider.coverageKm) {
        return false;
      }
    }
    return true;
  });

  const sort = filters.sort ?? (origin ? "distance" : "rating");
  cards.sort((a, b) => {
    if (sort === "price") return (a.minPriceMxn ?? 9_999_999) - (b.minPriceMxn ?? 9_999_999);
    if (sort === "rating") return (b.rating ?? -1) - (a.rating ?? -1);
    return (a.distanceKm ?? 9_999) - (b.distanceKm ?? 9_999);
  });
  return {
    providers: cards,
    locationKnown: Boolean(origin),
    feeRate: PLATFORM_FEE_RATE,
  };
}

export async function getProvider(user: AppUser | null, id: string): Promise<ProviderProfile> {
  const provider = await prisma.providerProfile.findUnique({
    where: { id },
    include: providerBundle,
  });
  if (!provider || provider.user.suspended) throw new HttpError(404, "No encontramos a esa persona.");
  const showExamples = await demoDataEnabled();
  const isOwner = user?.id === provider.userId;
  if (provider.isExample && !showExamples && !isOwner && user?.role !== "ADMIN") {
    throw new HttpError(404, "Los perfiles de ejemplo están ocultos.");
  }
  if (!provider.profileReady && !isOwner && user?.role !== "ADMIN") {
    throw new HttpError(404, "Este perfil todavía no está listo.");
  }
  const card = toCard(provider, originOf(user));
  const favorite = user
    ? await prisma.favorite.findUnique({
        where: { userId_providerId: { userId: user.id, providerId: provider.id } },
      })
    : null;
  return {
    ...card,
    bio: provider.bio,
    postalCode: provider.postalCode,
    lat: provider.lat,
    lng: provider.lng,
    schedule: parseSchedule(provider.scheduleJson),
    cancellationPolicy: provider.cancellationPolicy,
    referencesNote: provider.referencesNote,
    services: provider.services.map((service) => ({
      id: service.id,
      categoryId: service.categoryId,
      categoryName: service.category.name,
      title: service.title,
      description: service.description,
      priceType: service.priceType,
      priceMxn: service.priceMxn,
      unit: service.unit,
    })),
    photos: provider.photos.map((photo) => ({
      id: photo.id,
      caption: photo.caption,
      tone: photo.tone,
      imageData: photo.imageData,
      isExample: photo.isExample,
    })),
    documentsPending: provider.documents.filter((doc) => doc.status === "pending").length,
    isFavorite: Boolean(favorite),
    profileReady: provider.profileReady,
    reviews: provider.reviews
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 20)
      .map((review) => ({
        id: review.id,
        authorName: review.isExample ? "Cliente de ejemplo" : displayName(review.author.name, false),
        authorIsDemo: review.author.isDemo,
        rating: review.rating,
        comment: review.comment,
        isExample: review.isExample,
        createdAt: review.createdAt.toISOString(),
      })),
  };
}

export async function toggleFavorite(user: AppUser, providerId: string) {
  if (user.role !== "CLIENT") throw new HttpError(403, "Los favoritos son para cuentas de cliente.");
  const provider = await prisma.providerProfile.findUnique({ where: { id: providerId } });
  if (!provider) throw new HttpError(404, "No encontramos a esa persona.");
  const existing = await prisma.favorite.findUnique({
    where: { userId_providerId: { userId: user.id, providerId } },
  });
  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return { favorite: false };
  }
  await prisma.favorite.create({
    data: { id: randomUUID(), userId: user.id, providerId },
  });
  return { favorite: true };
}

export async function updateClientLocation(user: AppUser, input: Record<string, unknown>) {
  if (user.role !== "CLIENT") throw new HttpError(403, "Guarda la dirección en una cuenta de cliente.");
  const neighborhood = requiredText(input.neighborhood, "la colonia", 2, 80);
  const city = requiredText(input.city, "la ciudad", 2, 80);
  const state = requiredText(input.state, "el estado", 2, 40);
  const postalCode = asText(input.postalCode).replace(/\D/g, "").slice(0, 5);
  const street = asText(input.street).slice(0, 160);
  const reference = asText(input.reference).slice(0, 160);
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 14 || lat > 33 || lng < -118 || lng > -86) {
    throw new HttpError(400, "Mueve el pin para que quede dentro de México.");
  }
  await prisma.clientProfile.upsert({
    where: { userId: user.id },
    update: { neighborhood, city, state, postalCode, street, reference, lat, lng, locationSet: true },
    create: { userId: user.id, neighborhood, city, state, postalCode, street, reference, lat, lng, locationSet: true },
  });
  return { ok: true };
}

function cleanPhotos(value: unknown) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, "Las fotos no llegaron bien.");
  const photos = value.filter((item): item is string => typeof item === "string");
  if (photos.some((photo) => !photo.startsWith("data:image/"))) {
    throw new HttpError(400, "Una de las fotos no tiene un formato válido.");
  }
  if (photos.length > 3) throw new HttpError(400, "Puedes subir hasta 3 fotos.");
  if (photos.some((photo) => photo.length > 500_000)) throw new HttpError(400, "Una foto es muy pesada.");
  return photos;
}

export async function createRequest(user: AppUser, input: Record<string, unknown>) {
  if (user.role !== "CLIENT") throw new HttpError(403, "Pide el servicio con una cuenta de cliente.");
  const profile = user.clientProfile;
  const neighborhood = requiredText(asText(input.neighborhood) || profile?.neighborhood, "la colonia", 2, 80);
  const city = requiredText(asText(input.city) || profile?.city, "la ciudad", 2, 80);
  const state = requiredText(asText(input.state) || profile?.state, "el estado", 2, 40);
  const postalCode = (asText(input.postalCode) || profile?.postalCode || "").replace(/\D/g, "").slice(0, 5);
  const street = (asText(input.street) || profile?.street || "").slice(0, 160);
  const reference = (asText(input.reference) || profile?.reference || "").slice(0, 160);
  const lat = Number(input.lat ?? profile?.lat);
  const lng = Number(input.lng ?? profile?.lng);
  if (!profile?.locationSet && !asText(input.neighborhood)) {
    throw new HttpError(400, "Primero guarda tu colonia o código postal.");
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpError(400, "Falta el punto del mapa.");
  const description = requiredText(input.description, "qué necesitas", 10, 2000);
  const photos = cleanPhotos(input.photos);
  const mode = input.mode === "SCHEDULED" ? "SCHEDULED" : "IMMEDIATE";
  const emergency = input.emergency === true;
  let categoryId = asText(input.categoryId);
  let targetProviderId = asText(input.targetProviderId) || null;
  let serviceOfferingId: string | null = null;
  let serviceTitle = "";
  let referencePriceMxn: number | null = null;
  let autoQuote: { providerId: string; amountMxn: number; message: string } | null = null;

  const serviceId = asText(input.serviceOfferingId);
  if (serviceId) {
    const service = await prisma.serviceOffering.findUnique({
      where: { id: serviceId },
      include: { provider: { include: { user: true } }, category: true },
    });
    if (!service || service.provider.user.suspended) throw new HttpError(404, "Ese servicio ya no está disponible.");
    categoryId = service.categoryId;
    targetProviderId = service.providerId;
    serviceOfferingId = service.id;
    serviceTitle = service.title;
    referencePriceMxn = service.priceMxn;
    if (service.priceType === "FIXED" && service.priceMxn) {
      autoQuote = {
        providerId: service.providerId,
        amountMxn: service.priceMxn,
        message: "Este es el precio publicado por el proveedor. Acéptalo solo si estás de acuerdo. Aún no se cobra.",
      };
    }
  }

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new HttpError(400, "Elige un tipo de servicio.");
  if (targetProviderId) {
    const target = await prisma.providerProfile.findUnique({ where: { id: targetProviderId }, include: { user: true } });
    if (!target || target.user.suspended) throw new HttpError(404, "Esa persona ya no está disponible.");
    if (target.userId === user.id) throw new HttpError(400, "No puedes pedirte un servicio a ti mismo.");
  }

  const requestId = randomUUID();
  const title = serviceTitle || `${category.name} en ${neighborhood}`;
  await prisma.serviceRequest.create({
    data: {
      id: requestId,
      clientId: user.id,
      categoryId: category.id,
      targetProviderId,
      serviceOfferingId,
      serviceTitle,
      referencePriceMxn,
      mode,
      title,
      description,
      photoData: JSON.stringify(photos),
      neighborhood,
      city,
      state,
      postalCode,
      street,
      reference,
      lat,
      lng,
      emergency,
      preferredWindow: mode === "IMMEDIATE" ? "Lo antes posible" : asText(input.preferredWindow) || "Por acordar",
      status: autoQuote ? "QUOTED" : "REQUESTED",
    },
  });

  if (autoQuote) {
    await prisma.quote.create({
      data: {
        id: randomUUID(),
        requestId,
        providerId: autoQuote.providerId,
        amountMxn: autoQuote.amountMxn,
        message: autoQuote.message,
        etaMinutes: emergency ? 45 : 90,
        status: "PENDING",
      },
    });
  }

  const recipients = await providersToNotify(targetProviderId, category.id, lat, lng);
  await Promise.all(
    recipients.map((provider) =>
      notify(
        provider.userId,
        emergency ? "Solicitud de emergencia" : "Nueva solicitud",
        `${category.name} en ${neighborhood}. La calle se comparte solo si confirman contigo.`,
        `/solicitudes/${requestId}`,
      ),
    ),
  );
  return { id: requestId };
}

async function providersToNotify(targetProviderId: string | null, categoryId: string, lat: number, lng: number) {
  if (targetProviderId) {
    const target = await prisma.providerProfile.findUnique({ where: { id: targetProviderId } });
    return target ? [target] : [];
  }
  const providers = await prisma.providerProfile.findMany({
    where: {
      profileReady: true,
      user: { suspended: false },
      services: { some: { categoryId } },
    },
  });
  return providers
    .filter((provider) => distanceKm(lat, lng, provider.lat, provider.lng) <= provider.coverageKm)
    .slice(0, 8);
}

async function loadViewerProvider(user: AppUser) {
  if (!user.providerProfile) return null;
  return prisma.providerProfile.findUnique({
    where: { id: user.providerProfile.id },
    include: { services: true },
  });
}

function canAccess(user: AppUser, request: RequestBundle, provider: { id: string; lat: number; lng: number; coverageKm: number; services: { categoryId: string }[] } | null) {
  if (user.role === "ADMIN") return true;
  if (user.id === request.clientId) return true;
  if (!provider) return false;
  if (request.quotes.some((quote) => quote.providerId === provider.id)) return true;
  if (request.targetProviderId && request.targetProviderId === provider.id) return true;
  if (request.selectedQuoteId || request.targetProviderId) return false;
  const offers = provider.services.some((service) => service.categoryId === request.categoryId);
  const km = distanceKm(request.lat, request.lng, provider.lat, provider.lng);
  return offers && km <= provider.coverageKm;
}

function selectedQuote(request: RequestBundle) {
  return request.quotes.find((quote) => quote.id === request.selectedQuoteId && quote.status === "ACCEPTED") ?? null;
}

function toSummary(request: RequestBundle, user: AppUser): RequestSummary {
  const selected = selectedQuote(request);
  const mine = user.providerProfile
    ? request.quotes.find((quote) => quote.providerId === user.providerProfile!.id)
    : null;
  const fullName = CONFIRMED_STATES.includes(request.status);
  let counterpart = "Por asignar";
  if (user.id === request.clientId) {
    counterpart = selected ? selected.provider.user.name : request.targetProviderId ? "Proveedor elegido" : "Varias personas pueden cotizar";
  } else {
    counterpart = displayName(request.client.name, fullName && selected?.provider.userId === user.id);
  }
  return {
    id: request.id,
    title: request.title,
    description: request.description,
    status: request.status,
    statusLabel: statusHeadline(request.status, request.selectedQuoteId),
    categoryName: request.category.name,
    mode: request.mode,
    neighborhood: request.neighborhood,
    city: request.city,
    emergency: request.emergency,
    scheduledAt: request.scheduledAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
    quoteCount: request.quotes.length,
    myQuoteStatus: mine?.status ?? null,
    counterpart,
    hasPayment: Boolean(request.payment),
    isExample: request.isExample,
  };
}

export async function listRequests(user: AppUser) {
  const provider = await loadViewerProvider(user);
  const requests = await prisma.serviceRequest.findMany({
    include: requestBundle,
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  return requests.filter((request) => canAccess(user, request, provider)).map((request) => toSummary(request, user));
}

export async function getRequest(user: AppUser, id: string): Promise<RequestDetail> {
  const request = await prisma.serviceRequest.findUnique({ where: { id }, include: requestBundle });
  if (!request) throw new HttpError(404, "No encontramos esa solicitud.");
  const provider = await loadViewerProvider(user);
  if (!canAccess(user, request, provider)) throw new HttpError(404, "No encontramos esa solicitud.");
  const selected = selectedQuote(request);
  const mine = provider ? request.quotes.find((quote) => quote.providerId === provider.id && quote.status !== "WITHDRAWN") ?? null : null;
  const confirmed = CONFIRMED_STATES.includes(request.status);
  const isSelectedProvider = Boolean(provider && selected?.providerId === provider.id);
  const openDispute = request.reports.some((report) => report.kind === "DISPUTE" && report.status !== "RESOLVED");
  const seeExact =
    user.id === request.clientId ||
    (isSelectedProvider && confirmed) ||
    (user.role === "ADMIN" && (confirmed || openDispute));

  const offers =
    provider?.services.some((service) => service.categoryId === request.categoryId) &&
    distanceKm(request.lat, request.lng, provider.lat, provider.lng) <= provider.coverageKm;
  const targeted = provider != null && request.targetProviderId === provider.id;
  const openToMe = provider != null && !request.targetProviderId && Boolean(offers);
  const canQuote =
    provider != null &&
    provider.profileReady &&
    !selected &&
    ["REQUESTED", "QUOTED"].includes(request.status) &&
    (targeted || openToMe) &&
    mine?.status !== "ACCEPTED";

  const quotes: QuoteView[] = request.quotes
    .filter((quote) => quote.status !== "WITHDRAWN")
    .filter((quote) => {
      if (user.id === request.clientId || user.role === "ADMIN") return true;
      return quote.providerId === provider?.id;
    })
    .map((quote) => {
      const stats = ratingOf(quote.provider.reviews);
      return {
        id: quote.id,
        providerId: quote.providerId,
        providerName: quote.provider.user.name,
        providerTrade: quote.provider.trade,
        rating: stats.rating,
        reviewCount: stats.reviewCount,
        isExample: quote.provider.isExample,
        isDemo: quote.provider.user.isDemo,
        identityStatus: quote.provider.identityStatus,
        certStatus: quote.provider.certStatus,
        referencesStatus: quote.provider.referencesStatus,
        amountMxn: quote.amountMxn,
        message: quote.message,
        etaMinutes: quote.etaMinutes,
        status: quote.status,
        createdAt: quote.createdAt.toISOString(),
      };
    });

  const clientView = user.id === request.clientId;
  return {
    id: request.id,
    title: request.title,
    description: request.description,
    photos: parsePhotoList(request.photoData),
    status: request.status,
    statusLabel: statusHeadline(request.status, request.selectedQuoteId),
    categoryId: request.categoryId,
    categoryName: request.category.name,
    serviceOfferingId: request.serviceOfferingId,
    serviceTitle: request.serviceTitle,
    referencePriceMxn: request.referencePriceMxn,
    mode: request.mode,
    emergency: request.emergency,
    preferredWindow: request.preferredWindow,
    neighborhood: request.neighborhood,
    city: request.city,
    state: request.state,
    postalCode: request.postalCode,
    fuzzyLat: fuzzyCoord(request.lat),
    fuzzyLng: fuzzyCoord(request.lng),
    exactAddress: seeExact
      ? { street: request.street, reference: request.reference, lat: request.lat, lng: request.lng }
      : null,
    scheduledAt: request.scheduledAt?.toISOString() ?? null,
    selectedQuoteId: request.selectedQuoteId,
    cancelReason: request.cancelReason,
    createdAt: request.createdAt.toISOString(),
    clientName: clientView || seeExact ? request.client.name : displayName(request.client.name, false),
    quotes,
    myQuote: mine
      ? {
          id: mine.id,
          amountMxn: mine.amountMxn,
          message: mine.message,
          etaMinutes: mine.etaMinutes,
          status: mine.status,
        }
      : null,
    payment: request.payment
      ? {
          method: request.payment.method,
          serviceMxn: request.payment.serviceMxn,
          feeMxn: request.payment.feeMxn,
          totalMxn: request.payment.totalMxn,
          status: request.payment.status,
          simulated: request.payment.simulated,
          adapter: request.payment.adapter,
          reference: request.payment.reference,
          note: request.payment.note,
          createdAt: request.payment.createdAt.toISOString(),
        }
      : null,
    review: request.review
      ? {
          rating: request.review.rating,
          comment: request.review.comment,
          createdAt: request.review.createdAt.toISOString(),
        }
      : null,
    permissions: {
      canQuote,
      canAccept: clientView && !selected && ["REQUESTED", "QUOTED"].includes(request.status) && quotes.some((quote) => quote.status === "PENDING"),
      canSchedule: clientView && Boolean(selected) && !request.payment && request.status === "QUOTED",
      canPay: clientView && Boolean(selected) && Boolean(request.scheduledAt) && !request.payment && request.status === "QUOTED",
      canAdvance: isSelectedProvider && Boolean(NEXT_STATUS[request.status]),
      nextStatus: isSelectedProvider ? NEXT_STATUS[request.status] ?? null : null,
      canCancel: !["COMPLETED", "CANCELLED"].includes(request.status) && (clientView || isSelectedProvider || targeted || user.role === "ADMIN"),
      canReview: clientView && request.status === "COMPLETED" && !request.review,
      canChat: clientView || user.role === "ADMIN" || (provider != null && (!selected || selected.providerId === provider.id) && canAccess(user, request, provider)),
      canRehire: clientView && request.status === "COMPLETED" && Boolean(selected),
      needsDisputeOnCancel: ["EN_ROUTE", "IN_PROGRESS"].includes(request.status),
    },
  };
}

async function requireRequest(user: AppUser, id: string) {
  const request = await prisma.serviceRequest.findUnique({ where: { id }, include: requestBundle });
  if (!request) throw new HttpError(404, "No encontramos esa solicitud.");
  const provider = await loadViewerProvider(user);
  if (!canAccess(user, request, provider)) throw new HttpError(404, "No encontramos esa solicitud.");
  return { request, provider };
}

export async function sendQuote(user: AppUser, requestId: string, input: Record<string, unknown>) {
  const { request, provider } = await requireRequest(user, requestId);
  const detail = await getRequest(user, requestId);
  if (!detail.permissions.canQuote || !provider) {
    throw new HttpError(403, "No puedes cotizar esta solicitud. Revisa tu zona, tu oficio y que el trabajo siga abierto.");
  }
  const amountMxn = Number(input.amountMxn);
  if (!Number.isInteger(amountMxn) || amountMxn < 50 || amountMxn > 200_000) {
    throw new HttpError(400, "Escribe el precio en pesos enteros, entre 50 y 200,000.");
  }
  const message = requiredText(input.message, "un mensaje corto sobre el trabajo", 5, 600);
  let etaMinutes: number | null = null;
  if (input.etaMinutes != null && input.etaMinutes !== "") {
    etaMinutes = Number(input.etaMinutes);
    if (!Number.isInteger(etaMinutes) || etaMinutes < 10 || etaMinutes > 480) {
      throw new HttpError(400, "El tiempo de llegada va de 10 a 480 minutos.");
    }
  }
  const pending = request.quotes.find((quote) => quote.providerId === provider.id && quote.status === "PENDING");
  if (pending) {
    await prisma.quote.update({
      where: { id: pending.id },
      data: { amountMxn, message, etaMinutes },
    });
  } else {
    await prisma.quote.create({
      data: {
        id: randomUUID(),
        requestId,
        providerId: provider.id,
        amountMxn,
        message,
        etaMinutes,
        status: "PENDING",
      },
    });
  }
  if (request.status === "REQUESTED") {
    await prisma.serviceRequest.update({ where: { id: requestId }, data: { status: "QUOTED" } });
  }
  await notify(
    request.clientId,
    "Llegó una cotización",
    `${user.name} cotizó $${amountMxn.toLocaleString("es-MX")} MXN. No se cobra hasta que aceptes.`,
    `/solicitudes/${requestId}`,
  );
  return { ok: true };
}

export async function decideQuote(user: AppUser, quoteId: string, accept: boolean) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { request: { include: { payment: true } }, provider: { include: { user: true } } },
  });
  if (!quote) throw new HttpError(404, "No encontramos esa cotización.");
  if (quote.status !== "PENDING") throw new HttpError(400, "Esa cotización ya no está disponible.");
  const isClient = quote.request.clientId === user.id;
  const isOwner = user.providerProfile?.id === quote.providerId;
  if (accept) {
    if (!isClient) throw new HttpError(403, "Solo quien pidió el servicio puede aceptar la cotización.");
    if (quote.request.payment) throw new HttpError(400, "Este servicio ya tiene un método registrado.");
    await prisma.$transaction([
      prisma.quote.update({ where: { id: quote.id }, data: { status: "ACCEPTED" } }),
      prisma.quote.updateMany({
        where: { requestId: quote.requestId, id: { not: quote.id }, status: "PENDING" },
        data: { status: "REJECTED" },
      }),
      prisma.serviceRequest.update({
        where: { id: quote.requestId },
        data: { selectedQuoteId: quote.id, status: "QUOTED" },
      }),
    ]);
    await notify(
      quote.provider.userId,
      "Aceptaron tu cotización",
      "Falta que confirmen la cita y el método de pago. Aún no hay un cobro.",
      `/solicitudes/${quote.requestId}`,
    );
    return { ok: true };
  }
  if (!isClient && !isOwner) throw new HttpError(403, "No puedes cambiar esta cotización.");
  await prisma.quote.update({
    where: { id: quote.id },
    data: { status: isOwner ? "WITHDRAWN" : "REJECTED" },
  });
  const pendingLeft = await prisma.quote.count({ where: { requestId: quote.requestId, status: "PENDING" } });
  if (pendingLeft === 0 && !quote.request.selectedQuoteId) {
    await prisma.serviceRequest.update({ where: { id: quote.requestId }, data: { status: "REQUESTED" } });
  }
  return { ok: true };
}

export async function scheduleRequest(user: AppUser, requestId: string, input: Record<string, unknown>) {
  const detail = await getRequest(user, requestId);
  if (!detail.permissions.canSchedule) {
    throw new HttpError(400, "Primero acepta una cotización. La cita se confirma antes del método de pago.");
  }
  let scheduledAt: Date;
  if (input.asap === true) {
    const eta = detail.quotes.find((quote) => quote.id === detail.selectedQuoteId)?.etaMinutes ?? 60;
    scheduledAt = new Date(Date.now() + eta * 60 * 1000);
  } else {
    scheduledAt = new Date(asText(input.scheduledAt));
    if (Number.isNaN(scheduledAt.getTime())) throw new HttpError(400, "Elige fecha y hora.");
    if (scheduledAt.getTime() < Date.now() - 5 * 60 * 1000) throw new HttpError(400, "Esa hora ya pasó.");
  }
  await prisma.serviceRequest.update({ where: { id: requestId }, data: { scheduledAt } });
  return { ok: true, scheduledAt: scheduledAt.toISOString() };
}

export async function recordPayment(user: AppUser, requestId: string, input: Record<string, unknown>) {
  const { request } = await requireRequest(user, requestId);
  const detail = await getRequest(user, requestId);
  if (!detail.permissions.canPay) {
    throw new HttpError(400, "Acepta la cotización y confirma la cita antes de registrar un método.");
  }
  if (input.acceptedPolicy !== true) {
    throw new HttpError(400, "Lee y acepta las reglas de cancelación y aclaraciones.");
  }
  const method = asText(input.method) as PaymentMethodId;
  const methodInfo = PAYMENT_METHODS.find((item) => item.id === method);
  if (!methodInfo) throw new HttpError(400, "Elige un método de pago.");
  const selected = selectedQuote(request);
  if (!selected) throw new HttpError(400, "Falta una cotización aceptada.");
  const money = breakdown(selected.amountMxn);
  const recorded = await demoPaymentAdapter.record({
    requestId,
    method,
    serviceMxn: money.serviceMxn,
    feeMxn: money.feeMxn,
    totalMxn: money.totalMxn,
  });
  await prisma.payment.create({
    data: {
      id: randomUUID(),
      requestId,
      method,
      serviceMxn: money.serviceMxn,
      feeMxn: money.feeMxn,
      totalMxn: money.totalMxn,
      status: recorded.status,
      simulated: true,
      adapter: recorded.adapter,
      reference: recorded.reference,
      note: `${recorded.note} ${methodInfo.protection}`,
      policyVersion: POLICY_VERSION,
    },
  });
  await prisma.serviceRequest.update({ where: { id: requestId }, data: { status: "CONFIRMED" } });
  await notify(
    selected.provider.userId,
    "Servicio confirmado",
    `Ya puedes ver la dirección. Método elegido: ${methodInfo.name}. No hubo un cobro dentro de Oficio.`,
    `/solicitudes/${requestId}`,
  );
  await notify(request.clientId, "Quedó confirmado", "Guardamos tu método y el desglose. Revisa el recibo en la solicitud.", `/solicitudes/${requestId}/pago`);
  return { ok: true, simulated: true, reference: recorded.reference };
}

export async function advanceStatus(user: AppUser, requestId: string) {
  const detail = await getRequest(user, requestId);
  if (!detail.permissions.canAdvance || !detail.permissions.nextStatus) {
    throw new HttpError(403, "Ahora no puedes cambiar el estado de este trabajo.");
  }
  const next = detail.permissions.nextStatus;
  await prisma.serviceRequest.update({ where: { id: requestId }, data: { status: next } });
  const request = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (request) {
    await notify(
      request.clientId,
      "Actualización del servicio",
      `Estado: ${STATUS_LABEL[next] ?? next}.`,
      next === "COMPLETED" ? `/solicitudes/${requestId}/calificar` : `/solicitudes/${requestId}`,
    );
  }
  return { ok: true, status: next, label: ADVANCE_LABEL[next] ?? STATUS_LABEL[next] };
}

export async function cancelRequest(user: AppUser, requestId: string, input: Record<string, unknown>) {
  const { request } = await requireRequest(user, requestId);
  const detail = await getRequest(user, requestId);
  if (!detail.permissions.canCancel) throw new HttpError(400, "Este servicio ya no se puede cancelar.");
  const reason = requiredText(input.reason, "el motivo", detail.permissions.needsDisputeOnCancel ? 10 : 5, 500);
  await prisma.serviceRequest.update({
    where: { id: requestId },
    data: { status: "CANCELLED", cancelReason: reason, cancelledBy: user.id },
  });
  if (detail.permissions.needsDisputeOnCancel) {
    await prisma.report.create({
      data: {
        id: randomUUID(),
        reporterId: user.id,
        requestId,
        kind: "DISPUTE",
        description: `Cancelación con el trabajo en curso. ${reason}`,
        status: "OPEN",
      },
    });
  }
  const selected = selectedQuote(request);
  const otherId = user.id === request.clientId ? selected?.provider.userId : request.clientId;
  if (otherId) {
    await notify(otherId, "Servicio cancelado", reason, `/solicitudes/${requestId}`);
  }
  return { ok: true, disputeOpened: detail.permissions.needsDisputeOnCancel };
}

export async function addReview(user: AppUser, requestId: string, input: Record<string, unknown>) {
  const { request } = await requireRequest(user, requestId);
  if (user.id !== request.clientId) throw new HttpError(403, "Solo quien recibió el servicio puede reseñar.");
  if (request.status !== "COMPLETED") throw new HttpError(400, "La reseña se deja cuando el trabajo está terminado.");
  if (request.review) throw new HttpError(400, "Ya dejaste una reseña en este servicio.");
  const selected = selectedQuote(request);
  if (!selected) throw new HttpError(400, "No hay un proveedor asignado para reseñar.");
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, "Elige de 1 a 5 estrellas.");
  const comment = requiredText(input.comment, "tu reseña", 4, 800);
  await prisma.review.create({
    data: {
      id: randomUUID(),
      requestId,
      authorId: user.id,
      providerId: selected.providerId,
      rating,
      comment,
      isExample: false,
    },
  });
  await notify(selected.provider.userId, "Nueva reseña", `${rating} estrellas en ${request.title}.`, `/proveedores/${selected.providerId}`);
  return { ok: true };
}

function messageVisible(message: { audienceProviderId: string; senderId: string }, user: AppUser, request: RequestBundle, providerId: string | null) {
  const selected = selectedQuote(request);
  if (user.role === "ADMIN" || user.id === request.clientId) {
    if (!selected) return true;
    return !message.audienceProviderId || message.audienceProviderId === selected.providerId;
  }
  if (!providerId) return false;
  if (selected && selected.providerId !== providerId) return false;
  return !message.audienceProviderId || message.audienceProviderId === providerId || message.senderId === user.id;
}

export async function listMessages(user: AppUser, requestId: string): Promise<{ messages: ChatMessage[]; title: string }> {
  const { request, provider } = await requireRequest(user, requestId);
  const detail = await getRequest(user, requestId);
  if (!detail.permissions.canChat && user.role !== "ADMIN") {
    throw new HttpError(403, "El chat de este servicio ya no está abierto para ti.");
  }
  const messages = await prisma.message.findMany({
    where: { requestId },
    include: { sender: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return {
    title: request.title,
    messages: messages
      .filter((message) => messageVisible(message, user, request, provider?.id ?? null))
      .map((message) => ({
        id: message.id,
        senderId: message.senderId,
        senderName: message.senderId === user.id ? "Tú" : displayName(message.sender.name, false),
        mine: message.senderId === user.id,
        body: message.body,
        imageData: message.imageData,
        createdAt: message.createdAt.toISOString(),
      })),
  };
}

export async function postMessage(user: AppUser, requestId: string, input: Record<string, unknown>) {
  const { request, provider } = await requireRequest(user, requestId);
  const detail = await getRequest(user, requestId);
  if (!detail.permissions.canChat) throw new HttpError(403, "No puedes escribir en este chat.");
  const body = asText(input.body);
  const imageData = asText(input.imageData);
  if (!body && !imageData) throw new HttpError(400, "Escribe un mensaje o adjunta una foto.");
  if (body.length > 2000) throw new HttpError(400, "El mensaje es muy largo.");
  if (imageData && (!imageData.startsWith("data:image/") || imageData.length > 500_000)) {
    throw new HttpError(400, "La foto del chat no se pudo guardar.");
  }
  const selected = selectedQuote(request);
  const audienceProviderId =
    user.id === request.clientId ? (selected?.providerId ?? "") : (provider?.id ?? "");
  await prisma.message.create({
    data: {
      id: randomUUID(),
      requestId,
      senderId: user.id,
      body: body || "Foto",
      imageData,
      audienceProviderId,
    },
  });
  await prisma.serviceRequest.update({ where: { id: requestId }, data: { updatedAt: new Date() } });
  const preview = imageData ? "Envió una foto" : body.slice(0, 80);
  if (user.id === request.clientId) {
    const ids = new Set<string>();
    if (selected) ids.add(selected.provider.userId);
    else {
      for (const quote of request.quotes) ids.add(quote.provider.userId);
      if (request.targetProviderId) {
        const target = await prisma.providerProfile.findUnique({ where: { id: request.targetProviderId } });
        if (target) ids.add(target.userId);
      }
    }
    await Promise.all([...ids].map((id) => notify(id, "Nuevo mensaje", preview, `/mensajes/${requestId}`)));
  } else {
    await notify(request.clientId, "Nuevo mensaje", preview, `/mensajes/${requestId}`);
  }
  return { ok: true };
}

export async function listThreads(user: AppUser): Promise<ThreadSummary[]> {
  const provider = await loadViewerProvider(user);
  const requests = await prisma.serviceRequest.findMany({
    include: {
      ...requestBundle,
      messages: { include: { sender: true }, orderBy: { createdAt: "desc" }, take: 20 },
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });
  const visible = requests.filter((request) => canAccess(user, request, provider));
  const targetIds = visible.map((request) => request.targetProviderId).filter((id): id is string => Boolean(id));
  const targets = await prisma.providerProfile.findMany({
    where: { id: { in: targetIds } },
    include: { user: true },
  });
  const targetName = new Map(targets.map((item) => [item.id, item.user.name]));
  return visible.map((request) => {
    const selected = selectedQuote(request);
    const last = request.messages.find((message) => messageVisible(message, user, request, provider?.id ?? null));
    const withName =
      user.id === request.clientId
        ? selected?.provider.user.name || (request.targetProviderId ? targetName.get(request.targetProviderId) || "Proveedor" : "Por asignar")
        : displayName(request.client.name, CONFIRMED_STATES.includes(request.status));
    return {
      requestId: request.id,
      title: request.title,
      status: request.status,
      statusLabel: statusHeadline(request.status, request.selectedQuoteId),
      withName,
      lastBody: last ? (last.imageData ? "Foto" : last.body) : "Sin mensajes todavía",
      lastAt: last?.createdAt.toISOString() ?? null,
    };
  });
}

export async function listNotifications(user: AppUser) {
  const items = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  const unreadItems = items.filter((item) => !item.read);
  return {
    unread: unreadItems.length,
    messages: unreadItems.filter((item) => item.href.startsWith("/mensajes")).length,
    bookings: unreadItems.filter((item) => item.href.startsWith("/solicitudes")).length,
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      href: item.href,
      read: item.read,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

export async function markNotificationsRead(user: AppUser) {
  await prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  return { ok: true };
}

export async function createReport(user: AppUser, input: Record<string, unknown>) {
  const kind = ["HELP", "PROBLEM", "DISPUTE"].includes(asText(input.kind)) ? asText(input.kind) : "HELP";
  const description = requiredText(input.description, "qué pasó", 10, 1000);
  const requestId = asText(input.requestId) || null;
  if (requestId) {
    await getRequest(user, requestId);
  }
  const report = await prisma.report.create({
    data: {
      id: randomUUID(),
      reporterId: user.id,
      requestId,
      kind,
      description,
      status: "OPEN",
    },
  });
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", suspended: false } });
  await Promise.all(
    admins.map((admin) => notify(admin.id, "Nuevo reporte", `${kind}: ${description.slice(0, 80)}`, "/admin")),
  );
  return {
    id: report.id,
    message:
      "Recibimos tu reporte. Una persona del equipo lo ve en el panel de administración. Esto no mueve dinero ni hace un reembolso automático.",
  };
}

async function refreshReady(providerId: string) {
  const provider = await prisma.providerProfile.findUnique({
    where: { id: providerId },
    include: { services: true },
  });
  if (!provider) return;
  const ready = Boolean(
    provider.trade.trim() &&
      provider.zoneLabel.trim() &&
      provider.city.trim() &&
      provider.coverageKm > 0 &&
      provider.services.length > 0,
  );
  if (ready !== provider.profileReady) {
    await prisma.providerProfile.update({ where: { id: providerId }, data: { profileReady: ready } });
  }
}

function mexicoWeekStart(now = new Date()) {
  const offsetMs = -6 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + offsetMs);
  const mondayOffset = (local.getUTCDay() + 6) % 7;
  local.setUTCHours(0, 0, 0, 0);
  local.setUTCDate(local.getUTCDate() - mondayOffset);
  return new Date(local.getTime() - offsetMs);
}

function localDayKey(date: Date) {
  const local = new Date(date.getTime() - 6 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function streakFrom(dates: Date[], now = new Date()) {
  const days = new Set(dates.map((date) => localDayKey(date)));
  if (days.size === 0) return 0;
  let cursor = localDayKey(now);
  if (!days.has(cursor)) cursor = localDayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    const [year, month, day] = cursor.split("-").map(Number);
    cursor = new Date(Date.UTC(year, month - 1, day) - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
  return streak;
}

async function clientAchievements(userId: string): Promise<Achievement[]> {
  const [requests, completed, reviews] = await Promise.all([
    prisma.serviceRequest.count({ where: { clientId: userId, isExample: false } }),
    prisma.serviceRequest.count({ where: { clientId: userId, status: "COMPLETED", isExample: false } }),
    prisma.review.count({ where: { authorId: userId, isExample: false } }),
  ]);
  return [
    { id: "primer", title: "Primer servicio", detail: "Enviaste una solicitud tuya.", earned: requests >= 1 },
    { id: "terminado", title: "Servicio terminado", detail: "Un trabajo tuyo llegó a completado.", earned: completed >= 1 },
    { id: "resena", title: "Primera reseña", detail: "Publicaste una reseña.", earned: reviews >= 1 },
    { id: "cinco", title: "5 reseñas", detail: "Publicaste cinco reseñas.", earned: reviews >= 5 },
  ];
}

export async function providerDashboard(user: AppUser) {
  if (!user.providerProfile) throw new HttpError(403, "Esta sección es para quien ofrece servicios.");
  const profile = await getProvider(user, user.providerProfile.id);
  const requests = await listRequests(user);
  const accepted = await prisma.quote.findMany({
    where: { providerId: user.providerProfile.id, status: "ACCEPTED" },
    include: { request: { include: { payment: true } } },
  });
  const done = accepted.filter(
    (quote) => quote.request.status === "COMPLETED" && quote.request.selectedQuoteId === quote.id && quote.request.payment,
  );
  const weekStart = mexicoWeekStart();
  const doneThisWeek = done.filter((quote) => (quote.request.payment?.createdAt ?? quote.request.updatedAt) >= weekStart);
  const realDone = done.filter((quote) => !quote.request.isExample);
  const realReviews = profile.reviewCount - profile.exampleReviewCount;
  const documents = await prisma.providerDocument.findMany({
    where: { providerId: user.providerProfile.id },
    orderBy: { createdAt: "desc" },
  });
  return {
    profile,
    incoming: requests.filter((item) => ["REQUESTED", "QUOTED"].includes(item.status) && !item.hasPayment && item.myQuoteStatus !== "REJECTED"),
    active: requests.filter((item) => ["CONFIRMED", "EN_ROUTE", "IN_PROGRESS"].includes(item.status)),
    history: requests.filter((item) => ["COMPLETED", "CANCELLED"].includes(item.status)),
    earningsMxn: done.reduce((sum, quote) => sum + (quote.request.payment?.serviceMxn ?? 0), 0),
    earningsWeekMxn: doneThisWeek.reduce((sum, quote) => sum + (quote.request.payment?.serviceMxn ?? 0), 0),
    feesShownMxn: done.reduce((sum, quote) => sum + (quote.request.payment?.feeMxn ?? 0), 0),
    completedJobs: done.length,
    completedThisWeek: doneThisWeek.length,
    streakDays: streakFrom(realDone.map((quote) => quote.request.payment?.createdAt ?? quote.request.updatedAt)),
    goalTarget: 3,
    achievements: [
      { id: "primer", title: "Primer servicio", detail: "Terminaste un trabajo con pago registrado.", earned: realDone.length >= 1 },
      { id: "cinco", title: "5 reseñas", detail: "Cinco reseñas que no son de ejemplo.", earned: realReviews >= 5 },
      { id: "semana", title: "Semana activa", detail: "Registraste un trabajo esta semana.", earned: doneThisWeek.some((quote) => !quote.request.isExample) },
    ] satisfies Achievement[],
    documents: documents.map((doc) => ({
      id: doc.id,
      kind: doc.kind,
      label: doc.label,
      status: doc.status,
      note: doc.note,
      createdAt: doc.createdAt.toISOString(),
    })),
    trustNote:
      "Identidad verificada, certificaciones revisadas y referencias revisadas solo aparecen si una persona administradora las marcó. Enviar un documento no las enciende.",
  };
}

export async function updateProviderProfile(user: AppUser, input: Record<string, unknown>) {
  if (!user.providerProfile) throw new HttpError(403, "Crea una cuenta de proveedor para editar el oficio.");
  const current = await prisma.providerProfile.findUnique({ where: { id: user.providerProfile.id } });
  if (!current) throw new HttpError(404, "No encontramos tu perfil.");
  const lat = Number(input.lat ?? current.lat);
  const lng = Number(input.lng ?? current.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpError(400, "Marca el centro de tu zona.");
  const referencesNote = asText(input.referencesNote ?? current.referencesNote).slice(0, 400);
  let referencesStatus = current.referencesStatus;
  if (referencesStatus !== "reviewed" && referencesStatus !== "rejected") {
    referencesStatus = referencesNote ? "declared" : "none";
  }
  await prisma.providerProfile.update({
    where: { id: current.id },
    data: {
      trade: requiredText(input.trade ?? current.trade, "tu oficio", 2, 60),
      bio: requiredText(input.bio ?? current.bio, "una descripción", 10, 600),
      experienceYears: clampInt(input.experienceYears ?? current.experienceYears, 0, 60),
      coverageKm: clampInt(input.coverageKm ?? current.coverageKm, 1, 80),
      zoneLabel: requiredText(input.zoneLabel ?? current.zoneLabel, "tu zona", 2, 120),
      city: requiredText(input.city ?? current.city, "tu ciudad", 2, 80),
      state: requiredText(input.state ?? current.state, "tu estado", 2, 40),
      postalCode: asText(input.postalCode ?? current.postalCode).replace(/\D/g, "").slice(0, 5),
      lat,
      lng,
      responseMinutes: clampInt(input.responseMinutes ?? current.responseMinutes, 10, 240),
      cancellationPolicy: requiredText(input.cancellationPolicy ?? current.cancellationPolicy, "tus reglas", 5, 400),
      referencesNote,
      referencesStatus,
    },
  });
  if (typeof input.name === "string") {
    await prisma.user.update({ where: { id: user.id }, data: { name: requiredText(input.name, "tu nombre", 3, 80) } });
  }
  await refreshReady(current.id);
  return { ok: true };
}

function clampInt(value: unknown, min: number, max: number) {
  const number = Number(value);
  if (!Number.isInteger(number)) throw new HttpError(400, "Revisa los números del formulario.");
  return Math.min(max, Math.max(min, number));
}

export async function setAvailability(user: AppUser, input: Record<string, unknown>) {
  if (!user.providerProfile) throw new HttpError(403, "Solo un proveedor cambia su disponibilidad.");
  await prisma.providerProfile.update({
    where: { id: user.providerProfile.id },
    data: {
      availableNow: input.availableNow === true,
      emergency: input.emergency === true,
    },
  });
  return { ok: true };
}

export async function saveSchedule(user: AppUser, input: Record<string, unknown>) {
  if (!user.providerProfile) throw new HttpError(403, "Solo un proveedor edita su horario.");
  const source = (input.schedule ?? {}) as Record<string, unknown>;
  const schedule = { ...DEFAULT_SCHEDULE };
  for (const day of DAY_KEYS) {
    const value = asText(source[day]);
    if (value) schedule[day] = value.slice(0, 40);
  }
  await prisma.providerProfile.update({
    where: { id: user.providerProfile.id },
    data: { scheduleJson: JSON.stringify(schedule) },
  });
  return { schedule };
}

export async function saveService(user: AppUser, input: Record<string, unknown>, serviceId?: string) {
  if (!user.providerProfile) throw new HttpError(403, "Solo un proveedor publica servicios.");
  const categoryId = requiredText(input.categoryId, "la categoría", 2, 40);
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new HttpError(400, "Esa categoría no existe.");
  const priceType = asText(input.priceType);
  if (!["FIXED", "FROM", "QUOTE"].includes(priceType)) throw new HttpError(400, "Elige si el precio es fijo, desde, o por cotizar.");
  let priceMxn: number | null = null;
  if (priceType !== "QUOTE") {
    priceMxn = Number(input.priceMxn);
    if (!Number.isInteger(priceMxn) || priceMxn < 50 || priceMxn > 500_000) {
      throw new HttpError(400, "Escribe la tarifa en pesos enteros.");
    }
  }
  const data = {
    categoryId,
    title: requiredText(input.title, "el nombre del servicio", 3, 80),
    description: requiredText(input.description, "qué incluye", 5, 400),
    priceType,
    priceMxn,
    unit: requiredText(input.unit ?? "visita", "la unidad", 2, 30),
  };
  if (serviceId) {
    const existing = await prisma.serviceOffering.findUnique({ where: { id: serviceId } });
    if (!existing || existing.providerId !== user.providerProfile.id) throw new HttpError(404, "No encontramos ese servicio.");
    await prisma.serviceOffering.update({ where: { id: serviceId }, data });
  } else {
    await prisma.serviceOffering.create({
      data: { id: randomUUID(), providerId: user.providerProfile.id, ...data },
    });
  }
  await refreshReady(user.providerProfile.id);
  return { ok: true };
}

export async function deleteService(user: AppUser, serviceId: string) {
  if (!user.providerProfile) throw new HttpError(403, "Solo un proveedor borra servicios.");
  const existing = await prisma.serviceOffering.findUnique({ where: { id: serviceId } });
  if (!existing || existing.providerId !== user.providerProfile.id) throw new HttpError(404, "No encontramos ese servicio.");
  await prisma.serviceOffering.delete({ where: { id: serviceId } });
  await refreshReady(user.providerProfile.id);
  return { ok: true };
}

export async function addWorkPhoto(user: AppUser, input: Record<string, unknown>) {
  if (!user.providerProfile) throw new HttpError(403, "Solo un proveedor agrega fotos de trabajos.");
  const caption = requiredText(input.caption, "una descripción de la foto", 3, 140);
  const imageData = asText(input.imageData);
  if (imageData && (!imageData.startsWith("data:image/") || imageData.length > 500_000)) {
    throw new HttpError(400, "No se pudo guardar la foto.");
  }
  await prisma.workPhoto.create({
    data: {
      id: randomUUID(),
      providerId: user.providerProfile.id,
      caption,
      tone: asText(input.tone) || "#c24e2a",
      imageData,
      isExample: false,
    },
  });
  return { ok: true };
}

export async function addDocument(user: AppUser, input: Record<string, unknown>) {
  if (!user.providerProfile) throw new HttpError(403, "Solo un proveedor envía documentos.");
  const kind = asText(input.kind);
  if (!["INE", "CERT", "REFERENCE"].includes(kind)) throw new HttpError(400, "Elige el tipo de documento.");
  const label = requiredText(input.label, "el nombre del documento", 3, 120);
  const result = await demoIdentityAdapter.submit({
    providerId: user.providerProfile.id,
    kind: kind as "INE" | "CERT" | "REFERENCE",
    label,
  });
  await prisma.providerDocument.create({
    data: {
      id: randomUUID(),
      providerId: user.providerProfile.id,
      kind,
      label,
      status: "pending",
      note: result.message,
    },
  });
  if (kind === "REFERENCE") {
    const current = await prisma.providerProfile.findUnique({ where: { id: user.providerProfile.id } });
    if (current && current.referencesStatus === "none") {
      await prisma.providerProfile.update({
        where: { id: current.id },
        data: { referencesStatus: "declared", referencesNote: current.referencesNote || label },
      });
    }
  }
  return { ok: true, simulated: true, message: result.message, externalProviderNeeded: demoIdentityAdapter.externalProviderNeeded };
}

function assertAdmin(user: AppUser) {
  if (user.role !== "ADMIN") throw new HttpError(403, "Esta sección es solo para administración.");
}

export async function adminSummary(user: AppUser) {
  assertAdmin(user);
  const [users, requests, reports] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: true }),
    prisma.serviceRequest.groupBy({ by: ["status"], _count: true }),
    prisma.report.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
  ]);
  return {
    users: Object.fromEntries(users.map((row) => [row.role, row._count])),
    requests: Object.fromEntries(requests.map((row) => [row.status, row._count])),
    openReports: reports,
    integrations: INTEGRATIONS,
    rules: CANCELLATION_RULES,
  };
}

export async function adminUsers(user: AppUser): Promise<AdminUser[]> {
  assertAdmin(user);
  const users = await prisma.user.findMany({
    include: { providerProfile: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return users.map((item) => ({
    id: item.id,
    name: item.name,
    role: item.role as AdminUser["role"],
    email: item.email,
    phone: item.phone,
    isDemo: item.isDemo,
    suspended: item.suspended,
    createdAt: item.createdAt.toISOString(),
    providerId: item.providerProfile?.id ?? null,
    trade: item.providerProfile?.trade ?? "",
    isExample: item.providerProfile?.isExample ?? false,
    identityStatus: item.providerProfile?.identityStatus ?? "",
    certStatus: item.providerProfile?.certStatus ?? "",
    referencesStatus: item.providerProfile?.referencesStatus ?? "",
  }));
}

export async function adminSetSuspended(user: AppUser, userId: string, suspended: boolean) {
  assertAdmin(user);
  if (user.id === userId) throw new HttpError(400, "No puedes suspender tu propia cuenta.");
  await prisma.user.update({ where: { id: userId }, data: { suspended } });
  return { ok: true };
}

export async function adminSetChecks(user: AppUser, providerId: string, input: Record<string, unknown>) {
  assertAdmin(user);
  const provider = await prisma.providerProfile.findUnique({ where: { id: providerId } });
  if (!provider) throw new HttpError(404, "No encontramos a ese proveedor.");
  const data: Prisma.ProviderProfileUpdateInput = {};
  const identity = asText(input.identityStatus);
  const cert = asText(input.certStatus);
  const references = asText(input.referencesStatus);
  if (identity) {
    if (!["none", "verified", "rejected"].includes(identity)) throw new HttpError(400, "Estado de identidad no válido.");
    data.identityStatus = identity;
    if (identity === "verified" || identity === "rejected") {
      await prisma.providerDocument.updateMany({
        where: { providerId, kind: "INE" },
        data: { status: identity === "verified" ? "reviewed" : "rejected" },
      });
    }
  }
  if (cert) {
    if (!["none", "reviewed", "rejected"].includes(cert)) throw new HttpError(400, "Estado de certificación no válido.");
    data.certStatus = cert;
    if (cert === "reviewed" || cert === "rejected") {
      await prisma.providerDocument.updateMany({
        where: { providerId, kind: "CERT" },
        data: { status: cert === "reviewed" ? "reviewed" : "rejected" },
      });
    }
  }
  if (references) {
    if (!["none", "declared", "reviewed", "rejected"].includes(references)) {
      throw new HttpError(400, "Estado de referencias no válido.");
    }
    data.referencesStatus = references;
  }
  await prisma.providerProfile.update({ where: { id: providerId }, data });
  const note =
    identity === "verified"
      ? "Administración marcó tu identidad como verificada."
      : cert === "reviewed"
        ? "Administración marcó tus certificaciones como revisadas."
        : references === "reviewed"
          ? "Administración marcó tus referencias como revisadas."
          : "Administración actualizó el estado de tu verificación.";
  await notify(provider.userId, "Revisión de tu perfil", note, "/panel");
  return { ok: true };
}

export async function adminReports(user: AppUser): Promise<ReportItem[]> {
  assertAdmin(user);
  const reports = await prisma.report.findMany({
    include: { reporter: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return reports.map((report) => ({
    id: report.id,
    kind: report.kind,
    description: report.description,
    status: report.status,
    adminNote: report.adminNote,
    requestId: report.requestId,
    reporterName: report.reporter.name,
    createdAt: report.createdAt.toISOString(),
  }));
}

export async function adminUpdateReport(user: AppUser, reportId: string, input: Record<string, unknown>) {
  assertAdmin(user);
  const status = asText(input.status);
  if (!["OPEN", "IN_REVIEW", "RESOLVED"].includes(status)) throw new HttpError(400, "Estado de reporte no válido.");
  const adminNote = asText(input.adminNote).slice(0, 800);
  const report = await prisma.report.update({
    where: { id: reportId },
    data: { status, adminNote },
  });
  if (status === "RESOLVED") {
    await notify(
      report.reporterId,
      "Revisamos tu reporte",
      adminNote || "Una persona de administración marcó el reporte como resuelto. No implica un reembolso automático.",
      report.requestId ? `/solicitudes/${report.requestId}` : "/ayuda",
    );
  }
  return { ok: true };
}

export async function getHome(user: AppUser) {
  if (user.role === "ADMIN") {
    return { role: "ADMIN" as const, summary: await adminSummary(user) };
  }
  if (user.role === "PROVIDER") {
    const board = await providerDashboard(user);
    return {
      role: "PROVIDER" as const,
      incoming: board.incoming.slice(0, 4),
      active: board.active.slice(0, 4),
      earningsMxn: board.earningsMxn,
      earningsWeekMxn: board.earningsWeekMxn,
      completedThisWeek: board.completedThisWeek,
      streakDays: board.streakDays,
      goalTarget: board.goalTarget,
      achievements: board.achievements,
      rating: board.profile.rating,
      reviewCount: board.profile.reviewCount,
      availableNow: board.profile.availableNow,
      profileReady: board.profile.profileReady,
      trade: board.profile.trade,
      demoData: await demoDataEnabled(),
    };
  }
  const showExamples = await demoDataEnabled();
  const [nearby, statsBundle, categoryCounts, favorites, rehireIds, activeRequests, achievements] = await Promise.all([
    searchProviders(user, { available: true, sort: "distance", maxKm: 15 }),
    marketplaceStats(showExamples),
    categoryCountsFor(showExamples),
    listFavorites(user),
    rehireProviderIds(user.id),
    listRequests(user).then((items) => items.filter((item) => !["COMPLETED", "CANCELLED"].includes(item.status)).slice(0, 3)),
    clientAchievements(user.id),
  ]);
  let featured = await searchProviders(user, {
    sort: "rating",
    maxKm: user.clientProfile?.locationSet ? 25 : undefined,
    minRating: 4,
  });
  if (featured.providers.length < 3) {
    featured = await searchProviders(user, {
      sort: "rating",
      maxKm: user.clientProfile?.locationSet ? 25 : undefined,
    });
  }
  const rehire = rehireIds.length === 0 ? [] : (await searchProviders(user, { ids: rehireIds })).providers;
  return {
    role: "CLIENT" as const,
    needsLocation: !user.clientProfile?.locationSet,
    categories: categoryCounts,
    stats: statsBundle,
    nearby: nearby.providers.slice(0, 8),
    featured: featured.providers.slice(0, 8),
    favorites: favorites.providers.slice(0, 8),
    rehire,
    activeRequests,
    achievements,
    locationKnown: nearby.locationKnown,
    demoData: showExamples,
  };
}

async function marketplaceStats(showExamples: boolean) {
  const providers = await prisma.providerProfile.findMany({
    where: {
      profileReady: true,
      user: { suspended: false },
      ...(showExamples ? {} : { isExample: false }),
    },
    include: { reviews: true, services: { select: { categoryId: true } } },
  });
  const reviews = providers.flatMap((provider) => provider.reviews).filter((review) => showExamples || !review.isExample);
  const rating = reviews.length === 0 ? null : Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10) / 10;
  const categoryIds = new Set(providers.flatMap((provider) => provider.services.map((service) => service.categoryId)));
  const exampleProviders = providers.filter((provider) => provider.isExample).length;
  return {
    providers: providers.length,
    categories: categoryIds.size,
    rating,
    reviewCount: reviews.length,
    exampleData: showExamples && exampleProviders > 0,
    realProviders: providers.length - exampleProviders,
    exampleProviders,
  };
}

async function categoryCountsFor(showExamples: boolean) {
  const providers = await prisma.providerProfile.findMany({
    where: {
      profileReady: true,
      user: { suspended: false },
      ...(showExamples ? {} : { isExample: false }),
    },
    include: { services: { select: { categoryId: true } } },
  });
  return CATEGORIES.map((category) => ({
    id: category.id,
    name: category.name,
    icon: category.icon,
    count: providers.filter((provider) => provider.services.some((service) => service.categoryId === category.id)).length,
  }));
}

async function rehireProviderIds(clientId: string) {
  const done = await prisma.serviceRequest.findMany({
    where: { clientId, status: "COMPLETED" },
    orderBy: { updatedAt: "desc" },
    take: 12,
    include: { quotes: { select: { id: true, providerId: true, status: true } } },
  });
  const ids: string[] = [];
  for (const request of done) {
    const selected = request.quotes.find((quote) => quote.id === request.selectedQuoteId) ?? request.quotes.find((quote) => quote.status === "ACCEPTED");
    if (selected && !ids.includes(selected.providerId)) ids.push(selected.providerId);
  }
  return ids.slice(0, 8);
}

export async function adminDemoSettings(user: AppUser) {
  if (user.role !== "ADMIN") throw new HttpError(403, "Solo administración puede cambiar los datos de ejemplo.");
  return { demoData: await demoDataEnabled() };
}

export async function adminSetDemoData(user: AppUser, enabled: boolean) {
  if (user.role !== "ADMIN") throw new HttpError(403, "Solo administración puede cambiar los datos de ejemplo.");
  await setDemoDataEnabled(enabled);
  return { demoData: enabled };
}

export async function lookupPostalCode(cp: string) {
  return geocodePostalCode(cp);
}

export async function searchPlaces(query: string) {
  return geocodePlaces(query);
}

export async function demoPostalCodes() {
  return {
    simulated: true as const,
    note: "Lista corta de ejemplo por si Nominatim no responde.",
    places: listDemoCodes(),
  };
}

export function helpContent() {
  return {
    rules: CANCELLATION_RULES,
    integrations: INTEGRATIONS,
    feeRate: PLATFORM_FEE_RATE,
    methods: PAYMENT_METHODS,
  };
}

export async function listFavorites(user: AppUser) {
  if (user.role !== "CLIENT") return { providers: [] as ProviderCard[] };
  const favorites = await prisma.favorite.findMany({ where: { userId: user.id } });
  if (favorites.length === 0) return { providers: [] as ProviderCard[] };
  const result = await searchProviders(user, { ids: favorites.map((item) => item.providerId) });
  return { providers: result.providers };
}
