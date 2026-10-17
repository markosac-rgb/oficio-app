"use client";

import { useParams } from "next/navigation";
import { PaymentView } from "@/components/views/jobs";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <PaymentView id={params.id} />;
}
