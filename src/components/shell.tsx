"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { Bell, CalendarDays, CircleHelp, House, MessageCircle, Search, UserRound } from "lucide-react";
import { LegalFooter } from "@/components/legal-footer";
import { Wordmark } from "@/components/wordmark";
import { api } from "@/lib/api";
import type { Account } from "@/lib/types";
import { cn } from "@/lib/utils";

type Badges = { notifications: number; messages: number; bookings: number };

const BadgeContext = createContext<Badges>({ notifications: 0, messages: 0, bookings: 0 });

export function useBadges() {
  return useContext(BadgeContext);
}

const NAV = [
  { href: "/inicio", label: "Inicio", icon: House, testid: "nav-inicio", badge: null },
  { href: "/buscar", label: "Explorar", icon: Search, testid: "nav-buscar", badge: null },
  { href: "/solicitudes", label: "Reservas", icon: CalendarDays, testid: "nav-solicitudes", badge: "bookings" as const },
  { href: "/mensajes", label: "Mensajes", icon: MessageCircle, testid: "nav-mensajes", badge: "messages" as const },
  { href: "/perfil", label: "Perfil", icon: UserRound, testid: "nav-perfil", badge: null },
];

function active(pathname: string, href: string) {
  if (href === "/inicio") return pathname === "/inicio";
  if (href === "/buscar") return ["/buscar", "/proveedores", "/solicitar"].some((item) => pathname === item || pathname.startsWith(`${item}/`));
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({ user, children }: { user: Account; children: React.ReactNode }) {
  const pathname = usePathname();
  const [badges, setBadges] = useState<Badges>({ notifications: 0, messages: 0, bookings: 0 });
  const [online, setOnline] = useState(true);
  const hero = pathname === "/inicio" || pathname === "/buscar";

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const data = await api<{ unread: number; messages?: number; bookings?: number }>("/api/notifications");
        if (!stop) {
          setBadges({
            notifications: data.unread,
            messages: data.messages ?? 0,
            bookings: data.bookings ?? 0,
          });
        }
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
    <BadgeContext.Provider value={badges}>
      <div className="min-h-dvh bg-paper text-ink">
        <div className="mx-auto min-h-dvh w-full max-w-3xl bg-paper md:shadow-[0_0_0_1px_var(--color-line)]">
          {hero ? null : (
            <header className="sticky top-0 z-30 bg-gradient-to-r from-[#083d34] to-[#0e6b56] px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <Link href="/inicio" className="text-lg text-white">
                  <Wordmark tone="onDark" />
                </Link>
                {user.isDemo ? <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold">Cuenta demo</span> : null}
                <div className="ml-auto flex items-center">
                  <Link href="/ayuda" aria-label="Ayuda" className="grid h-11 w-11 place-items-center rounded-full">
                    <CircleHelp size={20} />
                  </Link>
                  <Link href="/notificaciones" aria-label={badges.notifications ? `${badges.notifications} avisos nuevos` : "Avisos"} className="relative grid h-11 w-11 place-items-center rounded-full">
                    <Bell size={20} />
                    {badges.notifications > 0 ? <Count n={badges.notifications} /> : null}
                  </Link>
                </div>
              </div>
            </header>
          )}
          {!online ? (
            <p className="bg-[#fff6df] px-4 py-2 text-sm font-bold text-[#5c4310]">
              Sin conexión. Puedes ver lo último que cargó el celular; para pedir un servicio necesitas internet.
            </p>
          ) : null}
          <main id="contenido">
            {children}
            <div className="pb-24">
              <LegalFooter />
            </div>
          </main>
          <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-sand pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgb(8_40_32/0.06)]" aria-label="Principal">
            <ul className="mx-auto grid max-w-3xl grid-cols-5">
              {NAV.map((item) => {
                const Icon = item.icon;
                const on = active(pathname, item.href);
                const count = item.badge ? badges[item.badge] : 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      data-testid={item.testid}
                      aria-current={on ? "page" : undefined}
                      className={cn(
                        "relative flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold",
                        on ? "text-clay" : "text-muted",
                      )}
                    >
                      <span className="relative">
                        <Icon size={22} />
                        {count > 0 ? <Count n={count} /> : null}
                      </span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </BadgeContext.Provider>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="absolute -top-1 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-[#e26d5a] px-1 text-[10px] font-extrabold text-white">
      {n > 9 ? "9+" : n}
    </span>
  );
}
