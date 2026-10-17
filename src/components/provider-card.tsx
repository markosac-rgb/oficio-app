"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { formatDistance } from "@/lib/geo";
import { stars } from "@/lib/format";
import type { ProviderCard } from "@/lib/types";
import { Badge } from "@/components/ui";
import { DemoTag, ExampleTag } from "@/components/states";

export function ProviderCardView({ provider }: { provider: ProviderCard }) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="relative">
    <Link
      href={`/proveedores/${provider.id}`}
      data-testid={`provider-${provider.id}`}
      className="pressable block rounded-3xl border border-line bg-sand p-4 pr-14 shadow-sm"
    >
      <div className="flex gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-clay text-lg font-extrabold text-white">
          {provider.name.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-extrabold">{provider.name}</h2>
            {provider.isExample ? <ExampleTag /> : null}
            {provider.isDemo ? <DemoTag /> : null}
          </div>
          <p className="text-base text-muted">{provider.trade}</p>
          <p className="mt-1 text-sm font-bold">
            {provider.rating == null ? "Sin reseñas todavía" : `${stars(provider.rating)} · ${provider.reviewCount} reseñas`}
            {provider.exampleReviewCount > 0 ? " · incluye ejemplos" : ""}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold">
        <Badge>{provider.priceLabel}</Badge>
        <Badge tone="sand">{formatDistance(provider.distanceKm)}</Badge>
        {provider.availableNow ? <Badge tone="leaf">Disponible ahora</Badge> : <Badge>No disponible ahora</Badge>}
        {provider.emergency && provider.availableNow ? <Badge tone="clay">Atiende emergencias</Badge> : null}
        {provider.identityStatus === "verified" ? <Badge tone="leaf">Identidad verificada</Badge> : null}
      </div>
      <p className="mt-2 text-sm text-muted">
        {provider.zoneLabel} · {provider.city}
      </p>
    </Link>
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Quitar a ${provider.name} de favoritos` : `Guardar a ${provider.name} en favoritos`}
      className="absolute top-3 right-3 grid h-11 w-11 place-items-center rounded-full bg-paper"
      onClick={() => {
        const next = !saved;
        setSaved(next);
        void api(`/api/favorites/${provider.id}`, { method: next ? "POST" : "DELETE" }).catch(() => setSaved(!next));
      }}
    >
      <Heart size={18} className={saved ? "fill-[#e26d5a] text-[#e26d5a]" : ""} />
    </button>
    </div>
  );
}
