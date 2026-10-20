import type { Metadata } from "next";
import { WelcomeScreen } from "@/components/views/auth";

export const metadata: Metadata = { title: { absolute: "Ofixio — Lo arreglamos por ti" } };

export default function Page() {
  return <WelcomeScreen />;
}
