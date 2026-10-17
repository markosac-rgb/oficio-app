"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { CANCELLATION_RULES, CATEGORIES, DAY_KEYS, DAY_LABELS, INTEGRATIONS, PAYMENT_METHODS } from "@/lib/constants";
import { formatPhone, formatWhen, mxn } from "@/lib/format";
import { fileToJpegDataUrl } from "@/lib/images";
import type { Achievement, AdminUser, NotificationItem, ProviderCard, ReportItem, RequestSummary } from "@/lib/types";
import { emptyAddress, LocationFields, type AddressValue } from "@/components/location-fields";
import { ProviderCardView } from "@/components/provider-card";
import { useSession } from "@/components/session";
import { DemoBanner, DemoTag, EmptyState, ErrorState, ExampleTag, LoadingBlock } from "@/components/states";
import { TrustList } from "@/components/trust";
import { Badge, Button, Card, Field, Input, TextArea } from "@/components/ui";

function errorText(reason: unknown) {
  return reason instanceof ApiError || reason instanceof Error ? reason.message : "Intenta de nuevo.";
}

type Dashboard = {
  profile: {
    id: string;
    trade: string;
    bio: string;
    experienceYears: number;
    coverageKm: number;
    zoneLabel: string;
    city: string;
    state: string;
    postalCode: string;
    lat: number;
    lng: number;
    availableNow: boolean;
    emergency: boolean;
    identityStatus: string;
    certStatus: string;
    referencesStatus: string;
    referencesNote: string;
    cancellationPolicy: string;
    responseMinutes: number;
    profileReady: boolean;
    schedule: Record<string, string>;
    services: { id: string; categoryId: string; title: string; description: string; priceType: string; priceMxn: number | null; unit: string }[];
    isExample: boolean;
    rating: number | null;
    reviewCount: number;
    exampleReviewCount: number;
    name?: string;
  };
  incoming: RequestSummary[];
  active: RequestSummary[];
  history: RequestSummary[];
  earningsMxn: number;
  earningsWeekMxn: number;
  feesShownMxn: number;
  completedJobs: number;
  completedThisWeek: number;
  streakDays: number;
  goalTarget: number;
  achievements: Achievement[];
  documents: { id: string; kind: string; label: string; status: string; note: string }[];
  trustNote: string;
};

export function PanelView() {
  const { user } = useSession();
  const [board, setBoard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [schedule, setSchedule] = useState<Record<string, string>>({});
  const [service, setService] = useState({ categoryId: "plomeria", title: "", description: "", priceType: "QUOTE", priceMxn: "", unit: "visita" });
  const [doc, setDoc] = useState({ kind: "INE", label: "" });
  const [photoCaption, setPhotoCaption] = useState("");

  function load() {
    api<Dashboard>("/api/provider/dashboard")
      .then((data) => {
        setBoard(data);
        setSchedule(data.profile.schedule);
        setError("");
      })
      .catch((reason: unknown) => setError(errorText(reason)));
  }
  useEffect(() => {
    if (user?.role === "PROVIDER") load();
  }, [user]);

  if (user && user.role !== "PROVIDER") {
    return (
      <div className="px-4 py-8 pb-28">
        <EmptyState title="Esta pantalla es para quien ofrece servicios" body="Si también haces trabajos, crea otra cuenta de proveedor." action={<Button asChild><Link href="/registro?rol=proveedor">Crear cuenta de proveedor</Link></Button>} />
      </div>
    );
  }
  if (error) return <div className="px-4 py-6"><ErrorState message={error} onRetry={load} /></div>;
  if (!board) return <LoadingBlock label="Cargando tu panel…" />;

  function saveAvailability(availableNow: boolean, emergency: boolean) {
    void api("/api/provider/availability", { method: "PATCH", body: JSON.stringify({ availableNow, emergency }) }).then(load);
  }

  return (
    <div className="space-y-4 px-4 pt-4 pb-32">
      <h1 className="text-2xl font-extrabold">Tu panel</h1>
      <p className="text-muted">{board.profile.profileReady ? "Ya puedes cotizar." : "Completa oficio, zona y un servicio para cotizar."}</p>
      {board.profile.isExample ? <ExampleTag /> : null}
      <Card>
        <p className="text-sm text-muted">Ingresos registrados esta semana</p>
        <p className="text-3xl font-extrabold">{mxn(board.earningsWeekMxn)} MXN</p>
        <p className="text-sm leading-5 text-muted">Desde el lunes, solo trabajos terminados con método registrado. No es un depósito. La comisión mostrada en total ({mxn(board.feesShownMxn)} MXN) no se cobra. Histórico: {mxn(board.earningsMxn)} MXN · {board.completedJobs} trabajos.</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-clay" style={{ width: `${Math.min(100, Math.round((board.completedThisWeek / Math.max(1, board.goalTarget)) * 100))}%` }} />
        </div>
        <p className="mt-2 text-sm font-bold">Meta de la semana: {board.completedThisWeek} de {board.goalTarget} trabajos. Racha: {board.streakDays} día{board.streakDays === 1 ? "" : "s"}.</p>
        <p className="text-sm font-bold">{board.profile.rating == null ? "Sin reseñas todavía." : `${board.profile.rating} de 5 · ${board.profile.reviewCount} reseñas${board.profile.exampleReviewCount ? " (incluye ejemplos)" : ""}`}</p>
      </Card>
      <div className="flex gap-2 overflow-x-auto">
        {board.achievements.map((item) => (
          <div key={item.id} className={`w-40 shrink-0 rounded-3xl border p-3 ${item.earned ? "border-clay bg-sand" : "border-line"}`}>
            <p className="text-xs font-extrabold uppercase text-muted">{item.earned ? "Conseguido" : "Pendiente"}</p>
            <p className="font-extrabold">{item.title}</p>
            <p className="text-xs leading-4 text-muted">{item.detail}</p>
          </div>
        ))}
      </div>
      <Card>
        <h2 className="font-extrabold">Disponibilidad</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button data-testid="availability-toggle" variant={board.profile.availableNow ? "leaf" : "secondary"} onClick={() => saveAvailability(!board.profile.availableNow, board.profile.emergency)}>
            {board.profile.availableNow ? "Estás disponible ahora" : "No apareces como disponible"}
          </Button>
          <Button variant={board.profile.emergency ? "default" : "secondary"} onClick={() => saveAvailability(board.profile.availableNow, !board.profile.emergency)}>
            {board.profile.emergency ? "Atiendes emergencias" : "Sin emergencias"}
          </Button>
        </div>
      </Card>
      <section>
        <h2 className="text-lg font-extrabold">Solicitudes para ti</h2>
        <div className="mt-3 space-y-3">
          {board.incoming.length === 0 ? <EmptyState title="No hay solicitudes nuevas" body="Cuando alguien pida tu oficio en tu zona, entra aquí para cotizar." /> : board.incoming.map((item) => (
            <Link key={item.id} href={`/solicitudes/${item.id}`} data-testid="provider-request" className="block rounded-3xl border border-line bg-sand p-4">
              <div className="flex justify-between gap-2"><p className="font-extrabold">{item.title}</p><Badge tone="clay">{item.statusLabel}</Badge></div>
              <p className="mt-1 text-sm leading-5">{item.description}</p>
              <p className="mt-1 text-sm text-muted">{item.neighborhood} · {item.counterpart}{item.myQuoteStatus ? ` · tu cotización: ${item.myQuoteStatus}` : ""}</p>
            </Link>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-lg font-extrabold">En curso</h2>
        <div className="mt-3 space-y-3">
          {board.active.length === 0 ? <p className="text-sm text-muted">No tienes trabajos confirmados.</p> : board.active.map((item) => (
            <Link key={item.id} href={`/solicitudes/${item.id}`} data-testid="provider-request" className="block rounded-3xl border border-line bg-white p-4">
              <p className="font-extrabold">{item.title}</p>
              <p className="text-sm">{item.statusLabel}{item.scheduledAt ? ` · ${formatWhen(item.scheduledAt)}` : ""}</p>
            </Link>
          ))}
        </div>
      </section>
      <Card>
        <h2 className="font-extrabold">Confianza</h2>
        <div className="mt-2"><TrustList identityStatus={board.profile.identityStatus} certStatus={board.profile.certStatus} referencesStatus={board.profile.referencesStatus} /></div>
        <p className="mt-2 text-sm leading-5">{board.trustNote}</p>
        <DemoBanner>Subir el nombre de un documento no te verifica. Falta un proveedor externo de identidad, y una persona administradora tiene que marcar la revisión.</DemoBanner>
        <ul className="mt-3 space-y-2 text-sm">
          {board.documents.map((item) => <li key={item.id}><strong>{item.kind}:</strong> {item.label} · {item.status === "pending" ? "en espera" : item.status}</li>)}
        </ul>
        <div className="mt-3 grid gap-2">
          <select value={doc.kind} onChange={(event) => setDoc({ ...doc, kind: event.target.value })} className="h-12 rounded-2xl border border-line bg-white px-3">
            <option value="INE">Identificación</option>
            <option value="CERT">Certificación del oficio</option>
            <option value="REFERENCE">Referencia</option>
          </select>
          <Input value={doc.label} onChange={(event) => setDoc({ ...doc, label: event.target.value })} placeholder="Nombre del documento, sin subir tu INE" />
          <Button variant="secondary" onClick={() => void api("/api/provider/documents", { method: "POST", body: JSON.stringify(doc) }).then(load).then(() => setNote("Quedó pendiente de revisión."))}>Enviar a revisión</Button>
        </div>
      </Card>
      <ProfileEditor board={board} onSaved={() => { setNote("Guardamos tu perfil."); load(); }} />
      <Card>
        <h2 className="font-extrabold">Agregar servicio</h2>
        <div className="mt-3 space-y-2">
          <select value={service.categoryId} onChange={(event) => setService({ ...service, categoryId: event.target.value })} className="h-12 w-full rounded-2xl border border-line bg-white px-3">
            {CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <Input value={service.title} onChange={(event) => setService({ ...service, title: event.target.value })} placeholder="Nombre del servicio" />
          <TextArea value={service.description} onChange={(event) => setService({ ...service, description: event.target.value })} placeholder="Qué incluye" />
          <select value={service.priceType} onChange={(event) => setService({ ...service, priceType: event.target.value })} className="h-12 w-full rounded-2xl border border-line bg-white px-3">
            <option value="QUOTE">Por cotizar</option>
            <option value="FIXED">Precio fijo</option>
            <option value="FROM">Desde</option>
          </select>
          {service.priceType !== "QUOTE" ? <Input inputMode="numeric" value={service.priceMxn} onChange={(event) => setService({ ...service, priceMxn: event.target.value })} placeholder="Precio en pesos" /> : null}
          <Button onClick={() => void api("/api/provider/services", { method: "POST", body: JSON.stringify({ ...service, priceMxn: Number(service.priceMxn) }) }).then(load)}>Publicar servicio</Button>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {board.profile.services.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2">
              <span>{item.title}</span>
              <button type="button" className="font-extrabold text-danger" onClick={() => void api(`/api/provider/services/${item.id}`, { method: "DELETE" }).then(load)}>Quitar</button>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="font-extrabold">Horario</h2>
        <div className="mt-3 space-y-2">
          {DAY_KEYS.map((day) => (
            <label key={day} className="grid grid-cols-[6rem_1fr] items-center gap-2 text-sm font-bold">
              {DAY_LABELS[day]}
              <Input value={schedule[day] ?? ""} onChange={(event) => setSchedule({ ...schedule, [day]: event.target.value })} />
            </label>
          ))}
          <Button variant="secondary" onClick={() => void api("/api/provider/schedule", { method: "PUT", body: JSON.stringify({ schedule }) }).then(() => setNote("Horario guardado."))}>Guardar horario</Button>
        </div>
      </Card>
      <Card>
        <h2 className="font-extrabold">Foto de un trabajo</h2>
        <Input className="mt-2" value={photoCaption} onChange={(event) => setPhotoCaption(event.target.value)} placeholder="Qué se ve en la foto" />
        <input
          className="mt-2"
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void fileToJpegDataUrl(file)
              .then((imageData) => api("/api/provider/photos", { method: "POST", body: JSON.stringify({ caption: photoCaption || "Trabajo", imageData }) }))
              .then(load);
          }}
        />
      </Card>
      <section>
        <h2 className="text-lg font-extrabold">Historial</h2>
        <div className="mt-3 space-y-2">
          {board.history.length === 0 ? <p className="text-sm text-muted">Cuando termines un trabajo, queda aquí.</p> : board.history.map((item) => (
            <Link key={item.id} href={`/solicitudes/${item.id}`} className="block rounded-2xl bg-white p-3 text-sm"><strong>{item.title}</strong> · {item.statusLabel}</Link>
          ))}
        </div>
      </section>
      {note ? <p className="font-bold">{note}</p> : null}
    </div>
  );
}

function ProfileEditor({ board, onSaved }: { board: Dashboard; onSaved: () => void }) {
  const profile = board.profile;
  const [form, setForm] = useState({
    trade: profile.trade,
    bio: profile.bio,
    experienceYears: String(profile.experienceYears),
    coverageKm: String(profile.coverageKm),
    zoneLabel: profile.zoneLabel,
    city: profile.city,
    state: profile.state,
    postalCode: profile.postalCode,
    lat: profile.lat,
    lng: profile.lng,
    referencesNote: profile.referencesNote,
    cancellationPolicy: profile.cancellationPolicy,
    responseMinutes: String(profile.responseMinutes),
  });
  return (
    <Card>
      <h2 className="font-extrabold">Tu oficio</h2>
      <div className="mt-3 space-y-2">
        <Input value={form.trade} onChange={(event) => setForm({ ...form, trade: event.target.value })} placeholder="Oficio" />
        <TextArea value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} />
        <Input value={form.zoneLabel} onChange={(event) => setForm({ ...form, zoneLabel: event.target.value })} placeholder="Zona" />
        <div className="grid grid-cols-2 gap-2">
          <Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="Ciudad" />
          <Input value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} placeholder="Estado" />
        </div>
        <Input value={form.coverageKm} onChange={(event) => setForm({ ...form, coverageKm: event.target.value })} placeholder="Kilómetros de cobertura" />
        <TextArea value={form.referencesNote} onChange={(event) => setForm({ ...form, referencesNote: event.target.value })} placeholder="Referencias que tú declaras" />
        <TextArea value={form.cancellationPolicy} onChange={(event) => setForm({ ...form, cancellationPolicy: event.target.value })} />
        <LocationFields
          showStreet={false}
          legend="Centro de la zona donde trabajas, no tu domicilio."
          value={{ ...emptyAddress, ...form, street: "", reference: "", neighborhood: form.zoneLabel }}
          onChange={(value: AddressValue) => setForm({ ...form, city: value.city, state: value.state, postalCode: value.postalCode, lat: value.lat, lng: value.lng, zoneLabel: value.neighborhood || form.zoneLabel })}
        />
        <Button
          onClick={() =>
            void api("/api/provider/profile", {
              method: "PATCH",
              body: JSON.stringify({
                ...form,
                experienceYears: Number(form.experienceYears),
                coverageKm: Number(form.coverageKm),
                responseMinutes: Number(form.responseMinutes),
              }),
            }).then(onSaved)
          }
        >
          Guardar perfil
        </Button>
      </div>
    </Card>
  );
}

export function ProfileView() {
  const { user, refresh } = useSession();
  const router = useRouter();
  const [address, setAddress] = useState<AddressValue>(emptyAddress);
  const [name, setName] = useState(user?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.clientProfile) return;
    setAddress({ ...user.clientProfile });
    setName(user.name);
  }, [user]);

  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  if (!user) return <LoadingBlock />;

  const checks = [
    { label: "Nombre", done: user.name.trim().length > 2 },
    { label: "Correo", done: Boolean(user.email) },
    { label: "Teléfono", done: Boolean(user.phone) },
    { label: user.role === "CLIENT" ? "Ubicación" : "Cuenta lista", done: user.role === "CLIENT" ? Boolean(user.clientProfile?.locationSet) : true },
  ];
  const progress = Math.round((checks.filter((item) => item.done).length / checks.length) * 100);

  return (
    <div className="space-y-4 px-4 pt-4 pb-32">
      <h1 className="text-2xl font-extrabold">Perfil</h1>
      <Card>
        <div className="flex flex-wrap gap-2">{user.isDemo ? <DemoTag /> : null}</div>
        <p className="mt-2 text-xl font-extrabold">{user.name}</p>
        <p className="text-sm text-muted">{user.role === "CLIENT" ? "Cliente" : user.role === "PROVIDER" ? "Proveedor" : "Administración"}</p>
        <p className="text-sm">{user.email}</p>
        <p className="text-sm">{formatPhone(user.phone)}</p>
        {user.authNote ? <p className="mt-2 text-sm leading-5">{user.authNote}</p> : null}
        <div className="mt-4">
          <div className="flex justify-between text-sm font-bold">
            <span>Perfil</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-clay" style={{ width: `${progress}%` }} />
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {checks.map((item) => (
              <li key={item.label} className="flex items-center justify-between">
                <span>{item.label}</span>
                <span className="font-extrabold">{item.done ? "Listo" : "Falta"}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
      <Button
        variant="secondary"
        onClick={() => {
          const next = !dark;
          setDark(next);
          document.documentElement.classList.toggle("dark", next);
          localStorage.setItem("oficio-theme", next ? "dark" : "light");
        }}
      >
        {dark ? "Usar modo claro" : "Usar modo oscuro"}
      </Button>
      <Field label="Tu nombre">
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Button
        variant="secondary"
        onClick={() => {
          void api("/api/me", { method: "PATCH", body: JSON.stringify({ name }) })
            .then(() => refresh())
            .then(() => setMessage("Nombre guardado."));
        }}
      >
        Guardar nombre
      </Button>
      {user.role === "CLIENT" ? (
        <Card>
          <h2 className="font-extrabold">Tu dirección</h2>
          <p className="mt-1 text-sm text-muted">La calle solo se comparte con el proveedor cuando el servicio queda confirmado.</p>
          <div className="mt-3">
            <LocationFields value={address} onChange={setAddress} showStreet legend="Colonia o código postal de la casa." />
          </div>
          <Button
            className="mt-3"
            onClick={() => {
              void api("/api/me/location", { method: "PATCH", body: JSON.stringify(address) })
                .then(() => refresh())
                .then(() => setMessage("Dirección guardada."))
                .catch((reason: unknown) => setError(errorText(reason)));
            }}
          >
            Guardar dirección
          </Button>
        </Card>
      ) : null}
      <Card data-testid="legal-acceptance">
        <h2 className="font-extrabold">Términos y privacidad</h2>
        <p className="mt-2 text-sm leading-6">
          {user.acceptedRulesAt
            ? `Aceptaste los términos y el aviso de privacidad (versión ${user.acceptedLegalVersion || "sin versión"}) el ${formatWhen(user.acceptedRulesAt)}.`
            : "Aún no hay una aceptación registrada en esta cuenta."}
        </p>
        <p className="text-sm leading-6">
          Finalidades secundarias: {user.acceptedSecondaryPurposes ? "aceptadas" : "no aceptadas"}.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/terminos" className="font-extrabold text-clay underline">Términos y condiciones</Link>
          {" · "}
          <Link href="/privacidad" className="font-extrabold text-clay underline">Aviso de privacidad</Link>
        </p>
      </Card>
      <div className="grid gap-2">
        {user.role === "PROVIDER" ? <Button asChild variant="secondary"><Link href="/panel">Editar mi oficio</Link></Button> : null}
        {user.role === "ADMIN" ? <Button asChild><Link href="/admin">Panel de administración</Link></Button> : null}
        <Button asChild variant="secondary"><Link href="/favoritos">Favoritos</Link></Button>
        <Button asChild variant="secondary"><Link href="/ayuda">Ayuda, cancelaciones y reportes</Link></Button>
      </div>
      <Card>
        <h2 className="font-extrabold">Contraseña</h2>
        {user.authNote.includes("Google") ? <p className="text-sm">Esta cuenta de Google simulado no tiene contraseña.</p> : null}
        <div className="mt-2 space-y-2">
          <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Contraseña actual" />
          <Input type="password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} placeholder="Nueva contraseña" />
          <Button
            variant="secondary"
            onClick={() => {
              void api("/api/me/password", { method: "PATCH", body: JSON.stringify({ currentPassword, nextPassword }) })
                .then(() => setMessage("Contraseña actualizada."))
                .catch((reason: unknown) => setError(errorText(reason)));
            }}
          >
            Cambiar contraseña
          </Button>
        </div>
      </Card>
      {message ? <p className="font-bold">{message}</p> : null}
      {error ? <ErrorState message={error} /> : null}
      <Button
        variant="danger"
        data-testid="logout"
        onClick={() => {
          void api("/api/auth/logout", { method: "POST" }).then(() => refresh()).then(() => router.push("/"));
        }}
      >
        Cerrar sesión
      </Button>
    </div>
  );
}

export function FavoritesView() {
  const [providers, setProviders] = useState<ProviderCard[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ providers: ProviderCard[] }>("/api/favorites")
      .then((data) => setProviders(data.providers))
      .catch((reason: unknown) => setError(errorText(reason)));
  }, []);
  return (
    <div className="px-4 pt-4 pb-28">
      <h1 className="text-2xl font-extrabold">Favoritos</h1>
      <div className="mt-4 space-y-3">
        {error ? <ErrorState message={error} /> : null}
        {providers === null && !error ? <LoadingBlock label="Cargando favoritos…" /> : null}
        {providers && providers.length === 0 ? <EmptyState title="Aún no guardas a nadie" body="En el perfil de una persona, toca Guardar en favoritos para volver a encontrarla." /> : null}
        {providers?.map((provider) => <ProviderCardView key={provider.id} provider={provider} />)}
      </div>
    </div>
  );
}

export function NotificationsView() {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  useEffect(() => {
    api<{ items: NotificationItem[] }>("/api/notifications")
      .then((data) => {
        setItems(data.items);
        void api("/api/notifications/read", { method: "POST" });
      })
      .catch(() => setItems([]));
  }, []);
  return (
    <div className="px-4 pt-4 pb-28">
      <h1 className="text-2xl font-extrabold">Avisos</h1>
      <p className="mt-1 text-sm text-muted">Llegan dentro de la app. El aviso al celular llegará cuando exista la app nativa.</p>
      <div className="mt-4 space-y-3">
        {items === null ? <LoadingBlock label="Cargando avisos…" /> : null}
        {items && items.length === 0 ? <EmptyState title="No tienes avisos" body="Aquí verás cotizaciones, cambios de estado y mensajes." /> : null}
        {items?.map((item) => (
          <Link key={item.id} href={item.href} className="block rounded-3xl border border-line bg-sand p-4">
            <p className="font-extrabold">{item.title}</p>
            <p className="text-sm leading-5">{item.body}</p>
            <p className="text-xs text-muted">{formatWhen(item.createdAt)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function HelpView() {
  const [description, setDescription] = useState("");
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="space-y-4 px-4 pt-4 pb-32">
      <h1 className="text-2xl font-extrabold">Ayuda</h1>
      <p className="text-muted">Reglas en palabras simples. Si algo falla, escribe y una persona lo revisa.</p>
      <Card>
        <h2 className="font-extrabold">Cómo pedir</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6">
          <li>Elige el oficio o describe el problema.</li>
          <li>Si no hay precio publicado, espera la cotización y acéptala o recházala.</li>
          <li>Confirma fecha y hora.</li>
          <li>Elige el método. Revisa el desglose antes.</li>
          <li>Sigue el estado y, al terminar, deja una reseña.</li>
        </ol>
      </Card>
      <Card>
        <h2 className="font-extrabold">Cancelaciones</h2>
        <ul className="mt-2 space-y-2 text-sm leading-5">{CANCELLATION_RULES.map((rule) => <li key={rule}>{rule}</li>)}</ul>
      </Card>
      <Card>
        <h2 className="font-extrabold">Pagos</h2>
        <p className="mt-1 text-sm">La comisión de la plataforma es 10% y se muestra antes de confirmar. En esta demo no se cobra.</p>
        <div className="mt-3 space-y-3">
          {PAYMENT_METHODS.map((method) => (
            <div key={method.id}>
              <p className="font-extrabold">{method.name}</p>
              <p className="text-sm leading-5">{method.protection}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card id="confianza">
        <h2 className="font-extrabold">Verificación</h2>
        <p className="mt-1 text-sm leading-5">Identidad verificada: una persona del equipo revisó una identificación. Certificaciones revisadas: vio un documento del oficio. Referencias: lo que el proveedor declara; «revisadas» solo si el equipo las confirmó. Si no ves la etiqueta verde, no está revisado.</p>
      </Card>
      <Card>
        <h2 className="font-extrabold">Tu dirección</h2>
        <p className="mt-1 text-sm leading-5">Antes de confirmar, el proveedor ve colonia, ciudad y código postal, con un punto aproximado. La calle se comparte solo con quien va a hacer el trabajo ya confirmado. No publicamos el teléfono del proveedor.</p>
      </Card>
      <Card id="integraciones">
        <h2 className="font-extrabold">Qué está simulado</h2>
        <ul className="mt-2 space-y-3 text-sm leading-5">
          {INTEGRATIONS.map((item) => (
            <li key={item.id}>
              <p className="font-extrabold">{item.name}</p>
              <p>Hoy: {item.now}</p>
              <p>Falta conectar: {item.needed}.</p>
            </li>
          ))}
        </ul>
      </Card>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void api<{ message: string }>("/api/reports", { method: "POST", body: JSON.stringify({ kind: "HELP", description }) })
            .then((result) => setDone(result.message))
            .catch((reason: unknown) => setError(errorText(reason)));
        }}
      >
        <Field label="Cuéntanos qué necesitas">
          <TextArea value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <Button type="submit">Enviar a ayuda</Button>
        {done ? <p className="text-sm font-bold">{done}</p> : null}
        {error ? <ErrorState message={error} /> : null}
      </form>
    </div>
  );
}

type Summary = { openReports: number; users: Record<string, number>; requests: Record<string, number> };

export function AdminView() {
  const { user } = useSession();
  const [tab, setTab] = useState<"personas" | "solicitudes" | "reportes">("personas");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [demoData, setDemoData] = useState(true);

  function load() {
    if (user?.role !== "ADMIN") return;
    Promise.all([
      api<Summary>("/api/admin/summary"),
      api<{ users: AdminUser[] }>("/api/admin/users"),
      api<{ requests: RequestSummary[] }>("/api/admin/requests"),
      api<{ reports: ReportItem[] }>("/api/admin/reports"),
      api<{ demoData: boolean }>("/api/admin/settings"),
    ])
      .then(([nextSummary, nextUsers, nextRequests, nextReports, settings]) => {
        setSummary(nextSummary);
        setUsers(nextUsers.users);
        setRequests(nextRequests.requests);
        setReports(nextReports.reports);
        setDemoData(settings.demoData);
        setError("");
      })
      .catch((reason: unknown) => setError(errorText(reason)));
  }
  useEffect(() => {
    load();
  }, [user]);

  if (user && user.role !== "ADMIN") {
    return <div className="px-4 py-8"><EmptyState title="Solo administración" body="Entra con la cuenta admin de demostración." /></div>;
  }
  if (error) return <div className="px-4 py-6"><ErrorState message={error} onRetry={load} /></div>;
  if (!summary) return <LoadingBlock label="Cargando el panel…" />;

  return (
    <div className="px-4 pt-4 pb-32">
      <h1 className="text-2xl font-extrabold">Administración</h1>
      <p className="mt-1 text-sm text-muted">Marcar verificado es una acción tuya. Nada se aprueba solo.</p>
      <Card className="mt-3">
        <p className="font-extrabold">Datos de ejemplo</p>
        <p className="mt-1 text-sm leading-5 text-muted">
          {demoData
            ? "Los perfiles ficticios se muestran y las cifras los incluyen, con la etiqueta Datos de ejemplo. Las cuentas reales se suman a esos conteos."
            : "Los perfiles de ejemplo están ocultos. Inicio, búsqueda y cifras usan solo cuentas reales."}
        </p>
        <Button
          className="mt-3"
          variant={demoData ? "secondary" : "default"}
          data-testid="admin-demo-toggle"
          onClick={() => {
            void api<{ demoData: boolean }>("/api/admin/settings", { method: "POST", body: JSON.stringify({ demoData: !demoData }) })
              .then((result) => {
                setDemoData(result.demoData);
                setNote(result.demoData ? "Los ejemplos vuelven a verse." : "Ocultamos los perfiles de ejemplo.");
              });
          }}
        >
          {demoData ? "Ocultar datos de ejemplo" : "Mostrar datos de ejemplo"}
        </Button>
      </Card>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Card><p className="text-2xl font-extrabold">{summary.openReports}</p><p className="text-xs font-bold">Reportes abiertos</p></Card>
        <Card><p className="text-2xl font-extrabold">{summary.users.PROVIDER ?? 0}</p><p className="text-xs font-bold">Proveedores</p></Card>
        <Card><p className="text-2xl font-extrabold">{summary.users.CLIENT ?? 0}</p><p className="text-xs font-bold">Clientes</p></Card>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {(["personas", "solicitudes", "reportes"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={`h-10 rounded-2xl text-sm font-extrabold capitalize ${tab === item ? "bg-clay text-white" : "bg-white"}`}>{item}</button>
        ))}
      </div>
      {note ? <p className="mt-3 text-sm font-bold">{note}</p> : null}
      {tab === "personas" ? (
        <div className="mt-4 space-y-3">
          {users.map((item) => (
            <Card key={item.id}>
              <div className="flex flex-wrap gap-2">
                <p className="font-extrabold">{item.name}</p>
                <Badge>{item.role === "CLIENT" ? "Cliente" : item.role === "PROVIDER" ? "Proveedor" : "Admin"}</Badge>
                {item.isDemo ? <DemoTag /> : null}
                {item.isExample ? <ExampleTag /> : null}
                {item.suspended ? <Badge tone="danger">Suspendida</Badge> : null}
              </div>
              <p className="text-sm text-muted">{item.email} · {formatPhone(item.phone)} {item.trade ? `· ${item.trade}` : ""}</p>
              {item.providerId ? (
                <div className="mt-2 space-y-2">
                  <p className="text-xs">Identidad: {item.identityStatus || "none"} · Certificaciones: {item.certStatus || "none"} · Referencias: {item.referencesStatus || "none"}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void api(`/api/admin/providers/${item.providerId}/checks`, { method: "POST", body: JSON.stringify({ identityStatus: "verified" }) }).then(() => { setNote("Identidad marcada como verificada."); load(); })}>Marcar identidad verificada</Button>
                    <Button size="sm" variant="secondary" onClick={() => void api(`/api/admin/providers/${item.providerId}/checks`, { method: "POST", body: JSON.stringify({ certStatus: "reviewed" }) }).then(load)}>Marcar certificaciones revisadas</Button>
                    <Button size="sm" variant="secondary" onClick={() => void api(`/api/admin/providers/${item.providerId}/checks`, { method: "POST", body: JSON.stringify({ referencesStatus: "reviewed" }) }).then(load)}>Marcar referencias revisadas</Button>
                    <Button size="sm" variant="ghost" onClick={() => void api(`/api/admin/providers/${item.providerId}/checks`, { method: "POST", body: JSON.stringify({ identityStatus: "none", certStatus: "none", referencesStatus: "declared" }) }).then(load)}>Quitar marcas</Button>
                  </div>
                </div>
              ) : null}
              {item.id !== user?.id ? (
                <Button className="mt-2" size="sm" variant={item.suspended ? "secondary" : "danger"} onClick={() => void api(`/api/admin/users/${item.id}`, { method: "PATCH", body: JSON.stringify({ suspended: !item.suspended }) }).then(load)}>
                  {item.suspended ? "Reactivar" : "Suspender"}
                </Button>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}
      {tab === "solicitudes" ? (
        <div className="mt-4 space-y-3">
          {requests.length === 0 ? <EmptyState title="No hay solicitudes" body="Cuando alguien pida un servicio, aparecerá aquí." /> : null}
          {requests.map((item) => (
            <Link key={item.id} href={`/solicitudes/${item.id}`} className="block rounded-3xl border border-line bg-sand p-4">
              <p className="font-extrabold">{item.title}</p>
              <p className="text-sm">{item.statusLabel} · {item.neighborhood} · {item.counterpart}</p>
            </Link>
          ))}
        </div>
      ) : null}
      {tab === "reportes" ? (
        <div className="mt-4 space-y-3">
          {reports.length === 0 ? <EmptyState title="No hay reportes" body="Ayuda, problemas y aclaraciones llegan aquí." /> : null}
          {reports.map((item) => (
            <Card key={item.id}>
              <div className="flex justify-between gap-2"><p className="font-extrabold">{item.kind}</p><Badge>{item.status}</Badge></div>
              <p className="text-sm">{item.reporterName}</p>
              <p className="mt-1 text-sm leading-5">{item.description}</p>
              <ReportEditor
                item={item}
                onSave={(status, adminNote) => {
                  void api(`/api/admin/reports/${item.id}`, { method: "PATCH", body: JSON.stringify({ status, adminNote }) }).then(() => {
                    setNote("Reporte actualizado. Resolverlo no mueve dinero.");
                    load();
                  });
                }}
              />
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReportEditor({ item, onSave }: { item: ReportItem; onSave: (status: string, note: string) => void }) {
  const [status, setStatus] = useState(item.status);
  const [adminNote, setAdminNote] = useState(item.adminNote);
  return (
    <div className="mt-2 space-y-2">
      <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 w-full rounded-2xl border border-line bg-white px-3 text-sm">
        <option value="OPEN">Abierto</option>
        <option value="IN_REVIEW">En revisión</option>
        <option value="RESOLVED">Resuelto</option>
      </select>
      <TextArea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="Nota para quien reportó" />
      <Button size="sm" onClick={() => onSave(status, adminNote)}>Guardar reporte</Button>
    </div>
  );
}
