"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BrickWall,
  Droplets,
  Flower2,
  Hammer,
  KeyRound,
  Paintbrush,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { CATEGORIES, DAY_LABELS, DAY_KEYS } from "@/lib/constants";
import { firstName, formatWhen, mxn, stars } from "@/lib/format";
import { formatDistance, fuzzyCoord } from "@/lib/geo";
import { fileToJpegDataUrl } from "@/lib/images";
import type { ProviderProfile, RequestSummary } from "@/lib/types";
import { ProviderCardView } from "@/components/provider-card";

const NearbyMap = dynamic(() => import("@/components/maps").then((mod) => mod.NearbyMap), {
  ssr: false,
  loading: () => <div data-testid="nearby-map" className="mt-3 h-56 rounded-3xl bg-sand" />,
});
import { useSession } from "@/components/session";
import { DemoTag, EmptyState, ErrorState, ExampleTag, LoadingBlock } from "@/components/states";
import { TrustList } from "@/components/trust";
import { Badge, Button, Card, Field, Input, TextArea } from "@/components/ui";
import { emptyAddress, LocationFields, type AddressValue } from "@/components/location-fields";

const ICONS = {
  droplets: Droplets,
  zap: Zap,
  hammer: Hammer,
  paintbrush: Paintbrush,
  wrench: Wrench,
  flower: Flower2,
  sparkles: Sparkles,
  key: KeyRound,
  brick: BrickWall,
};

type ClientHome = {
  role: "CLIENT";
  needsLocation: boolean;
  categories: typeof CATEGORIES;
  nearby: ProviderProfile[];
  featured: ProviderProfile[];
  activeRequests: RequestSummary[];
  locationKnown: boolean;
};

type ProviderHome = {
  role: "PROVIDER";
  incoming: RequestSummary[];
  active: RequestSummary[];
  earningsMxn: number;
  availableNow: boolean;
  profileReady: boolean;
  trade: string;
};

type AdminHome = {
  role: "ADMIN";
  summary: { openReports: number; users: Record<string, number>; requests: Record<string, number> };
};

export function HomeView() {
  const { user } = useSession();
  const [data, setData] = useState<ClientHome | ProviderHome | AdminHome | null>(null);
  const [error, setError] = useState("");

  function load() {
    setError("");
    api<ClientHome | ProviderHome | AdminHome>("/api/home")
      .then(setData)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo cargar el inicio."));
  }

  useEffect(() => {
    load();
  }, []);

  if (error) return <div className="px-4 py-6"><ErrorState message={error} onRetry={load} /></div>;
  if (!data || !user) return <LoadingBlock label="Cargando tu inicio…" />;

  if (data.role === "ADMIN") {
    return (
      <div className="px-4 pt-4 pb-28">
        <h1 className="text-2xl font-extrabold">Hola, {firstName(user.name)}</h1>
        <p className="mt-1 text-muted">Revisa personas, solicitudes y reportes.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Card><p className="text-sm text-muted">Reportes abiertos</p><p className="text-3xl font-extrabold">{data.summary.openReports}</p></Card>
          <Card><p className="text-sm text-muted">Cuentas</p><p className="text-3xl font-extrabold">{Object.values(data.summary.users).reduce((sum, n) => sum + n, 0)}</p></Card>
        </div>
        <Button asChild className="mt-4 w-full"><Link href="/admin">Abrir panel de administración</Link></Button>
      </div>
    );
  }

  if (data.role === "PROVIDER") {
    return (
      <div className="px-4 pt-4 pb-28">
        <h1 className="text-2xl font-extrabold">Hola, {firstName(user.name)}</h1>
        <p className="mt-1 text-muted">{data.trade || "Completa tu oficio para recibir trabajos."}</p>
        <Card className="mt-4">
          <p className="text-sm font-bold text-muted">Ingresos de trabajos terminados</p>
          <p className="text-3xl font-extrabold">{mxn(data.earningsMxn)} MXN</p>
          <p className="mt-1 text-sm text-muted">No es dinero depositado por Oficio. En la demo no hay cobro.</p>
          <p className="mt-2 font-bold">{data.availableNow ? "Apareces como disponible." : "No apareces como disponible."}</p>
        </Card>
        <Button asChild className="mt-4 w-full"><Link href="/panel">Ir a mi panel</Link></Button>
        <section className="mt-6">
          <h2 className="text-lg font-extrabold">Solicitudes nuevas</h2>
          <div className="mt-3 space-y-3">
            {data.incoming.length === 0 ? <EmptyState title="No hay solicitudes nuevas" body="Cuando alguien pida tu oficio cerca de tu zona, aparecerá aquí." /> : data.incoming.map((item) => <RequestLink key={item.id} item={item} />)}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-28">
      <h1 className="text-2xl font-extrabold">Hola, {firstName(user.name)}</h1>
      <p className="mt-1 text-base text-muted">
        {user.clientProfile?.locationSet ? `${user.clientProfile.neighborhood || "Tu zona"} · CP ${user.clientProfile.postalCode}` : "Agrega tu colonia para ver gente cerca."}
      </p>
      <form action="/buscar" className="mt-4">
        <label className="block text-sm font-extrabold" htmlFor="q-inicio">¿Qué necesitas?</label>
        <div className="mt-1.5 flex gap-2">
          <Input id="q-inicio" name="q" placeholder="Ejemplo: fuga, enchufe, pintar" />
          <Button type="submit">Buscar</Button>
        </div>
      </form>
      {data.needsLocation ? (
        <Card className="mt-4">
          <p className="font-extrabold">Falta tu ubicación</p>
          <p className="mt-1 text-sm leading-5 text-muted">Con tu colonia o código postal te mostramos a quien sí llega.</p>
          <Button asChild className="mt-3" variant="secondary"><Link href="/perfil">Agregar dirección</Link></Button>
        </Card>
      ) : null}
      <ol className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-extrabold">
        <li className="rounded-2xl bg-sand p-2">1. Elige oficio</li>
        <li className="rounded-2xl bg-sand p-2">2. Compara precio</li>
        <li className="rounded-2xl bg-sand p-2">3. Confirma cita</li>
      </ol>
      <h2 className="mt-6 text-lg font-extrabold">Cerca de ti</h2>
      <div className="mt-3">
        <NearbyMap
          testId="nearby-map"
          client={
            user.clientProfile?.locationSet
              ? { lat: fuzzyCoord(user.clientProfile.lat), lng: fuzzyCoord(user.clientProfile.lng) }
              : null
          }
          providers={data.nearby}
        />
      </div>
      <h2 className="mt-6 text-lg font-extrabold">Oficios</h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {CATEGORIES.map((category) => {
          const Icon = ICONS[category.icon as keyof typeof ICONS] ?? Wrench;
          return (
            <Link key={category.id} href={`/buscar?categoria=${category.id}`} className="rounded-3xl border border-line bg-sand p-3 text-center">
              <Icon className="mx-auto text-clay" />
              <span className="mt-1 block text-sm font-extrabold">{category.name}</span>
            </Link>
          );
        })}
      </div>
      {data.activeRequests.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-lg font-extrabold">Tus servicios en curso</h2>
          <div className="mt-3 space-y-3">{data.activeRequests.map((item) => <RequestLink key={item.id} item={item} />)}</div>
        </section>
      ) : (
        <p className="mt-6 text-sm text-muted">No tienes servicios en curso.</p>
      )}
      <section className="mt-6">
        <h2 className="text-lg font-extrabold">Disponibles cerca</h2>
        <div className="mt-3 space-y-3">
          {data.nearby.length === 0 ? <EmptyState title="Nadie disponible con esos filtros" body="Prueba otra colonia o revisa más tarde." /> : data.nearby.map((provider) => <ProviderCardView key={provider.id} provider={provider} />)}
        </div>
      </section>
      <section className="mt-6">
        <h2 className="text-lg font-extrabold">Bien calificados</h2>
        <div className="mt-3 space-y-3">
          {data.featured.length === 0 ? <EmptyState title="Aún no hay reseñas cerca" body="Los perfiles de ejemplo traen opiniones marcadas como ficticias." /> : data.featured.map((provider) => <ProviderCardView key={provider.id} provider={provider} />)}
        </div>
      </section>
    </div>
  );
}

function RequestLink({ item }: { item: RequestSummary }) {
  return (
    <Link href={`/solicitudes/${item.id}`} className="block rounded-3xl border border-line bg-sand p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-extrabold">{item.title}</p>
        <Badge tone="clay">{item.statusLabel}</Badge>
      </div>
      <p className="mt-1 text-sm text-muted">{item.neighborhood} · {item.counterpart}</p>
    </Link>
  );
}

type SearchResponse = { providers: ProviderProfile[]; locationKnown: boolean };

export function BuscarView() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useSession();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState(params.get("categoria") ?? "");
  const [maxKm, setMaxKm] = useState(params.get("km") ?? "15");
  const [maxPrice, setMaxPrice] = useState("");
  const [minRating, setMinRating] = useState("");
  const [available, setAvailable] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [sort, setSort] = useState("distance");
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const query = new URLSearchParams();
    if (q.trim()) query.set("q", q.trim());
    if (category) query.set("category", category);
    if (maxKm) query.set("maxKm", maxKm);
    if (maxPrice) query.set("maxPrice", maxPrice);
    if (minRating) query.set("minRating", minRating);
    if (available) query.set("available", "1");
    if (emergency) query.set("emergency", "1");
    query.set("sort", sort);
    setLoading(true);
    api<SearchResponse>(`/api/providers?${query.toString()}`)
      .then((data) => {
        setResult(data);
        setError("");
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo buscar."))
      .finally(() => setLoading(false));
  }, [q, category, maxKm, maxPrice, minRating, available, emergency, sort]);

  return (
    <div className="px-4 pt-4 pb-28">
      <h1 className="text-2xl font-extrabold">Buscar</h1>
      <p className="mt-1 text-muted">Por oficio, nombre o problema. Precios en MXN.</p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams();
          if (q) next.set("q", q);
          if (category) next.set("categoria", category);
          router.replace(`/buscar?${next.toString()}`);
        }}
      >
        <Input data-testid="search-input" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Fuga, Jorge, pintura…" />
        <Button data-testid="search-submit" type="submit">Buscar</Button>
      </form>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => setCategory("")} className={`shrink-0 rounded-full px-3 py-2 text-sm font-extrabold ${category === "" ? "bg-clay text-white" : "bg-white"}`}>Todos</button>
        {CATEGORIES.map((item) => (
          <button key={item.id} type="button" onClick={() => setCategory(item.id)} className={`shrink-0 rounded-full px-3 py-2 text-sm font-extrabold ${category === item.id ? "bg-clay text-white" : "bg-white"}`}>
            {item.name}
          </button>
        ))}
      </div>
      <details className="mt-3 rounded-3xl bg-sand p-3" open>
        <summary className="cursor-pointer font-extrabold">Filtros</summary>
        <div className="mt-3 space-y-3">
          <Field label="Distancia máxima">
            <div className="grid grid-cols-4 gap-2">
              {["5", "15", "30", "50"].map((km) => (
                <button key={km} type="button" onClick={() => setMaxKm(km)} className={`h-10 rounded-2xl text-sm font-extrabold ${maxKm === km ? "bg-ink text-white" : "bg-white"}`}>{km} km</button>
              ))}
            </div>
          </Field>
          <Field label="Precio máximo publicado" hint="Las cotizaciones pueden variar. Este filtro usa tarifas ya publicadas.">
            <Input inputMode="numeric" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value.replace(/\D/g, ""))} placeholder="800" />
          </Field>
          <Field label="Calificación mínima">
            <div className="grid grid-cols-3 gap-2">
              {[[ "", "Cualquiera" ], [ "3", "3+" ], [ "4", "4+" ]].map(([value, label]) => (
                <button key={label} type="button" onClick={() => setMinRating(value)} className={`h-10 rounded-2xl text-sm font-extrabold ${minRating === value ? "bg-ink text-white" : "bg-white"}`}>{label}</button>
              ))}
            </div>
          </Field>
          <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} className="h-5 w-5" /> Disponible ahora</label>
          <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={emergency} onChange={(event) => setEmergency(event.target.checked)} className="h-5 w-5" /> Atiende emergencias</label>
          <Field label="Orden">
            <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-12 w-full rounded-2xl border border-line bg-white px-3">
              <option value="distance">Cercanía</option>
              <option value="price">Precio</option>
              <option value="rating">Calificación</option>
            </select>
          </Field>
        </div>
      </details>
      <div className="mt-4">
        <NearbyMap
          testId="buscar-map"
          client={
            user?.clientProfile?.locationSet
              ? { lat: fuzzyCoord(user.clientProfile.lat), lng: fuzzyCoord(user.clientProfile.lng) }
              : null
          }
          providers={result?.providers ?? []}
        />
      </div>
      <div className="mt-4 space-y-3">
        {loading ? <LoadingBlock label="Buscando personas cerca…" /> : null}
        {error ? <ErrorState message={error} onRetry={() => setQ((value) => value)} /> : null}
        {!loading && result && !result.locationKnown ? <p className="text-sm font-bold">Sin tu dirección no podemos filtrar por kilómetros. Agrégala en Perfil.</p> : null}
        {!loading && result && result.providers.length === 0 ? <EmptyState title="No hay personas con esos filtros" body="Amplía la distancia, quita el precio o prueba otra palabra." /> : null}
        {result?.providers.map((provider) => <ProviderCardView key={provider.id} provider={provider} />)}
      </div>
    </div>
  );
}

export function ProviderView({ id }: { id: string }) {
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [error, setError] = useState("");
  const [favorite, setFavorite] = useState(false);

  function load() {
    api<ProviderProfile>(`/api/providers/${id}`)
      .then((data) => {
        setProvider(data);
        setFavorite(data.isFavorite);
        setError("");
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo abrir el perfil."));
  }

  useEffect(() => {
    load();
  }, [id]);

  if (error) return <div className="px-4 py-6"><ErrorState message={error} onRetry={load} /></div>;
  if (!provider) return <LoadingBlock label="Cargando el perfil…" />;

  return (
    <div className="px-4 pt-4 pb-32">
      <div className="flex items-start gap-3">
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-clay text-2xl font-extrabold text-white">{provider.name.slice(0, 1)}</div>
        <div>
          <div className="flex flex-wrap gap-2">
            {provider.isExample ? <ExampleTag /> : null}
            {provider.isDemo ? <DemoTag /> : null}
          </div>
          <h1 className="text-2xl font-extrabold">{provider.name}</h1>
          <p className="text-muted">{provider.trade} · {provider.experienceYears} años de experiencia declarados</p>
          <p className="mt-1 font-extrabold">{provider.rating == null ? "Sin reseñas" : `${stars(provider.rating)} de 5 · ${provider.reviewCount} reseñas`}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          data-testid="favorite"
          onClick={() => {
            void api(`/api/favorites/${provider.id}`, { method: favorite ? "DELETE" : "POST" }).then(() => setFavorite((value) => !value));
          }}
        >
          {favorite ? "En favoritos" : "Guardar en favoritos"}
        </Button>
        <Badge>{formatDistance(provider.distanceKm)}</Badge>
        {provider.availableNow ? <Badge tone="leaf">Disponible ahora</Badge> : <Badge>No disponible ahora</Badge>}
      </div>
      <p className="mt-4 text-base leading-6">{provider.bio}</p>
      <Card className="mt-4">
        <h2 className="font-extrabold">Confianza</h2>
        <div className="mt-2"><TrustList identityStatus={provider.identityStatus} certStatus={provider.certStatus} referencesStatus={provider.referencesStatus} /></div>
        {provider.referencesNote ? <p className="mt-2 text-sm leading-5">Nota del proveedor: {provider.referencesNote}</p> : null}
        <p className="mt-2 text-sm text-muted">Documentos en espera de revisión: {provider.documentsPending}. Eso no enciende una etiqueta verde.</p>
      </Card>
      <section className="mt-5">
        <h2 className="text-lg font-extrabold">Servicios y tarifas estimadas</h2>
        <div className="mt-3 space-y-3">
          {provider.services.map((service) => (
            <Card key={service.id}>
              <p className="font-extrabold">{service.title}</p>
              <p className="text-sm text-muted">{service.categoryName} · {service.unit}</p>
              <p className="mt-1 text-sm leading-5">{service.description}</p>
              <p className="mt-2 font-extrabold">
                {service.priceType === "QUOTE" ? "Precio por cotizar" : service.priceType === "FROM" ? `Desde ${mxn(service.priceMxn ?? 0)} MXN` : `${mxn(service.priceMxn ?? 0)} MXN`}
              </p>
              <Button asChild className="mt-3 w-full" data-testid={`request-service-${service.id}`}>
                <Link href={`/solicitar?proveedor=${provider.id}&servicio=${service.id}&categoria=${service.categoryId}`}>
                  {service.priceType === "FIXED" ? "Pedir con este precio" : "Pedir cotización"}
                </Link>
              </Button>
            </Card>
          ))}
        </div>
      </section>
      <Card className="mt-4">
        <h2 className="font-extrabold">Zona de cobertura</h2>
        <p className="mt-1">{provider.zoneLabel}</p>
        <p className="text-sm text-muted">{provider.city}, {provider.state} · hasta {provider.coverageKm} km · responde en unos {provider.responseMinutes} min</p>
        <p className="mt-2 text-sm text-muted">El punto es el centro de su zona de trabajo, no su domicilio. No mostramos su teléfono ni su correo: el contacto es por el chat.</p>
      </Card>
      <Card className="mt-4">
        <h2 className="font-extrabold">Horario</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {DAY_KEYS.map((day) => <li key={day} className="flex justify-between"><span>{DAY_LABELS[day]}</span><span className="font-bold">{provider.schedule[day]}</span></li>)}
        </ul>
      </Card>
      <section className="mt-5">
        <h2 className="text-lg font-extrabold">Trabajos anteriores</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {provider.photos.length === 0 ? <EmptyState title="Sin fotos todavía" body="Cuando publique trabajos, los verás aquí." /> : provider.photos.map((photo) => (
            <figure key={photo.id} className="overflow-hidden rounded-3xl border border-line">
              {photo.imageData ? <img src={photo.imageData} alt={photo.caption} className="h-28 w-full object-cover" /> : <div className="h-28" style={{ background: photo.tone }} />}
              <figcaption className="p-2 text-xs leading-4">{photo.caption}{photo.isExample ? " · Ejemplo ficticio" : ""}</figcaption>
            </figure>
          ))}
        </div>
      </section>
      <Card className="mt-4">
        <h2 className="font-extrabold">Si cancelan</h2>
        <p className="mt-1 text-sm leading-5">{provider.cancellationPolicy}</p>
        <Link href="/ayuda" className="mt-2 inline-block text-sm font-extrabold text-clay">Ver reglas de Oficio</Link>
      </Card>
      <section className="mt-5">
        <h2 className="text-lg font-extrabold">Reseñas</h2>
        <div className="mt-3 space-y-3">
          {provider.reviews.length === 0 ? <EmptyState title="Todavía no hay reseñas" body="La primera reseña aparece cuando un trabajo se marca como terminado." /> : provider.reviews.map((review) => (
            <Card key={review.id}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-extrabold">{review.authorName}</p>
                {review.isExample ? <ExampleTag /> : null}
                {!review.isExample && review.authorIsDemo ? <DemoTag /> : null}
                <span className="font-extrabold">{review.rating} de 5</span>
              </div>
              <p className="mt-1 text-sm leading-5">{review.comment}</p>
            </Card>
          ))}
        </div>
        {provider.exampleReviewCount > 0 ? <p className="mt-2 text-sm text-muted">Las reseñas con la etiqueta «Ejemplo ficticio» no son de clientes reales.</p> : null}
      </section>
    </div>
  );
}

export function SolicitarView() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useSession();
  const providerId = params.get("proveedor") ?? "";
  const serviceId = params.get("servicio") ?? "";
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [address, setAddress] = useState<AddressValue>(emptyAddress);
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"IMMEDIATE" | "SCHEDULED">("IMMEDIATE");
  const [preferred, setPreferred] = useState("");
  const [emergency, setEmergency] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const service = provider?.services.find((item) => item.id === serviceId) ?? provider?.services[0];

  useEffect(() => {
    if (!user?.clientProfile) return;
    const profile = user.clientProfile;
    setAddress({
      street: profile.street,
      neighborhood: profile.neighborhood,
      city: profile.city,
      state: profile.state,
      postalCode: profile.postalCode,
      reference: profile.reference,
      lat: profile.lat,
      lng: profile.lng,
    });
  }, [user]);

  useEffect(() => {
    if (!providerId) return;
    api<ProviderProfile>(`/api/providers/${providerId}`).then(setProvider).catch(() => setProvider(null));
  }, [providerId]);

  return (
    <div className="px-4 pt-4 pb-32">
      <h1 className="text-2xl font-extrabold">Pedir servicio</h1>
      <p className="mt-1 text-muted">Cuéntanos qué pasa. Si el precio no está publicado, primero te cotizan. No se cobra al enviar.</p>
      {provider && service ? (
        <Card className="mt-4">
          <p className="text-sm text-muted">Se lo pides a</p>
          <p className="font-extrabold">{provider.name} · {service.title}</p>
          <p className="text-sm">{service.priceType === "QUOTE" ? "Te va a cotizar." : service.priceType === "FIXED" ? `Precio publicado ${mxn(service.priceMxn ?? 0)} MXN. Igual tienes que aceptarlo.` : `Viste un desde ${mxn(service.priceMxn ?? 0)} MXN. El precio final llega en la cotización.`}</p>
        </Card>
      ) : (
        <Card className="mt-4">
          <p className="font-extrabold">Pedido abierto en tu zona</p>
          <Field label="Tipo de servicio">
            <select data-testid="open-category" className="h-12 w-full rounded-2xl border border-line bg-white px-3" id="open-category" defaultValue={params.get("categoria") ?? "plomeria"} onChange={(event) => router.replace(`/solicitar?categoria=${event.target.value}`)}>
              {CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </Field>
        </Card>
      )}
      <form
        className="mt-4 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          const categoryId = service?.categoryId || params.get("categoria") || "plomeria";
          void api<{ id: string }>("/api/requests", {
            method: "POST",
            body: JSON.stringify({
              description,
              photos,
              mode,
              emergency,
              preferredWindow: preferred,
              categoryId,
              targetProviderId: provider?.id,
              serviceOfferingId: service?.id,
              ...address,
            }),
          })
            .then((result) => router.push(`/solicitudes/${result.id}`))
            .catch((reason: unknown) => setError(reason instanceof ApiError ? reason.message : "No se pudo enviar la solicitud."))
            .finally(() => setBusy(false));
        }}
      >
        {error ? <ErrorState message={error} /> : null}
        <Field label="¿Qué necesitas?" hint="Entre más claro, mejor la cotización.">
          <TextArea data-testid="request-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Hay una fuga bajo el lavabo y el agua cae al piso." />
        </Field>
        <Field label="Fotos" hint="Hasta 3. Se reducen en tu celular antes de enviarse.">
          <input
            data-testid="request-photos"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              const files = [...(event.target.files ?? [])].slice(0, 3);
              void Promise.all(files.map((file) => fileToJpegDataUrl(file)))
                .then((urls) => setPhotos(urls))
                .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo leer la foto."));
            }}
          />
          {photos.length > 0 ? <p className="text-sm font-bold">{photos.length} foto(s) lista(s).</p> : null}
        </Field>
        <fieldset>
          <legend className="text-sm font-extrabold">¿Para cuándo?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode("IMMEDIATE")} className={`h-12 rounded-2xl font-extrabold ${mode === "IMMEDIATE" ? "bg-clay text-white" : "bg-white"}`}>Lo antes posible</button>
            <button type="button" onClick={() => setMode("SCHEDULED")} className={`h-12 rounded-2xl font-extrabold ${mode === "SCHEDULED" ? "bg-clay text-white" : "bg-white"}`}>Programar</button>
          </div>
          {mode === "SCHEDULED" ? <Input className="mt-2" value={preferred} onChange={(event) => setPreferred(event.target.value)} placeholder="Ejemplo: sábado por la mañana" /> : null}
          <p className="mt-1 text-sm text-muted">Esto es una preferencia. La cita se confirma después de aceptar la cotización.</p>
        </fieldset>
        <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={emergency} onChange={(event) => setEmergency(event.target.checked)} className="h-5 w-5" /> Es una emergencia</label>
        <LocationFields value={address} onChange={setAddress} showStreet legend="Usamos tu dirección guardada. Puedes corregirla." />
        <Button data-testid="request-submit" className="w-full" disabled={busy}>Enviar solicitud</Button>
      </form>
    </div>
  );
}
