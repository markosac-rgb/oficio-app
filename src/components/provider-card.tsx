import Link from "next/link";
import { formatDistance } from "@/lib/geo";
import { stars } from "@/lib/format";
import type { ProviderCard } from "@/lib/types";
import { Badge } from "@/components/ui";
import { DemoTag, ExampleTag } from "@/components/states";

export function ProviderCardView({ provider }: { provider: ProviderCard }) {
  return (
    <Link
      href={`/proveedores/${provider.id}`}
      data-testid={`provider-${provider.id}`}
      className="block rounded-3xl border border-line bg-sand p-4 shadow-sm"
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
  );
}
