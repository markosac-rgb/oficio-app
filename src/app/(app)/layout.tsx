"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Shell } from "@/components/shell";
import { useSession } from "@/components/session";
import { LoadingBlock } from "@/components/states";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { status, user } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "ready" && !user) router.replace("/entrar");
  }, [status, user, router]);

  if (status !== "ready" || !user) return <LoadingBlock label="Cargando tu cuenta…" />;
  return <Shell user={user}>{children}</Shell>;
}
