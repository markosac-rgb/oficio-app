"use client";

import { useState } from "react";

export default function MockCheckoutPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function choose(outcome: "approved" | "pending" | "rejected") {
    const preferenceId = new URLSearchParams(window.location.search).get("preference_id") || "";
    setBusy(true);
    setError("");
    const response = await fetch("/api/payments/mercadopago/mock-pay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ preferenceId, outcome }),
    });
    const data = (await response.json()) as { redirect?: string; error?: string };
    if (!response.ok || !data.redirect) {
      setBusy(false);
      setError(data.error || "No se pudo simular el checkout.");
      return;
    }
    window.location.href = data.redirect;
  }

  return (
    <main id="contenido" className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-5 py-8">
      <p className="text-sm font-extrabold uppercase tracking-wide text-clay">Prueba local</p>
      <h1 className="text-2xl font-extrabold">Checkout de prueba de Mercado Pago</h1>
      <p className="text-base leading-6">
        Esta pantalla sustituye a Mercado Pago solo cuando el servidor corre con MP_MOCK. No cobra dinero.
      </p>
      <button type="button" data-testid="mp-mock-approve" disabled={busy} onClick={() => void choose("approved")} className="h-12 rounded-2xl bg-lime font-extrabold text-lime-ink">
        Aprobar pago de prueba
      </button>
      <button type="button" data-testid="mp-mock-pending" disabled={busy} onClick={() => void choose("pending")} className="h-12 rounded-2xl border border-line bg-white font-extrabold">
        Dejar pendiente (OXXO)
      </button>
      <button type="button" data-testid="mp-mock-reject" disabled={busy} onClick={() => void choose("rejected")} className="h-12 rounded-2xl border border-line bg-white font-extrabold">
        Rechazar
      </button>
      {error ? <p className="font-bold text-danger">{error}</p> : null}
    </main>
  );
}
