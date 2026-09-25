"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { getSession, clearSession, saveSession, isRemembered, type Session } from "@/lib/auth";
import { getKorisnik, updateKorisnik } from "@/lib/db";
import { configureUnosiScope } from "@/lib/firebase";

// admin i operater rade sa svim unosima; projektant vidi samo svoje
function applyScope(ses: Session | null) {
  if (ses) configureUnosiScope(ses.userId, ses.role === "admin" || !!ses.operater);
}

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
    const ses = getSession();
    // prije setSession: stranice čitaju unose tek kad dobiju sesiju, a tada opseg već postoji
    applyScope(ses);
    setSession(ses);
    setLoading(false);
  }

  function logout() {
    clearSession();
    setSession(null);
    window.location.href = (process.env.NEXT_PUBLIC_BASE_PATH || "") + "/login/";
  }

  useEffect(() => { refresh(); }, []);

  // Sesija je snimak iz trenutka prijave: uskladi je s bazom (arhiviran/obrisan korisnik,
  // promijenjena uloga ili operaterska prava). Offline greška ne odjavljuje.
  const userId = session?.userId;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getKorisnik(userId).then((k) => {
      if (cancelled) return;
      const ses = getSession();
      if (!ses || ses.userId !== userId) return;
      if (!k || k.arhiviran) { logout(); return; }
      updateKorisnik(userId, { lastOnlineAt: new Date().toISOString() }).catch(() => {});
      const fresh: Session = {
        ...ses,
        role: k.role,
        operater: k.operater ?? false,
        fullName: k.fullName,
        ime: k.ime,
        avatar: k.avatar,
      };
      if (JSON.stringify(fresh) !== JSON.stringify(ses)) {
        saveSession(fresh, isRemembered());
        applyScope(fresh);
        setSession(fresh);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  return <Ctx.Provider value={{ session, loading, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
