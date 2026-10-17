import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "@/components/legal-document";
import { LegalFooter } from "@/components/legal-footer";
import { readLegal } from "@/lib/read-legal";

export const metadata: Metadata = { title: "Aviso de privacidad" };

export default function PrivacidadPage() {
  const markdown = readLegal("aviso-privacidad.md");
  return (
    <main id="contenido" className="mx-auto min-h-dvh w-full max-w-3xl px-5 py-8">
      <Link href="/" className="text-sm font-extrabold text-clay">
        Volver al inicio
      </Link>
      <div className="mt-4">
        <LegalDocument markdown={markdown} />
      </div>
      <p className="mt-8 text-sm">
        También puedes leer los <Link href="/terminos" className="font-extrabold text-clay underline">términos y condiciones de uso</Link>.
      </p>
      <LegalFooter />
    </main>
  );
}
