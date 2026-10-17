"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, CircleHelp, ClipboardList, House, MessageCircle, Search, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { firstName } from "@/lib/format";
import type { Account } from "@/lib/types";
import { cn } from "@/lib/utils";

function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="10" fill="#c24e2a" />
      <path d="M7 15.5 16 8l9 7.5" fill="none" stroke="white" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M10 14.5V23h12v-8.5" fill="none" stroke="white" strokeWidth="2.2" />
      <path d="M14 23v-5h4v5" fill="none" stroke="white" strokeWidth="2" />
    </svg>
  );
}

const NAV = [
  { href: "/inicio", label: "Inicio", icon: House, testid: "nav-inicio" },
  { href: "/buscar", label: "Buscar", icon: Search, testid: "nav-buscar" },
  { href: "/solicitudes", label: "Solicitudes", icon: ClipboardList, testid: "nav-solicitudes" },
  { href: "/mensajes", label: "Mensajes", icon: MessageCircle, testid: "nav-mensajes" },
  { href: "/perfil", label: "Perfil", icon: UserRound, testid: "nav-perfil" },
];

function active(pathname: string, href: string) {
  if (href === "/inicio") return pathname === "/inicio";
  if (href === "/buscar") return ["/buscar", "/proveedores", "/solicitar"].some((item) => pathname === item || pathname.startsWith(`${item}/`));
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({ user, children }: { user: Account; children: React.ReactNode }) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const data = await api<{ unread: number }>("/api/notifications");
        if (!stop) setUnread(data.unread);
      } catch {
        /* el aviso no debe bloquear la pantalla */
      }
    }
    void load();
    const timer = window.setInterval(load, 20000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [pathname]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <div className="mx-auto min-h-dvh w-full max-w-3xl bg-paper md:border-x md:border-line">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <Link href="/inicio" className="flex items-center gap-2 text-lg font-extrabold">
              <Logo className="h-9 w-9" />
              Oficio
            </Link>
            <p className="hidden text-sm text-muted sm:block">Hola, {firstName(user.name)}</p>
            <div className="ml-auto flex items-center gap-1">
              <Link href="/ayuda" aria-label="Ayuda" className="rounded-full p-2">
                <CircleHelp />
              </Link>
              <Link href="/notificaciones" aria-label={unread ? `${unread} avisos nuevos` : "Avisos"} className="relative rounded-full p-2">
                <Bell />
                {unread > 0 ? (
                  <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-clay px-1 text-[10px] font-extrabold text-white">
                    {unread}
                  </span>
                ) : null}
              </Link>
            </div>
          </div>
          {user.isDemo ? <p className="mt-1 text-xs font-bold text-gold">Estás en una cuenta demo.</p> : null}
        </header>
        {!online ? (
          <p className="bg-[#fff6df] px-4 py-2 text-sm font-bold text-[#5c4310]">
            Sin conexión. Puedes ver lo último que cargó el celular; para pedir un servicio necesitas internet.
          </p>
        ) : null}
        <main id="contenido">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-sand pb-[env(safe-area-inset-bottom)]" aria-label="Principal">
          <ul className="mx-auto grid max-w-3xl grid-cols-5">
            {NAV.map((item) => {
              const Icon = item.icon;
              const on = active(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    data-testid={item.testid}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold",
                      on ? "text-clay" : "text-muted",
                    )}
                  >
                    <Icon size={22} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}

export function Page({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 pt-4 pb-28">
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      {subtitle ? <p className="mt-1 text-base leading-6 text-muted">{subtitle}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}
