import { Suspense } from "react";
import { SolicitarView } from "@/components/views/marketplace";
import { LoadingBlock } from "@/components/states";

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock label="Preparando la solicitud…" />}>
      <SolicitarView />
    </Suspense>
  );
}
