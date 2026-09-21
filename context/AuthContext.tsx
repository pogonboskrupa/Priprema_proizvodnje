"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { getSession, clearSession, type Session } from "@/lib/auth";

interface AuthCtx {
  session: Session | null;
  loading: boolean;
  logout: () => void;
  refresh: () => void;
}

const Ctx = createContext<AuthCtx>({ session: null, loading: true, logout: () => {}, refresh: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  function refresh() {
    setSession(getSession());
    setLoading(false);
  }

  function logout() {
    clearSession();
    setSession(null);
    window.location.href = (process.env.NEXT_PUBLIC_BASE_PATH || "") + "/login/";
  }

  useEffect(() => { refresh(); }, []);

  return <Ctx.Provider value={{ session, loading, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
