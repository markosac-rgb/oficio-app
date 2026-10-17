"use client";

import Link from "next/link";
import { Heart, Star } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { formatDistance } from "@/lib/geo";
import type { ProviderCard } from "@/lib/types";
import { Avatar, TradeArt } from "@/components/trade-art";

export function FeaturedCard({ provider, favorite, onChange }: { provider: ProviderCard; favorite: boolean; onChange?: (id: string, next: boolean) => void }) {
  const [saved, setSaved] = useState(favorite);
  const verified = provider.identityStatus === "verified";
  const price = provider.hourlyMxn != null ? `$${provider.hourlyMxn.toLocaleString("es-MX")}/h` : provider.priceLabel;

  function toggle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const next = !saved;
    setSaved(next);
    void api(`/api/favorites/${provider.id}`, { method: next ? "POST" : "DELETE" })
      .then(() => onChange?.(provider.id, next))
      .catch(() => setSaved(!next));
  }

  return (
    <div className="relative w-[240px] shrink-0 snap-start">
      <Link href={`/proveedores/${provider.id}`} data-testid={`provider-${provider.id}`} className="pressable block overflow-hidden rounded-3xl bg-sand shadow-[0_10px_30px_rgb(8_40_32/0.08)]">
        <div className="relative h-[148px]">
          <TradeArt trade={provider.trade} className="h-full w-full object-cover" />
          <span className={`absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs font-extrabold ${verified ? "bg-[#e8f8ef] text-[#146c43]" : "bg-white/90 text-ink"}`}>
            {verified ? "Verificado" : "Sin verificar"}
          </span>
          <span className="absolute right-3 bottom-3 rounded-full bg-ink px-2.5 py-1 text-xs font-extrabold text-white">{price}</span>
        </div>
        <div className="p-3">
          {provider.isExample ? <p className="mb-1 text-[11px] font-extrabold tracking-wide text-gold uppercase">Datos de ejemplo</p> : null}
          <div className="flex items-center gap-2">
            <Avatar name={provider.name} className="h-9 w-9 text-sm" />
            <div className="min-w-0">
              <p className="truncate font-extrabold">{provider.name}</p>
              <p className="truncate text-sm text-muted">{provider.trade}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm font-bold">
            <span className="inline-flex items-center gap-1">
              <Star size={14} className="fill-amber text-amber" />
              {provider.rating == null ? "Sin reseñas" : `${provider.rating} (${provider.reviewCount})`}
            </span>
            <span className="text-muted">{formatDistance(provider.distanceKm)}</span>
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={saved}
        aria-label={saved ? `Quitar a ${provider.name} de favoritos` : `Guardar a ${provider.name} en favoritos`}
        className="absolute top-3 right-3 grid h-11 w-11 place-items-center rounded-full bg-white/95 text-ink shadow"
      >
        <Heart size={18} className={saved ? "fill-[#e26d5a] text-[#e26d5a]" : ""} />
      </button>
    </div>
  );
}

export function Row({ title, href, testId, children }: { title: string; href?: string; testId?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6" data-testid={testId}>
      <div className="flex items-end justify-between gap-3 px-4">
        <h2 className="text-lg font-extrabold">{title}</h2>
        {href ? (
          <Link href={href} className="inline-flex min-h-11 items-center text-sm font-extrabold text-clay">
            Ver todas
          </Link>
        ) : null}
      </div>
      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-1 snap-x">{children}</div>
    </section>
  );
}
