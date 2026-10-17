import type { Metadata } from "next";
import { WelcomeScreen } from "@/components/views/auth";

export const metadata: Metadata = { title: "Oficio — Servicios para tu casa" };

export default function Page() {
  return <WelcomeScreen />;
}
