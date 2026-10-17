"use client";

import { useParams } from "next/navigation";
import { ReviewView } from "@/components/views/jobs";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <ReviewView id={params.id} />;
}
