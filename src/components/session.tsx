"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Account } from "@/lib/types";

type SessionValue = {
  status: "loading" | "ready";
  user: Account | null;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [user, setUser] = useState<Account | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: Account | null }>("/api/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setStatus("ready");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <SessionContext.Provider value={{ status, user, refresh }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("La sesión no está lista.");
  return value;
}
