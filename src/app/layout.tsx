import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { ServiceWorker } from "@/components/pwa";
import { SessionProvider } from "@/components/session";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Oficio", template: "%s · Oficio" },
  description: "Pide plomeros, electricistas y otros oficios cerca de tu casa, en México.",
  applicationName: "Oficio",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Oficio", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#c24e2a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={`${nunito.variable} h-full`}>
      <body className="min-h-full antialiased">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">
          Saltar al contenido
        </a>
        <SessionProvider>{children}</SessionProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
