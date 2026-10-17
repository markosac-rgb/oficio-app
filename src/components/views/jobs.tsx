"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SuccessBanner, useCelebration } from "@/components/celebrate";
import { ADVANCE_LABEL, PAYMENT_METHODS, STATUS_LABEL, STATUS_ORDER, breakdown } from "@/lib/constants";
import { api, ApiError } from "@/lib/api";
import { formatWhen, mxn } from "@/lib/format";
import { fileToJpegDataUrl } from "@/lib/images";
import { statusHeadline } from "@/lib/status";
import type { ChatMessage, RequestDetail, RequestSummary, ThreadSummary } from "@/lib/types";
import { useSession } from "@/components/session";
import { DemoBanner, EmptyState, ErrorState, ExampleTag, LoadingBlock } from "@/components/states";
import { Badge, Button, Card, Dialog, Field, Input, TextArea } from "@/components/ui";

const ZoneMap = dynamic(() => import("@/components/maps").then((mod) => mod.ZoneMap), {
  ssr: false,
  loading: () => <div data-testid="zone-map" className="mt-3 h-56 rounded-3xl bg-sand" />,
});

const CONFIRMED = ["CONFIRMED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED"];

function errorText(reason: unknown) {
  return reason instanceof ApiError || reason instanceof Error ? reason.message : "Intenta de nuevo.";
}

export function RequestsView() {
  const { user } = useSession();
  const [items, setItems] = useState<RequestSummary[] | null>(null);
  const [error, setError] = useState("");

  function load() {
    api<{ requests: RequestSummary[] }>("/api/requests")
      .then((data) => {
        setItems(data.requests);
        setError("");
      })
      .catch((reason: unknown) => setError(errorText(reason)));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="px-4 pt-4 pb-28">
      <h1 className="text-2xl font-extrabold">Reservas</h1>
      <p className="mt-1 text-muted">{user?.role === "PROVIDER" ? "Trabajos que te pidieron o que están en tu zona." : "Tus servicios, del pedido a la reseña."}</p>
      <div className="mt-4 space-y-3">
        {error ? <ErrorState message={error} onRetry={load} /> : null}
        {items === null && !error ? <LoadingBlock label="Cargando solicitudes…" /> : null}
        {items && items.length === 0 ? (
          <EmptyState title="Todavía no hay solicitudes" body="Cuando pidas un servicio, o cuando te llegue uno, lo verás aquí." action={<Button asChild><Link href="/buscar">Buscar un oficio</Link></Button>} />
        ) : null}
        {items?.map((item) => (
          <Link key={item.id} href={`/solicitudes/${item.id}`} data-testid="request-card" className="block rounded-3xl border border-line bg-sand p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="font-extrabold">{item.title}</p>
              <Badge tone="clay">{item.statusLabel}</Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-sm leading-5">{item.description}</p>
            <p className="mt-2 text-sm text-muted">{item.neighborhood}, {item.city} · {item.counterpart}</p>
            {item.scheduledAt ? <p className="text-sm font-bold">Cita: {formatWhen(item.scheduledAt)}</p> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}

function Timeline({ request }: { request: RequestDetail }) {
  if (request.status === "CANCELLED") {
    return <p className="rounded-2xl bg-[#fff5f6] px-3 py-2 font-bold text-danger">Cancelado. {request.cancelReason}</p>;
  }
  const visual = request.status === "QUOTED" && request.selectedQuoteId ? "CONFIRMED" : request.status;
  const current = STATUS_ORDER.indexOf(visual as (typeof STATUS_ORDER)[number]);
  return (
    <ol className="space-y-3">
      {STATUS_ORDER.map((step, index) => {
        const state = index < current ? "Hecho" : index === current ? "Ahora" : "Después";
        const label = step === "CONFIRMED" && request.status === "QUOTED" && request.selectedQuoteId ? "Confirmar cita" : STATUS_LABEL[step];
        return (
          <li key={step} className="flex items-center gap-3">
            <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-extrabold ${index < current ? "bg-leaf text-white" : index === current ? "bg-clay text-white" : "bg-line text-muted"}`}>{index < current ? "✓" : index + 1}</span>
            <span className="font-bold">{label}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${index === current ? "bg-clay text-white" : "text-muted"}`}>{state}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function RequestDetailView({ id }: { id: string }) {
  const router = useRouter();
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [amount, setAmount] = useState("");
  const [quoteMessage, setQuoteMessage] = useState("");
  const [eta, setEta] = useState("45");
  const [date, setDate] = useState("2026-10-20");
  const [time, setTime] = useState("10:00");
  const [acceptId, setAcceptId] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [report, setReport] = useState("");
  const [reportDone, setReportDone] = useState("");
  const party = useCelebration();
  const [doneParty, setDoneParty] = useState<string | null>(null);

  function load(silent = false) {
    api<RequestDetail>(`/api/requests/${id}`)
      .then((data) => {
        setRequest(data);
        setError("");
      })
      .catch((reasonError: unknown) => {
        if (!silent) setError(errorText(reasonError));
      });
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), 12000);
    return () => window.clearInterval(timer);
  }, [id]);

  if (error) return <div className="px-4 py-6"><ErrorState message={error} onRetry={() => load()} /></div>;
  if (!request) return <LoadingBlock label="Cargando la solicitud…" />;
  const cheapest = request.quotes.filter((quote) => quote.status === "PENDING").reduce((min, quote) => Math.min(min, quote.amountMxn), Number.POSITIVE_INFINITY);

  return (
    <div className="px-4 pt-4 pb-32">
      <SuccessBanner kind={party || doneParty} />
      <p className="text-sm font-extrabold text-clay">{request.categoryName}</p>
      <h1 className="text-2xl font-extrabold">{request.title}</h1>
      <p className="mt-1 text-lg font-extrabold">{statusHeadline(request.status, request.selectedQuoteId)}</p>
      <Card className="mt-4"><Timeline request={request} /></Card>
      <Card className="mt-4">
        <h2 className="font-extrabold">Qué se pidió</h2>
        <p className="mt-1 whitespace-pre-wrap text-base leading-6">{request.description}</p>
        {request.emergency ? <p className="mt-2 font-bold text-clay">Marcado como emergencia.</p> : null}
        <p className="mt-2 text-sm text-muted">Preferencia: {request.preferredWindow}. Cliente: {request.clientName}</p>
        {request.photos.length > 0 ? (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {request.photos.map((photo) => <img key={photo.slice(0, 32)} src={photo} alt="Foto del problema" className="h-24 w-full rounded-2xl object-cover" />)}
          </div>
        ) : <p className="mt-2 text-sm text-muted">Sin fotos.</p>}
      </Card>
      {request.exactAddress ? (
        <Card className="mt-4" data-testid="exact-address">
          <h2 className="font-extrabold">Dirección exacta</h2>
          <p>{request.exactAddress.street}</p>
          <p>{request.exactAddress.reference}</p>
          <p className="text-sm text-muted">{request.neighborhood}, {request.city}, CP {request.postalCode}</p>
        </Card>
      ) : (
        <Card className="mt-4" data-testid="address-hidden">
          <h2 className="font-extrabold">Ubicación aproximada</h2>
          <p>{request.neighborhood}, {request.city}</p>
          <p>CP {request.postalCode}</p>
          <p className="mt-2 text-sm leading-5 text-muted">La calle y las referencias se comparten solo con quien haga el trabajo, cuando la cita quede confirmada.</p>
        </Card>
      )}
      <div className="mt-3">
        <ZoneMap
          testId={CONFIRMED.includes(request.status) && request.exactAddress ? "exact-map" : "zone-map"}
          lat={request.fuzzyLat}
          lng={request.fuzzyLng}
          exact={CONFIRMED.includes(request.status) && request.exactAddress ? { lat: request.exactAddress.lat, lng: request.exactAddress.lng } : null}
        />
      </div>

      <section className="mt-5">
        <h2 className="text-lg font-extrabold">{request.quotes.length > 1 ? "Compara cotizaciones" : "Cotización"}</h2>
        <p className="text-sm text-muted">No se cobra hasta que aceptes una cotización y registres el método de pago.</p>
        <div className="mt-3 space-y-3">
          {request.quotes.length === 0 ? <EmptyState title="Todavía no hay cotización" body="Avisamos a quien trabaja en tu zona. También puedes escribir por el chat." /> : null}
          {request.quotes.map((quote) => (
            <Card key={quote.id}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-extrabold">{quote.providerName}</p>
                {quote.isExample ? <ExampleTag /> : null}
                {quote.isDemo ? <Badge>Cuenta demo</Badge> : null}
                {quote.status === "PENDING" && quote.amountMxn === cheapest ? <Badge tone="leaf">Más baja</Badge> : null}
                <Badge>{quote.status === "ACCEPTED" ? "Aceptada" : quote.status === "REJECTED" ? "Rechazada" : "Pendiente"}</Badge>
              </div>
              <p className="text-sm text-muted">{quote.providerTrade} · {quote.rating == null ? "Sin reseñas" : `${quote.rating} de 5`}</p>
              <p className="mt-2 text-2xl font-extrabold">{mxn(quote.amountMxn)} MXN</p>
              <p className="text-sm leading-5">{quote.message}</p>
              {quote.etaMinutes ? <p className="text-sm font-bold">Llegada estimada: {quote.etaMinutes} min</p> : null}
              {request.permissions.canAccept && quote.status === "PENDING" ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button data-testid="accept-quote" onClick={() => setAcceptId(quote.id)}>Aceptar</Button>
                  <Button data-testid="reject-quote" variant="secondary" onClick={() => void api(`/api/quotes/${quote.id}/reject`, { method: "POST" }).then(() => load())}>Rechazar</Button>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      </section>

      {request.permissions.canQuote ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setFormError("");
            void api(`/api/requests/${id}/quotes`, {
              method: "POST",
              body: JSON.stringify({ amountMxn: Number(amount), message: quoteMessage, etaMinutes: Number(eta) }),
            })
              .then(() => load())
              .catch((reasonError: unknown) => setFormError(errorText(reasonError)));
          }}
        >
          <h2 className="text-lg font-extrabold">Enviar cotización</h2>
          {request.referencePriceMxn ? <p className="text-sm">El cliente vio una referencia de {mxn(request.referencePriceMxn)} MXN. Tú pones el precio final.</p> : null}
          <Field label="Precio en pesos">
            <Input data-testid="quote-amount" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </Field>
          <Field label="Qué incluye">
            <TextArea data-testid="quote-message" value={quoteMessage} onChange={(event) => setQuoteMessage(event.target.value)} />
          </Field>
          <Field label="Minutos para llegar">
            <Input data-testid="quote-eta" inputMode="numeric" value={eta} onChange={(event) => setEta(event.target.value)} />
          </Field>
          {formError ? <ErrorState message={formError} /> : null}
          <Button data-testid="quote-submit" className="w-full">Enviar cotización</Button>
        </form>
      ) : null}

      {request.permissions.canSchedule ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setFormError("");
            const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
            void api(`/api/requests/${id}/schedule`, { method: "POST", body: JSON.stringify({ scheduledAt }) })
              .then(() => load())
              .catch((reasonError: unknown) => setFormError(errorText(reasonError)));
          }}
        >
          <h2 className="text-lg font-extrabold">Agenda</h2>
          <p className="text-sm text-muted">Elige cuándo va. Después registras el método de pago. Hasta entonces no hay cobro.</p>
          <Button
            type="button"
            variant="secondary"
            data-testid="schedule-asap"
            onClick={() => {
              void api(`/api/requests/${id}/schedule`, { method: "POST", body: JSON.stringify({ asap: true }) }).then(() => load());
            }}
          >
            Lo antes posible
          </Button>
          <Field label="Fecha"><Input data-testid="schedule-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
          <Field label="Hora"><Input data-testid="schedule-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} /></Field>
          {formError ? <ErrorState message={formError} /> : null}
          <Button data-testid="schedule-submit" className="w-full">Confirmar fecha y hora</Button>
        </form>
      ) : null}
      {request.scheduledAt && !request.payment ? (
        <Card className="mt-4" data-testid="schedule-confirmed">
          <p className="font-extrabold">Cita: {formatWhen(request.scheduledAt)}</p>
          <p className="text-sm text-muted">Falta registrar cómo se va a pagar. Aún no hay cobro.</p>
          <Button asChild className="mt-3 w-full"><Link href={`/solicitudes/${id}/pago`} data-testid="go-pay">Continuar al pago</Link></Button>
        </Card>
      ) : null}
      {request.payment ? (
        <Card className="mt-4">
          <p className="font-extrabold">Método registrado</p>
          <p className="text-sm">{PAYMENT_METHODS.find((method) => method.id === request.payment?.method)?.name} · {mxn(request.payment.serviceMxn)} MXN del servicio</p>
          <Button asChild variant="secondary" className="mt-3"><Link href={`/solicitudes/${id}/pago`}>Ver recibo</Link></Button>
        </Card>
      ) : null}

      {request.permissions.canAdvance && request.permissions.nextStatus ? (
        <Button
          className="mt-4 w-full"
          data-testid="status-next"
          data-next={request.permissions.nextStatus}
          onClick={() => void api(`/api/requests/${id}/status`, { method: "POST" }).then(() => {
            if (request.permissions.nextStatus === "COMPLETED") setDoneParty("done");
            load();
          })}
        >
          {ADVANCE_LABEL[request.permissions.nextStatus] ?? "Actualizar estado"}
        </Button>
      ) : null}
      {request.permissions.canReview ? <Button asChild className="mt-4 w-full"><Link href={`/solicitudes/${id}/calificar`} data-testid="go-review">Calificar el trabajo</Link></Button> : null}
      {request.permissions.canRehire ? (
        <Button asChild variant="secondary" className="mt-3 w-full">
          <Link href={`/solicitar?proveedor=${request.quotes.find((quote) => quote.status === "ACCEPTED")?.providerId ?? ""}&servicio=${request.serviceOfferingId ?? ""}&categoria=${request.categoryId}`} data-testid="rehire">Volver a contratar</Link>
        </Button>
      ) : null}
      {request.permissions.canChat ? <Button asChild variant="secondary" className="mt-3 w-full"><Link href={`/mensajes/${id}`} data-testid="open-chat">Abrir chat</Link></Button> : null}
      {request.permissions.canCancel ? <Button variant="danger" className="mt-3 w-full" data-testid="cancel-request" onClick={() => setCancelOpen(true)}>Cancelar servicio</Button> : null}

      <form
        className="mt-4 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void api<{ message: string }>("/api/reports", { method: "POST", body: JSON.stringify({ kind: "PROBLEM", requestId: id, description: report }) })
            .then((result) => {
              setReportDone(result.message);
              setReport("");
            })
            .catch((reasonError: unknown) => setFormError(errorText(reasonError)));
        }}
      >
        <Field label="Reportar un problema" hint="Una persona lo revisa. No hay reembolso automático.">
          <TextArea value={report} onChange={(event) => setReport(event.target.value)} />
        </Field>
        <Button type="submit" variant="secondary">Enviar reporte</Button>
        {reportDone ? <p data-testid="report-sent" className="text-sm font-bold">{reportDone}</p> : null}
      </form>

      <Dialog open={Boolean(acceptId)} onOpenChange={(open) => !open && setAcceptId(null)} title="¿Aceptas esta cotización?">
        <p>Todavía no se cobra. Después eliges la fecha y el método de pago. Las otras cotizaciones pendientes se rechazan.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setAcceptId(null)}>Volver</Button>
          <Button
            data-testid="confirm-accept"
            onClick={() => {
              if (!acceptId) return;
              void api(`/api/quotes/${acceptId}/accept`, { method: "POST" })
                .then(() => {
                  setAcceptId(null);
                  setDoneParty("quote");
                  load();
                })
                .catch((reasonError: unknown) => setFormError(errorText(reasonError)));
            }}
          >
            Sí, aceptar
          </Button>
        </div>
      </Dialog>
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen} title="Cancelar servicio">
        <p className="text-sm leading-5">{request.permissions.needsDisputeOnCancel ? "El trabajo ya empezó o el proveedor va en camino. Cancelar abre una aclaración. Oficio no devuelve dinero porque no lo tiene." : "Antes de que el proveedor salga, cancelar no tiene costo en esta demo."}</p>
        <Field label="Motivo">
          <TextArea data-testid="cancel-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        <Button
          className="mt-3 w-full"
          variant="danger"
          data-testid="cancel-confirm"
          onClick={() => {
            void api(`/api/requests/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) })
              .then(() => {
                setCancelOpen(false);
                load();
              })
              .catch((reasonError: unknown) => setFormError(errorText(reasonError)));
          }}
        >
          Confirmar cancelación
        </Button>
      </Dialog>
      {formError ? <div className="mt-3"><ErrorState message={formError} /></div> : null}
      <button type="button" className="sr-only" onClick={() => router.refresh()}>Actualizar</button>
    </div>
  );
}

export function PaymentView({ id }: { id: string }) {
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [method, setMethod] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  function load() {
    api<RequestDetail>(`/api/requests/${id}`)
      .then(setRequest)
      .catch((reason: unknown) => setError(errorText(reason)));
  }
  useEffect(() => {
    load();
  }, [id]);

  if (error && !request) return <div className="px-4 py-6"><ErrorState message={error} onRetry={load} /></div>;
  if (!request) return <LoadingBlock label="Cargando el pago…" />;
  const quote = request.quotes.find((item) => item.id === request.selectedQuoteId);
  const money = quote ? breakdown(quote.amountMxn) : null;

  if (request.payment) {
    const chosen = PAYMENT_METHODS.find((item) => item.id === request.payment?.method);
    return (
      <div className="px-4 pt-4 pb-28" data-testid="receipt">
        <h1 className="text-2xl font-extrabold">Recibo</h1>
        <DemoBanner>Esto no es un comprobante fiscal ni un cargo bancario. La referencia no sirve para pagar.</DemoBanner>
        <Card className="mt-4 space-y-2" data-testid="pay-recorded">
          <p><span className="text-muted">Servicio: </span>{request.title}</p>
          <p><span className="text-muted">Folio demo: </span>{request.payment.reference}</p>
          <p><span className="text-muted">Fecha: </span>{formatWhen(request.payment.createdAt)}</p>
          <p><span className="text-muted">Método: </span>{chosen?.name}</p>
          <p>Costo del servicio: {mxn(request.payment.serviceMxn)} MXN</p>
          <p>Comisión de la plataforma (10%): {mxn(request.payment.feeMxn)} MXN</p>
          <p className="text-xl font-extrabold">Total mostrado: {mxn(request.payment.totalMxn)} MXN</p>
          <p className="text-sm leading-5">{request.payment.note}</p>
          <p className="text-sm font-bold">Estado: registrado en la demo. No hubo cobro ni custodia de dinero.</p>
        </Card>
        <Button asChild className="mt-4 w-full"><Link href={`/solicitudes/${id}`}>Volver al seguimiento</Link></Button>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-32">
      <h1 className="text-2xl font-extrabold">Pago y resumen</h1>
      <DemoBanner>Ningún método cobra de verdad. Eliges y queda un recibo de esa elección.</DemoBanner>
      {!request.permissions.canPay || !money || !quote ? (
        <div className="mt-4"><EmptyState title="Aún no toca pagar" body="Primero acepta una cotización y confirma la fecha." action={<Button asChild><Link href={`/solicitudes/${id}`}>Volver a la solicitud</Link></Button>} /></div>
      ) : (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            void api(`/api/requests/${id}/payment`, {
              method: "POST",
              body: JSON.stringify({ method, acceptedPolicy: accepted }),
            })
              .then((result) => {
                const recorded = result as { reference?: string };
                setDone(recorded.reference ?? "Listo");
                load();
              })
              .catch((reason: unknown) => setError(errorText(reason)));
          }}
        >
          <Card data-testid="fee-breakdown">
            <p className="font-extrabold">{quote.providerName}</p>
            <p className="text-sm text-muted">{request.title}</p>
            <p className="text-sm">Cita: {formatWhen(request.scheduledAt)}</p>
            <div className="mt-3 space-y-1 text-base">
              <p>Costo del servicio: {mxn(money.serviceMxn)} MXN</p>
              <p>Comisión de la plataforma (10%): {mxn(money.feeMxn)} MXN</p>
              <p className="text-xl font-extrabold">Total mostrado: {mxn(money.totalMxn)} MXN</p>
            </div>
            <p className="mt-2 text-sm leading-5 text-muted">La comisión se muestra antes de confirmar. En esta demo no se cobra, ni en tarjeta ni en efectivo.</p>
          </Card>
          <fieldset className="space-y-2">
            <legend className="text-sm font-extrabold">Método</legend>
            {PAYMENT_METHODS.map((item) => (
              <label key={item.id} className={`block rounded-3xl border p-3 ${method === item.id ? "border-clay bg-white" : "border-line bg-sand"}`}>
                <span className="flex items-center gap-2 font-extrabold">
                  <input type="radio" name="metodo" data-testid={`pay-${item.id}`} checked={method === item.id} onChange={() => setMethod(item.id)} />
                  {item.name}
                  <span className="text-sm font-bold text-muted">{item.summary}</span>
                </span>
                <span className="mt-1 block text-sm leading-5">{item.protection}</span>
              </label>
            ))}
          </fieldset>
          <label className="flex items-start gap-2 text-sm leading-5">
            <input data-testid="pay-policy" type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1 h-5 w-5" />
            <span>Leí las reglas de cancelación y aclaraciones. Entiendo que Oficio no retiene el dinero.</span>
          </label>
          {error ? <ErrorState message={error} /> : null}
          {done ? <p className="font-bold">Elección registrada. Folio {done}.</p> : null}
          <Button data-testid="pay-submit" className="w-full">Registrar esta elección</Button>
        </form>
      )}
    </div>
  );
}

export function ReviewView({ id }: { id: string }) {
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    api<RequestDetail>(`/api/requests/${id}`).then(setRequest).catch((reason: unknown) => setError(errorText(reason)));
  }, [id]);
  if (!request && !error) return <LoadingBlock label="Cargando la reseña…" />;
  const providerId = request?.quotes.find((quote) => quote.status === "ACCEPTED")?.providerId;
  if (done || request?.review) {
    return (
      <div className="px-4 pt-8 pb-28" data-testid="review-thanks">
        <h1 className="text-2xl font-extrabold">Gracias por tu reseña</h1>
        <p className="mt-2 text-muted">Ya se ve en el perfil. Si la cuenta es demo, la reseña lo indica.</p>
        <div className="mt-4 space-y-2">
          {providerId ? <Button asChild className="w-full"><Link href={`/proveedores/${providerId}`}>Ver el perfil</Link></Button> : null}
          <Button asChild variant="secondary" className="w-full"><Link href={`/solicitar?proveedor=${providerId ?? ""}&servicio=${request?.serviceOfferingId ?? ""}&categoria=${request?.categoryId ?? ""}`} data-testid="rehire">Volver a contratar</Link></Button>
        </div>
      </div>
    );
  }
  return (
    <div className="px-4 pt-4 pb-28">
      <h1 className="text-2xl font-extrabold">Califica el trabajo</h1>
      <p className="mt-1 text-muted">Cuéntale a otras personas cómo te fue. Sé concreto.</p>
      {error ? <div className="mt-3"><ErrorState message={error} /></div> : null}
      {!request?.permissions.canReview ? <div className="mt-4"><EmptyState title="Todavía no se puede reseñar" body="La reseña se abre cuando el trabajo está terminado." /></div> : (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void api(`/api/requests/${id}/review`, { method: "POST", body: JSON.stringify({ rating, comment }) })
              .then(() => setDone(true))
              .catch((reason: unknown) => setError(errorText(reason)));
          }}
        >
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} type="button" data-testid={`star-${star}`} aria-label={`${star} estrellas`} onClick={() => setRating(star)} className={`h-12 w-12 rounded-2xl text-xl font-extrabold ${rating >= star ? "bg-clay text-white" : "bg-white"}`}>
                {star}
              </button>
            ))}
          </div>
          <Field label="Tu reseña">
            <TextArea data-testid="review-comment" value={comment} onChange={(event) => setComment(event.target.value)} />
          </Field>
          <Button data-testid="review-submit" className="w-full">Publicar reseña</Button>
        </form>
      )}
    </div>
  );
}

export function ThreadsView() {
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const [error, setError] = useState("");
  function load() {
    api<{ threads: ThreadSummary[] }>("/api/threads")
      .then((data) => setThreads(data.threads))
      .catch((reason: unknown) => setError(errorText(reason)));
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="px-4 pt-4 pb-28">
      <h1 className="text-2xl font-extrabold">Mensajes</h1>
      <p className="mt-1 text-muted">Acuerdos del trabajo. El precio se confirma en la cotización, no solo aquí.</p>
      <div className="mt-4 space-y-3">
        {error ? <ErrorState message={error} onRetry={load} /> : null}
        {threads === null && !error ? <LoadingBlock label="Cargando mensajes…" /> : null}
        {threads && threads.length === 0 ? <EmptyState title="Aún no hay chats" body="Cuando pidas un servicio, aquí verás el chat con el proveedor." /> : null}
        {threads?.map((thread) => (
          <Link key={thread.requestId} href={`/mensajes/${thread.requestId}`} className="block rounded-3xl border border-line bg-sand p-4">
            <div className="flex justify-between gap-2"><p className="font-extrabold">{thread.withName}</p><Badge>{thread.statusLabel}</Badge></div>
            <p className="text-sm text-muted">{thread.title}</p>
            <p className="mt-1 text-sm">{thread.lastBody}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ChatView({ id }: { id: string }) {
  const { user } = useSession();
  const [title, setTitle] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  function load(silent = false) {
    api<{ title: string; messages: ChatMessage[] }>(`/api/requests/${id}/messages`)
      .then((data) => {
        setTitle(data.title);
        setMessages(data.messages);
        if (!silent) setError("");
      })
      .catch((reason: unknown) => {
        if (!silent) setError(errorText(reason));
      });
  }
  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), 4000);
    return () => window.clearInterval(timer);
  }, [id]);

  return (
    <div className="flex min-h-[calc(100dvh-8.5rem)] flex-col px-4 pt-4 pb-28">
      <h1 className="text-xl font-extrabold">{title || "Chat"}</h1>
      <p className="text-sm text-muted">No compartas contraseñas ni datos de tarjeta.</p>
      {error ? <div className="mt-3"><ErrorState message={error} onRetry={() => load()} /></div> : null}
      <div data-testid="chat-log" className="mt-3 flex flex-1 flex-col gap-2">
        {messages.length === 0 ? <EmptyState title="Empieza la conversación" body="Pregunta lo que haga falta para el trabajo. El precio queda en la cotización." /> : null}
        {messages.map((message) => (
          <div key={message.id} className={`max-w-[85%] rounded-3xl px-3 py-2 ${message.mine ? "self-end bg-clay text-white" : "self-start bg-white"}`}>
            <p className="text-xs font-bold opacity-80">{message.senderName}</p>
            {message.imageData ? <img src={message.imageData} alt="Foto del chat" className="mt-1 max-h-48 rounded-2xl" /> : null}
            <p className="text-base leading-6">{message.body}</p>
          </div>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const text = body.trim();
          if (!text) return;
          setBody("");
          void api(`/api/requests/${id}/messages`, { method: "POST", body: JSON.stringify({ body: text }) })
            .then(() => load(true))
            .catch((reason: unknown) => setError(errorText(reason)));
        }}
      >
        <Input data-testid="chat-input" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Escribe un mensaje" />
        <label className="grid h-12 w-12 cursor-pointer place-items-center rounded-2xl bg-white font-extrabold">
          Foto
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void fileToJpegDataUrl(file)
                .then((imageData) => api(`/api/requests/${id}/messages`, { method: "POST", body: JSON.stringify({ body: "Foto", imageData }) }))
                .then(() => load(true))
                .catch((reason: unknown) => setError(errorText(reason)));
            }}
          />
        </label>
        <Button data-testid="chat-send" type="submit">Enviar</Button>
      </form>
      {!user ? null : null}
    </div>
  );
}
