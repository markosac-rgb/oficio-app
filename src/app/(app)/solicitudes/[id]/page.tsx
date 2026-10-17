"use client";

import { useParams } from "next/navigation";
import { RequestDetailView } from "@/components/views/jobs";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <RequestDetailView id={params.id} />;
}
