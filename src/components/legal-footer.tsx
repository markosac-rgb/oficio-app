import Link from "next/link";
import { cn } from "@/lib/utils";

export function LegalFooter({ tone = "ink" }: { tone?: "ink" | "light" }) {
  const color = tone === "light" ? "text-white/85" : "text-muted";
  return (
    <footer className={cn("flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-6 text-sm font-bold", color)}>
      <Link href="/terminos" data-testid="link-terminos" className="underline">
        Términos y condiciones
      </Link>
      <Link href="/privacidad" data-testid="link-privacidad" className="underline">
        Aviso de privacidad
      </Link>
    </footer>
  );
}
