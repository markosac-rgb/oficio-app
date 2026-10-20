import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ServiceWorker } from "@/components/pwa";
import { SessionProvider } from "@/components/session";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const description = "Lo arreglamos por ti. Pide plomeros, electricistas y otros oficios cerca de tu casa, en México.";
const siteUrl = process.env.OFICIO_PUBLIC_URL?.replace(/\/$/, "") || "https://oficio-app.onrender.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Ofixio", template: "%s · Ofixio" },
  description,
  applicationName: "Ofixio",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Ofixio", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Ofixio",
    description,
    locale: "es_MX",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Ofixio. Lo arreglamos por ti" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ofixio",
    description,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#083d34",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={`${jakarta.variable} h-full`}>
      <body className="min-h-full antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(localStorage.getItem('oficio-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
        <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">
          Saltar al contenido
        </a>
        <SessionProvider>{children}</SessionProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
