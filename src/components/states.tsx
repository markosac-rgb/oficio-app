import { Badge } from "@/components/ui";

export function LoadingBlock({ label = "Cargando…" }: { label?: string }) {
  return (
    <div role="status" className="px-4 py-10">
      <div className="mx-auto max-w-md space-y-3">
        <div className="h-8 w-40 animate-pulse rounded-full bg-line" />
        <div className="h-28 animate-pulse rounded-3xl bg-line" />
        <div className="h-28 animate-pulse rounded-3xl bg-line" />
        <p className="text-base font-bold text-muted">{label}</p>
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-white px-4 py-8 text-center">
      <p className="text-lg font-extrabold">{title}</p>
      <p className="mt-2 text-base leading-6 text-muted">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-3xl border border-[#f0c7cd] bg-[#fff5f6] px-4 py-5">
      <p className="text-lg font-extrabold text-danger">Algo no salió bien</p>
      <p className="mt-1 text-base leading-6">{message}</p>
      {onRetry ? (
        <button type="button" data-testid="retry" onClick={onRetry} className="mt-3 font-extrabold text-clay underline">
          Intentar de nuevo
        </button>
      ) : null}
    </div>
  );
}

export function DemoBanner({ children }: { children: React.ReactNode }) {
  return (
    <p data-testid="demo-banner" className="rounded-2xl border border-[#efd39a] bg-[#fff6df] px-3 py-2 text-sm leading-5 text-[#5c4310]">
      <strong>Simulado / Demo. </strong>
      {children}
    </p>
  );
}

export function ExampleTag() {
  return <Badge tone="gold">Ejemplo ficticio</Badge>;
}

export function DemoTag() {
  return <Badge>Cuenta demo</Badge>;
}
