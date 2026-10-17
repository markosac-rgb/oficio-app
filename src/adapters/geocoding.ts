import { POSTAL_DIRECTORY } from "@/lib/constants";

/**
 * Geocoder adapter. The demo only knows a short list of example postal codes.
 * Replace with Google Maps Geocoding or Mapbox.
 */
export interface PostalMatch {
  cp: string;
  neighborhood: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  simulated: true;
  source: "demo-directory";
  externalProviderNeeded: string;
  match: PostalMatch | null;
}

export interface Geocoder {
  lookupPostalCode(cp: string): Promise<GeocodeResult>;
  listDemoCodes(): PostalMatch[];
}

const NEEDED = "Google Maps Geocoding o Mapbox, para cualquier código postal de México y un mapa real.";

export const demoGeocoder: Geocoder = {
  async lookupPostalCode(cp: string) {
    const digits = cp.replace(/\D/g, "");
    const found = POSTAL_DIRECTORY.find((place) => place.cp === digits) ?? null;
    return {
      simulated: true,
      source: "demo-directory",
      externalProviderNeeded: NEEDED,
      match: found ? { ...found } : null,
    };
  },
  listDemoCodes() {
    return POSTAL_DIRECTORY.map((place) => ({ ...place }));
  },
};
