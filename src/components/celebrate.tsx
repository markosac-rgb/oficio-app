"use client";

import { useEffect, useState } from "react";

const COLORS = ["#f6b73c", "#0e6b56", "#ffffff", "#e26d5a", "#7ec8e3"];

export function celebrate(kind: "request" | "quote" | "done") {
  sessionStorage.setItem("oficio-celebrate", kind);
}

export function useCelebration() {
  const [kind, setKind] = useState<string | null>(null);
  useEffect(() => {
    const value = sessionStorage.getItem("oficio-celebrate");
    if (!value) return;
    sessionStorage.removeItem("oficio-celebrate");
    setKind(value);
    const timer = window.setTimeout(() => setKind(null), 1600);
    return () => window.clearTimeout(timer);
  }, []);
  return kind;
}

export function Confetti({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {COLORS.flatMap((color, index) =>
        [0, 1, 2, 3].map((piece) => (
          <span
            key={`${color}-${piece}`}
            className="confetti-bit"
            style={{
              left: `${8 + ((index * 17 + piece * 19) % 84)}%`,
              background: color,
              animationDelay: `${piece * 0.08}s`,
            }}
          />
        )),
      )}
    </div>
  );
}

export function SuccessBanner({ kind }: { kind: string | null }) {
  if (!kind) return null;
  const copy =
    kind === "quote" ? "Cotización aceptada" : kind === "done" ? "Trabajo terminado" : "Solicitud enviada";
  return (
    <>
      <Confetti show />
      <div data-testid="request-success" className="mb-4 flex items-center gap-3 rounded-3xl bg-leaf px-4 py-3 text-white shadow-lg">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-xl font-extrabold text-leaf">✓</span>
        <div>
          <p className="font-extrabold">{copy}</p>
          <p className="text-sm text-white/85">Quedó guardado. No hay cobro ni custodia de dinero.</p>
        </div>
      </div>
    </>
  );
}
