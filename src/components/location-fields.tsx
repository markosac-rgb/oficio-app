"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Field, Input } from "@/components/ui";
import { DemoBanner } from "@/components/states";

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

type Match = { cp: string; neighborhood: string; city: string; state: string; lat: number; lng: number };

function box(lat: number, lng: number) {
  return { latMin: lat - 0.045, latMax: lat + 0.045, lngMin: lng - 0.045, lngMax: lng + 0.045 };
}

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
  const [resetKey, setResetKey] = useState("inicio");
  const [hint, setHint] = useState("");
  const [bounds, setBounds] = useState(() => box(value.lat, value.lng));

  useEffect(() => {
    setBounds(box(value.lat, value.lng));
    // Only recenter the illustrated map when the lookup key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  async function lookup() {
    const result = await api<{ simulated: true; match: Match | null }>(`/api/geo/cp?cp=${encodeURIComponent(value.postalCode)}`);
    if (!result.match) {
      setHint("Ese código no está en el directorio de demostración. Escribe tu colonia y mueve el pin.");
      return;
    }
    onChange({
      ...value,
      postalCode: result.match.cp,
      neighborhood: result.match.neighborhood,
      city: result.match.city,
      state: result.match.state,
      lat: result.match.lat,
      lng: result.match.lng,
    });
    setResetKey(`${result.match.cp}-${result.match.lat}`);
    setHint(`${result.match.neighborhood}, ${result.match.city}. Ajusta el pin si hace falta.`);
  }

  const x = ((value.lng - bounds.lngMin) / (bounds.lngMax - bounds.lngMin)) * 100;
  const y = ((bounds.latMax - value.lat) / (bounds.latMax - bounds.latMin)) * 100;

  function move(clientX: number, clientY: number, rect: DOMRect) {
    const px = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const py = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    onChange({
      ...value,
      lng: bounds.lngMin + px * (bounds.lngMax - bounds.lngMin),
      lat: bounds.latMax - py * (bounds.latMax - bounds.latMin),
    });
  }

  function nudge(dLat: number, dLng: number) {
    onChange({
      ...value,
      lat: Math.min(bounds.latMax, Math.max(bounds.latMin, value.lat + dLat)),
      lng: Math.min(bounds.lngMax, Math.max(bounds.lngMin, value.lng + dLng)),
    });
  }

  return (
    <div className="space-y-3">
      <DemoBanner>El mapa es ilustrado. No es Google Maps. Solo reconocemos algunos códigos postales de ejemplo, como 06700.</DemoBanner>
      <Field label="Código postal" hint={legend}>
        <div className="flex gap-2">
          <Input
            inputMode="numeric"
            value={value.postalCode}
            onChange={(event) => onChange({ ...value, postalCode: event.target.value })}
            placeholder="06700"
          />
          <Button type="button" variant="secondary" onClick={() => void lookup()}>
            Buscar
          </Button>
        </div>
      </Field>
      {hint ? <p className="text-sm font-bold">{hint}</p> : null}
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
        <div
          className="relative h-52 overflow-hidden rounded-3xl border border-line bg-[#efe4d4]"
          style={{
            backgroundImage:
              "linear-gradient(#e4d5c4 1px, transparent 1px), linear-gradient(90deg, #e4d5c4 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            move(event.clientX, event.clientY, rect);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (event.buttons !== 1) return;
            move(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
          }}
        >
          <span
            className="absolute h-5 w-5 -translate-x-1/2 -translate-y-full rounded-full border-2 border-white bg-clay shadow"
            style={{ left: `${x}%`, top: `${y}%` }}
          />
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => nudge(0.004, 0)}>Norte</Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => nudge(-0.004, 0)}>Sur</Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => nudge(0, -0.004)}>Oeste</Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => nudge(0, 0.004)}>Este</Button>
        </div>
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
