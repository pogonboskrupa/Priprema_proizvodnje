"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { db, collection, query, onUnosiChanges } from "@/lib/firebase";
import { getDocs, limit } from "firebase/firestore";
import { VERSION } from "@/lib/version";
import { useAuth } from "@/context/AuthContext";
import { navFor, isActive, type NavItem } from "@/lib/nav";
import { Icon } from "@/components/Icon";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

type Status = "checking" | "online" | "offline";

function useConnectionStatus(): Status {
  const [status, setStatus] = useState<Status>("checking");

  async function checkFirebase() {
    if (!navigator.onLine) { setStatus("offline"); return; }
    try {
      await getDocs(query(collection(db, "odjeli"), limit(1)));
      setStatus("online");
    } catch {
      setStatus("offline");
    }
  }

  useEffect(() => {
    checkFirebase();
    function handleOnline() { checkFirebase(); }
    function handleOffline() { setStatus("offline"); }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return status;
}

function useNewEntryNotifier() {
  const [toast, setToast] = useState<string | null>(null);
  const { session } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (session?.role !== "admin") return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    // dijeli sync listener iz lib/firebase — nema zasebnog čitanja cijele kolekcije
    const unsub = onUnosiChanges((changes) => {
      // edit starog unosa ga uvodi u sync prozor kao "added"; novi unos ima createdAt === updatedAt
      const added = changes.filter((c) => {
        if (c.type !== "added") return false;
        const { createdAt, updatedAt } = c.doc.data();
        return !!createdAt && !!updatedAt && createdAt.isEqual(updatedAt);
      });
      if (!added.length) return;
      const msg = added.length === 1 ? "Novi unos je dodan" : `${added.length} novih unosa`;
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Priprema Proizvodnje", { body: msg });
      }
      setToast(msg);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setToast(null), 5000);
    });
    return () => { unsub(); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [session]);

  return toast;
}

function UserMenu({ status }: { status: Status }) {
  const { session, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!session) return null;

  const displayName = session.fullName || session.ime;
  const isAdmin = session.role === "admin";

  const statusLabel =
    status === "online" ? "Firebase · Online" :
    status === "offline" ? "Firebase · Offline" : "Provjera...";
  const statusColor =
    status === "online" ? "bg-emerald-400" :
    status === "offline" ? "bg-red-500" : "bg-amber-400 animate-pulse";

  return (
    <div ref={ref} className="relative flex-shrink-0">
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl pl-1 pr-2.5 py-1 hover:bg-white/10 transition-colors group"
        aria-label="Korisnički meni"
      >
        {/* Avatar */}
        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-300 to-green-600 flex items-center justify-center text-[11px] font-bold text-white shadow-inner ring-2 ring-white/20 tracking-wide select-none flex-shrink-0">
          {session.avatar || displayName.slice(0, 2).toUpperCase()}
        </span>
        {/* Name (desktop only) */}
        <span className="hidden sm:block text-sm font-medium text-white/90 max-w-[140px] truncate leading-tight">
          {displayName}
        </span>
        {/* Chevron */}
        <svg
          className={`hidden sm:block w-3.5 h-3.5 text-white/50 transition-transform duration-200 flex-shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] w-64 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-[100]">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-300 to-green-600 flex items-center justify-center text-base font-bold text-white shadow-md tracking-wide select-none flex-shrink-0">
                {session.avatar || displayName.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-50 truncate leading-tight">
                  {displayName}
                </p>
                <span className={`inline-flex items-center gap-1 mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  isAdmin
                    ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300"
                    : "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                }`}>
                  {isAdmin ? "● Admin" : session.operater ? "● Operater" : "● Projektant"}
                </span>
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 dark:text-gray-500">Status</span>
              <span className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                <span className={`w-2 h-2 rounded-full ${statusColor}`} />
                {statusLabel}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 dark:text-gray-500">Verzija</span>
              <span className="text-xs text-gray-600 dark:text-gray-300 font-mono">v{VERSION}</span>
            </div>
          </div>

          <div className="px-3 pt-2.5">
            <Link
              href="/postavke"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Icon name="gear" className="w-4 h-4 flex-shrink-0" />
              Postavke i profil
            </Link>
          </div>

          {/* Logout */}
          <div className="px-3 pb-2.5">
            <button
              onClick={() => { setOpen(false); logout(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
              </svg>
              Odjava
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 flex-shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60" aria-label="Početna">
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, slika je već optimizovana */}
      <img src={`${BASE}/icons/logo.png`} alt="" width={34} height={34} className="w-[34px] h-[34px] rounded-full ring-2 ring-white/25 bg-white" />
      <span className="hidden xl:flex flex-col leading-none">
        <span className="text-[13px] font-bold tracking-wide">Priprema</span>
        <span className="text-[10px] font-medium text-white/60 tracking-[0.12em] uppercase mt-0.5">proizvodnje</span>
      </span>
    </Link>
  );
}

function TopLink({ item, path }: { item: NavItem; path: string }) {
  const active = isActive(path, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
        active ? "bg-white/15 text-white font-semibold shadow-[inset_0_-2px_0_0_rgba(255,255,255,0.7)]" : "hover:bg-white/10 text-white/75 hover:text-white"
      }`}
    >
      {item.label}
    </Link>
  );
}

/** Srednje širine (tablet, manji laptop): glavne stavke + padajući "Više" */
function TopMore({ items, path }: { items: NavItem[]; path: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = items.some((i) => isActive(path, i.href));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          active || open ? "bg-white/15 text-white font-semibold" : "hover:bg-white/10 text-white/75 hover:text-white"
        }`}>
        Više
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] w-64 rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-100 dark:border-gray-700 p-1.5 z-[100]">
          {items.map((i) => {
            const on = isActive(path, i.href);
            return (
              <Link key={i.href} href={i.href} onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors ${
                  on ? "bg-green-50 dark:bg-green-950/50 text-green-800 dark:text-green-300 font-semibold" : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}>
                <Icon name={i.icon} className="w-[18px] h-[18px] text-green-700 dark:text-green-400" />
                {i.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BottomBar({ items, more, path }: { items: NavItem[]; more: NavItem[]; path: string }) {
  const [open, setOpen] = useState(false);
  const moreActive = more.some((m) => isActive(path, m.href));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const cell = (active: boolean) => `relative flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 text-[10.5px] font-medium transition-colors ${
    active ? "text-green-800 dark:text-green-300" : "text-gray-500 dark:text-gray-400 active:text-gray-800"
  }`;
  const indicator = <span className="absolute top-0 inset-x-5 h-[3px] rounded-b-full bg-green-700 dark:bg-green-400" aria-hidden />;

  return (
    <>
      {open && (
        <div className="md:hidden fixed inset-0 z-[60] print:hidden" role="dialog" aria-modal="true" aria-label="Više stranica">
          <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-label="Zatvori" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white dark:bg-gray-900 shadow-2xl px-4 pt-3"
            style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom, 0px))" }}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-700" aria-hidden />
            <nav className="grid grid-cols-2 gap-2">
              {more.map((m) => {
                const active = isActive(path, m.href);
                return (
                  <Link key={m.href} href={m.href} onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-3 border transition-colors ${
                      active
                        ? "border-green-600 bg-green-50 dark:bg-green-950/50"
                        : "border-gray-200 dark:border-gray-800 active:bg-gray-50 dark:active:bg-gray-800"
                    }`}>
                    <span className="w-9 h-9 flex-shrink-0 rounded-xl bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 flex items-center justify-center">
                      <Icon name={m.icon} className="w-[18px] h-[18px]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{m.label}</span>
                      <span className="block text-[11px] text-gray-500 dark:text-gray-400 truncate">{m.desc}</span>
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
      <nav aria-label="Glavna navigacija"
        className="md:hidden fixed inset-x-0 bottom-0 z-[70] bg-white/95 dark:bg-gray-950/95 backdrop-blur border-t border-gray-200 dark:border-gray-800 flex print:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {items.map((it) => {
          const active = isActive(path, it.href) && !open;
          return (
            <Link key={it.href} href={it.href} className={cell(active)} aria-current={active ? "page" : undefined}>
              {active && indicator}
              <Icon name={it.icon} className="w-[22px] h-[22px]" strokeWidth={active ? 2.2 : 1.8} />
              {it.short ?? it.label}
            </Link>
          );
        })}
        {more.length > 0 && (
          <button type="button" onClick={() => setOpen((v) => !v)} className={cell(open || moreActive)} aria-expanded={open}>
            {(open || moreActive) && indicator}
            <Icon name={open ? "close" : "grid"} className="w-[22px] h-[22px]" strokeWidth={open || moreActive ? 2.2 : 1.8} />
            Više
          </button>
        )}
      </nav>
    </>
  );
}

export default function Nav() {
  const path = usePathname();
  const status = useConnectionStatus();
  const { session } = useAuth();
  const toast = useNewEntryNotifier();

  if (!session) return null;

  const nav = navFor(session);
  const more = nav.all.filter((l) => !nav.primary.includes(l));
  const current = nav.all.find((l) => isActive(path, l.href));
  // Postavke su u korisničkom meniju na desktopu
  const desktopAll = nav.all.filter((l) => l.href !== "/postavke");

  return (
    <>
      {toast && (
        <div className="fixed top-16 right-4 z-50 flex items-center gap-2 bg-green-700 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
          <span>🔔</span>
          <span>{toast}</span>
        </div>
      )}
      <nav className="bg-green-800 text-white shadow-md sticky top-0 z-50 print:hidden" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-3 h-14">
          <Logo />

          {/* Mobitel: naziv trenutne stranice; linkovi su u donjoj traci */}
          <span className="md:hidden flex-1 min-w-0 truncate text-[15px] font-semibold">{current?.label ?? ""}</span>

          <span className="hidden md:block w-px h-6 bg-white/15 flex-shrink-0" aria-hidden />
          {/* xl+: sve stavke */}
          <div className="hidden xl:flex items-center gap-0.5 flex-1 min-w-0">
            {desktopAll.map((l) => <TopLink key={l.href} item={l} path={path} />)}
          </div>
          {/* md–xl: glavne stavke + Više */}
          <div className="hidden md:flex xl:hidden items-center gap-0.5 flex-1 min-w-0">
            {nav.primary.map((l) => <TopLink key={l.href} item={l} path={path} />)}
            <TopMore items={desktopAll.filter((l) => !nav.primary.includes(l))} path={path} />
          </div>

          <UserMenu status={status} />
        </div>
      </nav>
      <BottomBar items={nav.primary} more={more} path={path} />
    </>
  );
}
