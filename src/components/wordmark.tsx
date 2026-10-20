import { cn } from "@/lib/utils";

/** Ofi en el color de base, x en el acento, con una llave pequeña. */
export function Wordmark({
  tone = "ink",
  className,
}: {
  tone?: "ink" | "onDark";
  className?: string;
}) {
  const accent = tone === "onDark" ? "text-[#f6b73c]" : "text-clay";
  return (
    <span data-testid="wordmark" className={cn("inline-flex items-center font-extrabold tracking-tight", className)}>
      <span className="sr-only">Ofixio</span>
      <span aria-hidden="true" className="inline-flex items-center">
        <span>Ofi</span>
        <span className={cn("relative inline-flex items-center", accent)}>
          x
          <svg viewBox="0 0 16 16" aria-hidden="true" className="absolute -top-[0.42em] -right-[0.28em] h-[0.62em] w-[0.62em]">
            <path
              d="M3.2 9.2 8.4 4.2M6.2 2.4h5.2a1.6 1.6 0 0 1 0 3.2H9.2L7.4 7.2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span>io</span>
      </span>
    </span>
  );
}
