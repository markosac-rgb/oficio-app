import { POSTAL_DIRECTORY } from "@/lib/constants";

/**
 * Geocoding for Mexico.
 * Live lookups use OpenStreetMap Nominatim (no API key).
 * If Nominatim fails, we fall back to a short example directory and say so.
 *
 * Nominatim usage: https://operations.osmfoundation.org/policies/nominatim/
 * One request per second, a real User-Agent, and a cache.
 */

export interface PlaceHit {
  label: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  lat: number;
  lng: number;
}

export interface GeoResponse {
  simulated: boolean;
  source: "nominatim" | "directorio-ejemplo";
  note: string;
  places: PlaceHit[];
}

export interface PostalMatch {
  cp: string;
  neighborhood: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
}

const USER_AGENT = "Ofixio/1.0 (servicios para el hogar en México; https://oficio-app.onrender.com)";
const CACHE_MS = 24 * 60 * 60 * 1000;
const MIN_GAP_MS = 1100;

type CacheEntry = { at: number; places: PlaceHit[] };

const cache = new Map<string, CacheEntry>();
let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function remember(key: string, places: PlaceHit[]) {
  cache.set(key, { at: Date.now(), places });
  if (cache.size > 200) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

function cached(key: string) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_MS) {
    cache.delete(key);
    return null;
  }
  return hit.places;
}

function schedule<T>(task: () => Promise<T>) {
  const run = queue.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    return task();
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

type NominatimAddress = {
  postcode?: string;
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
  road?: string;
  house_number?: string;
};

type NominatimItem = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: NominatimAddress;
};

function inMexico(lat: number, lng: number) {
  return lat >= 14 && lat <= 33 && lng >= -118 && lng <= -86;
}

function toPlace(item: NominatimItem): PlaceHit | null {
  const lat = Number(item.lat);
  const lng = Number(item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inMexico(lat, lng)) return null;
  const address = item.address ?? {};
  const street = [address.road, address.house_number].filter(Boolean).join(" ");
  const neighborhood = address.suburb || address.neighbourhood || address.quarter || "";
  const city = address.city || address.town || address.village || address.municipality || "";
  const state = address.state || "";
  return {
    label: item.display_name || [street, neighborhood, city].filter(Boolean).join(", "),
    street,
    neighborhood,
    city,
    state,
    postalCode: (address.postcode || "").replace(/\D/g, "").slice(0, 5),
    lat,
    lng,
  };
}

async function nominatim(params: URLSearchParams): Promise<PlaceHit[] | null> {
  const key = params.toString();
  const stored = cached(key);
  if (stored) return stored;
  try {
    const places = await schedule(async () => {
      const url = `https://nominatim.openstreetmap.org/search?${key}`;
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "Accept-Language": "es-MX,es",
          "User-Agent": USER_AGENT,
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as NominatimItem[];
      if (!Array.isArray(data)) return null;
      return data.map(toPlace).filter((place): place is PlaceHit => place != null);
    });
    if (places) remember(key, places);
    return places;
  } catch {
    return null;
  }
}

function directoryPlace(place: PostalMatch, label?: string): PlaceHit {
  return {
    label: label || `${place.neighborhood}, ${place.city}, CP ${place.cp}`,
    street: "",
    neighborhood: place.neighborhood,
    city: place.city,
    state: place.state,
    postalCode: place.cp,
    lat: place.lat,
    lng: place.lng,
  };
}

const FALLBACK_NOTE =
  "Simulado / Demo. Nominatim no respondió. Usamos un directorio corto de ejemplo, no un mapa oficial.";

export async function lookupPostalCode(cp: string): Promise<GeoResponse> {
  const digits = cp.replace(/\D/g, "").slice(0, 5);
  if (digits.length !== 5) {
    return { simulated: false, source: "nominatim", note: "El código postal de México tiene 5 números.", places: [] };
  }
  const params = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    countrycodes: "mx",
    limit: "5",
    postalcode: digits,
  });
  const live = await nominatim(params);
  if (live && live.length > 0) {
    return {
      simulated: false,
      source: "nominatim",
      note: "Lugar encontrado con OpenStreetMap Nominatim.",
      places: live.map((place) => ({ ...place, postalCode: place.postalCode || digits })),
    };
  }
  const found = POSTAL_DIRECTORY.find((place) => place.cp === digits);
  if (!found || live === null) {
    if (found) {
      return {
        simulated: true,
        source: "directorio-ejemplo",
        note: FALLBACK_NOTE,
        places: [directoryPlace(found)],
      };
    }
  }
  return {
    simulated: live === null,
    source: live === null ? "directorio-ejemplo" : "nominatim",
    note: live === null ? FALLBACK_NOTE : "No encontramos ese código postal en México.",
    places: [],
  };
}

export async function searchPlaces(query: string): Promise<GeoResponse> {
  const q = query.trim().slice(0, 120);
  if (q.length < 3) {
    return { simulated: false, source: "nominatim", note: "Escribe al menos 3 letras.", places: [] };
  }
  const params = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    countrycodes: "mx",
    limit: "5",
    q,
  });
  const live = await nominatim(params);
  if (live && live.length > 0) {
    return {
      simulated: false,
      source: "nominatim",
      note: "Resultados de OpenStreetMap Nominatim, solo México.",
      places: live,
    };
  }
  const folded = q.toLowerCase();
  const local = POSTAL_DIRECTORY.filter((place) =>
    `${place.cp} ${place.neighborhood} ${place.city} ${place.state}`.toLowerCase().includes(folded),
  ).slice(0, 5);
  if (live === null && local.length > 0) {
    return {
      simulated: true,
      source: "directorio-ejemplo",
      note: FALLBACK_NOTE,
      places: local.map((place) => directoryPlace(place)),
    };
  }
  return {
    simulated: live === null,
    source: live === null ? "directorio-ejemplo" : "nominatim",
    note: live === null ? FALLBACK_NOTE : "No encontramos ese lugar en México.",
    places: [],
  };
}

export function listDemoCodes(): PostalMatch[] {
  return POSTAL_DIRECTORY.map((place) => ({ ...place }));
}
