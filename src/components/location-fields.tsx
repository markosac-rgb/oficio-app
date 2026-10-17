"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fuzzyCoord } from "@/lib/geo";
import { Button, Field, Input } from "@/components/ui";
import { DemoBanner } from "@/components/states";
import type { PlaceHit } from "@/adapters/geocoding";

const PinMap = dynamic(() => import("@/components/maps").then((mod) => mod.PinMap), {
  ssr: false,
  loading: () => <div data-testid="location-map" className="h-56 rounded-3xl bg-sand" />,
});

export type AddressValue = {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  reference: string;
  lat: number;
  lng: number;
};

type GeoResponse = {
  simulated: boolean;
  source: string;
  note: string;
  places: PlaceHit[];
};

export function LocationFields({
  value,
  onChange,
  showStreet,
  legend,
}: {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  showStreet: boolean;
  legend: string;
}) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<PlaceHit[]>([]);
  const [hint, setHint] = useState("");
  const [simulated, setSimulated] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 3) return;
    const timer = window.setTimeout(() => {
      void search(text);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [query]);

  async function search(text: string) {
    setBusy(true);
    try {
      const result = await api<GeoResponse>(`/api/geo/buscar?q=${encodeURIComponent(text)}`);
      setPlaces(result.places);
      setSimulated(result.simulated);
      setHint(result.note);
    } catch {
      setHint("No se pudo buscar el lugar. Escribe colonia y código postal a mano.");
      setPlaces([]);
    } finally {
      setBusy(false);
    }
  }

  async function lookupCp() {
    setBusy(true);
    try {
      const result = await api<GeoResponse>(`/api/geo/cp?cp=${encodeURIComponent(value.postalCode)}`);
      setSimulated(result.simulated);
      setHint(result.note);
      setPlaces(result.places);
      if (result.places[0]) applyPlace(result.places[0]);
    } catch {
      setHint("No se pudo consultar el código postal. Puedes escribir la colonia a mano.");
    } finally {
      setBusy(false);
    }
  }

  function applyPlace(place: PlaceHit) {
    onChange({
      ...value,
      street: showStreet && place.street ? place.street : value.street,
      neighborhood: place.neighborhood || value.neighborhood,
      city: place.city || value.city,
      state: place.state || value.state,
      postalCode: place.postalCode || value.postalCode,
      lat: place.lat,
      lng: place.lng,
    });
    setPlaces([]);
  }

  return (
    <div className="space-y-3">
      {simulated ? <DemoBanner>{hint}</DemoBanner> : null}
      <Field label="Buscar dirección en México" hint="OpenStreetMap Nominatim. Esperamos un momento entre búsquedas.">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Calle, colonia o lugar"
          data-testid="address-search"
        />
      </Field>
      {busy ? <p className="text-sm font-bold">Buscando…</p> : null}
      {places.length > 0 ? (
        <ul className="space-y-2">
          {places.map((place) => (
            <li key={`${place.lat}-${place.lng}-${place.label}`}>
              <button type="button" className="w-full rounded-2xl bg-white px-3 py-2 text-left text-sm leading-5" onClick={() => applyPlace(place)}>
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Field label="Código postal" hint={legend}>
        <div className="flex gap-2">
          <Input
            inputMode="numeric"
            value={value.postalCode}
            onChange={(event) => onChange({ ...value, postalCode: event.target.value })}
            placeholder="06700"
          />
          <Button type="button" variant="secondary" onClick={() => void lookupCp()}>
            Buscar
          </Button>
        </div>
      </Field>
      {!simulated && hint ? <p className="text-sm font-bold">{hint}</p> : null}
      <Field label="Colonia">
        <Input value={value.neighborhood} onChange={(event) => onChange({ ...value, neighborhood: event.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Ciudad">
          <Input value={value.city} onChange={(event) => onChange({ ...value, city: event.target.value })} />
        </Field>
        <Field label="Estado">
          <Input value={value.state} onChange={(event) => onChange({ ...value, state: event.target.value })} />
        </Field>
      </div>
      {showStreet ? (
        <>
          <Field label="Calle y número" hint="Solo la verá quien confirme el trabajo.">
            <Input data-testid="address-street" value={value.street} onChange={(event) => onChange({ ...value, street: event.target.value })} />
          </Field>
          <Field label="Referencia">
            <Input value={value.reference} onChange={(event) => onChange({ ...value, reference: event.target.value })} placeholder="Color de la casa, depto, entre calles" />
          </Field>
        </>
      ) : null}
      <div>
        <p className="mb-1.5 text-sm font-extrabold">Ajustar el pin</p>
        <PinMap lat={value.lat} lng={value.lng} onMove={(lat, lng) => onChange({ ...value, lat, lng })} />
        <p className="mt-1 text-xs text-muted">
          En el mapa público tu casa se verá cerca de {fuzzyCoord(value.lat).toFixed(2)}, {fuzzyCoord(value.lng).toFixed(2)}, no en este pin.
        </p>
      </div>
    </div>
  );
}

export const emptyAddress: AddressValue = {
  street: "",
  neighborhood: "",
  city: "",
  state: "",
  postalCode: "",
  reference: "",
  lat: 19.4326,
  lng: -99.1332,
};
