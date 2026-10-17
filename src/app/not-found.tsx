import Link from "next/link";

export default function NotFound() {
  return (
    <main id="contenido" className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5">
      <h1 className="text-3xl font-extrabold">No encontramos esa página</h1>
      <p className="mt-2 text-muted">Revisa la dirección o vuelve al inicio.</p>
      <Link href="/" className="mt-4 font-extrabold text-clay">Ir al inicio</Link>
    </main>
  );
}
