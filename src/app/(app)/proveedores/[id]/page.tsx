"use client";

import { useParams } from "next/navigation";
import { ProviderView } from "@/components/views/marketplace";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <ProviderView id={params.id} />;
}
