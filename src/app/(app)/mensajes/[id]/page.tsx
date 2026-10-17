"use client";

import { useParams } from "next/navigation";
import { ChatView } from "@/components/views/jobs";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <ChatView id={params.id} />;
}
