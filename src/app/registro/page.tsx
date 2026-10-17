import { Suspense } from "react";
import { RegisterScreen } from "@/components/views/auth";
import { LoadingBlock } from "@/components/states";

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock label="Cargando el registro…" />}>
      <RegisterScreen />
    </Suspense>
  );
}
