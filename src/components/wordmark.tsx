import { cn } from "@/lib/utils";

const ALT = "Ofixio. Lo arreglamos por ti";

/**
 * Logotipo Trazo. `onDark` usa la versión para fondo oscuro.
 * En una superficie clara sigue el modo: claro de día, oscuro de noche.
 */
export function Wordmark({
  tone = "ink",
  className,
}: {
  tone?: "ink" | "onDark";
  className?: string;
}) {
  const frame = cn("h-11 w-auto", className);
  if (tone === "onDark") {
    return (
      <span data-testid="wordmark" className="inline-flex items-center">
        <img src="/brand/logo-oscuro.svg" alt={ALT} className={frame} />
      </span>
    );
  }
  return (
    <span data-testid="wordmark" className="inline-flex items-center">
      <img src="/brand/logo-claro.svg" alt={ALT} className={cn(frame, "dark:hidden")} />
      <img src="/brand/logo-oscuro.svg" alt="" aria-hidden="true" className={cn(frame, "hidden dark:block")} />
    </span>
  );
}
