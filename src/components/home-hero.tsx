"use client";

import Link from "next/link";
import { Bell, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { useBadges } from "@/components/shell";
import type { MarketplaceStats } from "@/lib/types";

export function HomeHero({
  name,
  place,
  question,
  queryName = "q",
  queryTestId,
  submitTestId,
  placeholder,
  value,
  onValue,
  onSubmit,
  onFilter,
}: {
  name: string;
  place: string;
  question: string;
  queryName?: string;
  queryTestId?: string;
  submitTestId?: string;
  placeholder: string;
  value?: string;
  onValue?: (value: string) => void;
  onSubmit?: () => void;
  onFilter?: () => void;
}) {
  const badges = useBadges();
  return (
    <section className="bg-gradient-to-b from-[#083d34] via-[#0e6b56] to-[#14906f] px-4 pt-4 pb-3 text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white/80">Hola 👋</p>
          <h1 className="text-2xl leading-tight font-extrabold tracking-tight">{name}</h1>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/perfil" className="inline-flex min-h-11 max-w-[9.5rem] items-center gap-1 rounded-full bg-white/15 px-3 text-sm font-bold">
            <MapPin size={16} className="shrink-0" />
            <span className="truncate">{place}</span>
          </Link>
          <Link href="/notificaciones" aria-label={badges.notifications ? `${badges.notifications} avisos nuevos` : "Avisos"} className="relative grid h-11 w-11 place-items-center rounded-full bg-white/10">
            <Bell size={18} />
            {badges.notifications > 0 ? (
              <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#e26d5a] px-1 text-[10px] font-extrabold">
                {badges.notifications}
              </span>
            ) : null}
          </Link>
        </div>
      </div>
      <p className="mt-3 text-2xl leading-tight font-extrabold">{question}</p>
      <form
        action="/buscar"
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          if (!onSubmit) return;
          event.preventDefault();
          onSubmit();
        }}
      >
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#5c6b66]" size={18} />
          <input
            name={queryName}
            data-testid={queryTestId}
            placeholder={placeholder}
            value={value}
            onChange={onValue ? (event) => onValue(event.target.value) : undefined}
            className="h-12 w-full rounded-2xl bg-white pr-3 pl-10 text-base font-semibold text-ink shadow-lg placeholder:font-medium placeholder:text-[#8b9894]"
          />
        </label>
        {onFilter ? (
          <button type="button" data-testid={submitTestId} onClick={onFilter} aria-label="Filtros" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-ink shadow-lg">
            <SlidersHorizontal size={20} />
          </button>
        ) : (
          <button type="submit" data-testid={submitTestId} aria-label="Buscar" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-ink shadow-lg">
            <SlidersHorizontal size={20} />
          </button>
        )}
      </form>
    </section>
  );
}

export function StatsStrip({ stats }: { stats: MarketplaceStats }) {
  const rating = stats.rating == null ? "—" : stats.rating.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <div className="bg-[#14906f] px-4 pb-4">
      <div className="rounded-3xl bg-white/15 px-2 py-3 text-white backdrop-blur-sm">
        {stats.exampleData ? (
          <p className="mb-2 text-center text-[11px] font-extrabold tracking-wide uppercase">Datos de ejemplo</p>
        ) : (
          <p className="mb-2 text-center text-[11px] font-extrabold tracking-wide uppercase">Cifras de la base</p>
        )}
        <div className="grid grid-cols-3 text-center">
          <Stat value={stats.providers.toLocaleString("es-MX")} label="Profesionales" />
          <Stat value={stats.categories.toLocaleString("es-MX")} label="Categorías" />
          <Stat value={rating} label="Calificación" />
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-1">
      <p className="text-xl font-extrabold">{value}</p>
      <p className="text-[11px] font-semibold text-white/80">{label}</p>
    </div>
  );
}
