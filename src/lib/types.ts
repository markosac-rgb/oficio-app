export type Role = "CLIENT" | "PROVIDER" | "ADMIN";

export type Account = {
  id: string;
  role: Role;
  name: string;
  email: string | null;
  phone: string | null;
  isDemo: boolean;
  authNote: string;
  suspended: boolean;
  acceptedRulesAt: string | null;
  clientProfile: {
    street: string;
    neighborhood: string;
    city: string;
    state: string;
    postalCode: string;
    reference: string;
    lat: number;
    lng: number;
    locationSet: boolean;
  } | null;
  provider: {
    id: string;
    trade: string;
    profileReady: boolean;
    availableNow: boolean;
    city: string;
    zoneLabel: string;
    identityStatus: string;
    certStatus: string;
    referencesStatus: string;
    isExample: boolean;
  } | null;
};

export type ProviderCard = {
  id: string;
  name: string;
  trade: string;
  zoneLabel: string;
  city: string;
  state: string;
  distanceKm: number | null;
  rating: number | null;
  reviewCount: number;
  exampleReviewCount: number;
  minPriceMxn: number | null;
  priceLabel: string;
  availableNow: boolean;
  emergency: boolean;
  identityStatus: string;
  certStatus: string;
  referencesStatus: string;
  isExample: boolean;
  isDemo: boolean;
  coverageKm: number;
  responseMinutes: number;
  experienceYears: number;
};

export type ProviderService = {
  id: string;
  categoryId: string;
  categoryName: string;
  title: string;
  description: string;
  priceType: string;
  priceMxn: number | null;
  unit: string;
};

export type ProviderReview = {
  id: string;
  authorName: string;
  authorIsDemo: boolean;
  rating: number;
  comment: string;
  isExample: boolean;
  createdAt: string;
};

export type ProviderProfile = ProviderCard & {
  bio: string;
  postalCode: string;
  lat: number;
  lng: number;
  schedule: Record<string, string>;
  cancellationPolicy: string;
  referencesNote: string;
  services: ProviderService[];
  photos: { id: string; caption: string; tone: string; imageData: string; isExample: boolean }[];
  documentsPending: number;
  isFavorite: boolean;
  profileReady: boolean;
  reviews: ProviderReview[];
};

export type QuoteView = {
  id: string;
  providerId: string;
  providerName: string;
  providerTrade: string;
  rating: number | null;
  reviewCount: number;
  isExample: boolean;
  isDemo: boolean;
  identityStatus: string;
  certStatus: string;
  referencesStatus: string;
  amountMxn: number;
  message: string;
  etaMinutes: number | null;
  status: string;
  createdAt: string;
};

export type PaymentView = {
  method: string;
  serviceMxn: number;
  feeMxn: number;
  totalMxn: number;
  status: string;
  simulated: boolean;
  adapter: string;
  reference: string;
  note: string;
  createdAt: string;
};

export type RequestSummary = {
  id: string;
  title: string;
  description: string;
  status: string;
  statusLabel: string;
  categoryName: string;
  mode: string;
  neighborhood: string;
  city: string;
  emergency: boolean;
  scheduledAt: string | null;
  createdAt: string;
  quoteCount: number;
  myQuoteStatus: string | null;
  counterpart: string;
  hasPayment: boolean;
};

export type RequestDetail = {
  id: string;
  title: string;
  description: string;
  photos: string[];
  status: string;
  statusLabel: string;
  categoryId: string;
  categoryName: string;
  serviceOfferingId: string | null;
  serviceTitle: string;
  referencePriceMxn: number | null;
  mode: string;
  emergency: boolean;
  preferredWindow: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  fuzzyLat: number;
  fuzzyLng: number;
  exactAddress: { street: string; reference: string; lat: number; lng: number } | null;
  scheduledAt: string | null;
  selectedQuoteId: string | null;
  cancelReason: string;
  createdAt: string;
  clientName: string;
  quotes: QuoteView[];
  myQuote: { id: string; amountMxn: number; message: string; etaMinutes: number | null; status: string } | null;
  payment: PaymentView | null;
  review: { rating: number; comment: string; createdAt: string } | null;
  permissions: {
    canQuote: boolean;
    canAccept: boolean;
    canSchedule: boolean;
    canPay: boolean;
    canAdvance: boolean;
    nextStatus: string | null;
    canCancel: boolean;
    canReview: boolean;
    canChat: boolean;
    canRehire: boolean;
    needsDisputeOnCancel: boolean;
  };
};

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  mine: boolean;
  body: string;
  imageData: string;
  createdAt: string;
};

export type ThreadSummary = {
  requestId: string;
  title: string;
  status: string;
  statusLabel: string;
  withName: string;
  lastBody: string;
  lastAt: string | null;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
};

export type ReportItem = {
  id: string;
  kind: string;
  description: string;
  status: string;
  adminNote: string;
  requestId: string | null;
  reporterName: string;
  createdAt: string;
};

export type AdminUser = {
  id: string;
  name: string;
  role: Role;
  email: string | null;
  phone: string | null;
  isDemo: boolean;
  suspended: boolean;
  createdAt: string;
  providerId: string | null;
  trade: string;
  isExample: boolean;
  identityStatus: string;
  certStatus: string;
  referencesStatus: string;
};
