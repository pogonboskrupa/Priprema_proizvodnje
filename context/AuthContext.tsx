"use client";
import { createContext, Fragment, useContext, useEffect, useState } from "react";
import { getSession, clearSession, saveSession, isRemembered, type Session } from "@/lib/auth";
import { getKorisnik, updateKorisnik } from "@/lib/db";
import { configureUnosiScope } from "@/lib/firebase";
import { postaviAdminSesiju } from "@/lib/zakljucavanje";
import { aktivniOpseg, opsegZaSesiju, postaviOpseg, spremiIzbor } from "@/lib/sumarija";

// admin i operater rade sa svim unosima; projektant vidi samo svoje
function applyScope(ses: Session | null) {
  postaviAdminSesiju(ses?.role === "admin");
  postaviOpseg(ses ? opsegZaSesiju(ses) : null);
  if (ses) configureUnosiScope(ses.userId, ses.role === "admin" || !!ses.operater);
}

interface AuthCtx {
  session: Session | null;
  loading: boolean;
  /** Aktivna šumarija; null = sve (samo super admin) */
  sumarijaId: string | null;
  /** Samo super admin: izbor šumarije, cijela aplikacija se učita ponovo */
  setSumarija: (id: string | null) => void;
  logout: () => void;
  refresh: () => void;
}

const Ctx = createContext<AuthCtx>({ session: null, loading: true, sumarijaId: null, setSumarija: () => {}, logout: () => {}, refresh: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [opseg, setOpseg] = useState<string | null>(null);
  // promjena šumarije remountuje stranice da ponovo učitaju podatke u novom opsegu
  const [opsegVer, setOpsegVer] = useState(0);

  function setSumarija(id: string | null) {
    spremiIzbor(id);
    postaviOpseg(id);
    setOpseg(id);
    setOpsegVer((v) => v + 1);
  }

  function refresh() {
    const ses = getSession();
    // prije setSession: stranice čitaju unose tek kad dobiju sesiju, a tada opseg već postoji
    applyScope(ses);
    setOpseg(aktivniOpseg());
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
  // promijenjena uloga ili prava koja dodjeljuje admin). Offline greška ne odjavljuje.
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
        sihter: k.sihter ?? false,
        izvjestaji: k.izvjestaji ?? false,
        sumarijaId: k.sumarijaId,
        fullName: k.fullName,
        ime: k.ime,
        avatar: k.avatar,
      };
      if (JSON.stringify(fresh) !== JSON.stringify(ses)) {
        saveSession(fresh, isRemembered());
        applyScope(fresh);
        setOpseg(aktivniOpseg());
        setSession(fresh);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <Ctx.Provider value={{ session, loading, sumarijaId: opseg, setSumarija, logout, refresh }}>
      <Fragment key={opsegVer}>{children}</Fragment>
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
