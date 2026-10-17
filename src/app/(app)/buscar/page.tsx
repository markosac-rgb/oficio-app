import { Suspense } from "react";
import { BuscarView } from "@/components/views/marketplace";
import { LoadingBlock } from "@/components/states";

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock label="Cargando la búsqueda…" />}>
      <BuscarView />
    </Suspense>
  );
}
