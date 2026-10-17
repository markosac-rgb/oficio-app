import { Suspense } from "react";
import { LoginScreen } from "@/components/views/auth";
import { LoadingBlock } from "@/components/states";

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock label="Cargando la entrada…" />}>
      <LoginScreen />
    </Suspense>
  );
}
