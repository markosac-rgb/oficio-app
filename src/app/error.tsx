"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="contenido" className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5">
      <h1 className="text-3xl font-extrabold">Tuvimos un problema</h1>
      <p className="mt-2 text-muted">No se pudo mostrar esta pantalla. Puedes intentar otra vez.</p>
      <button type="button" onClick={reset} className="mt-4 font-extrabold text-clay">Intentar de nuevo</button>
    </main>
  );
}
