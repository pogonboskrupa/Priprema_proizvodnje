"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { db, collection, query, orderBy, onSnapshot } from "@/lib/firebase";
import { getDocs, limit } from "firebase/firestore";
import { VERSION } from "@/lib/version";
import { useAuth } from "@/context/AuthContext";

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

const adminLinks = [
  { href: "/", label: "Početna" },
  { href: "/unos-ucinka", label: "Unos učinka" },
  { href: "/izvjestaji", label: "Izvještaji" },
  { href: "/kalendar", label: "Kalendar" },
  { href: "/odjeli", label: "Odjeli" },
  { href: "/plan", label: "Plan sječe" },
  { href: "/plan-projektant", label: "Plan/projektant" },
  { href: "/realizacija", label: "Realizacija" },
  { href: "/elaborat", label: "Elaborat" },
  { href: "/postavke", label: "Postavke" },
];

const workerLinks = [
  { href: "/", label: "Početna" },
  { href: "/unos", label: "Unos rada" },
  { href: "/izvjestaji", label: "Izvještaji" },
  { href: "/kalendar", label: "Kalendar" },
  { href: "/elaborat", label: "Elaborat" },
  { href: "/moji-odjeli", label: "Moji odjeli" },
  { href: "/postavke", label: "Postavke" },
];

function useNewEntryNotifier() {
  const [toast, setToast] = useState<string | null>(null);
  const { session } = useAuth();
  const initializedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (session?.role !== "admin") return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    initializedRef.current = false;
    const q = query(collection(db, "unosi"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      if (!initializedRef.current) { initializedRef.current = true; return; }
      const added = snapshot.docChanges().filter((c) => c.type === "added");
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

          {/* Logout */}
          <div className="px-3 py-2.5">
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

export default function Nav() {
  const path = usePathname();
  const status = useConnectionStatus();
  const { session } = useAuth();
  const toast = useNewEntryNotifier();

  const links =
    session?.role === "admin"
      ? adminLinks
      : session?.operater
      ? [...workerLinks, { href: "/unos-ucinka", label: "Unos učinka" }]
      : workerLinks;

  if (!session) return null;

  return (
    <>
      {toast && (
        <div className="fixed top-16 right-4 z-50 flex items-center gap-2 bg-green-700 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
          <span>🔔</span>
          <span>{toast}</span>
        </div>
      )}
      <nav className="bg-green-800 text-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 h-14">
          {/* Logo */}
          <Link href="/" className="font-bold text-sm mr-2 whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 hover:opacity-80 transition-opacity">
            🌲 <span className="tracking-wide">PP</span>
          </Link>

          {/* Separator */}
          <span className="w-px h-5 bg-white/20 mr-1 flex-shrink-0" />

          {/* Links — scrollable */}
          <div className="flex items-center gap-0.5 overflow-x-auto flex-1 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                  path === l.href
                    ? "bg-white/20 text-white font-semibold"
                    : "hover:bg-white/10 text-white/80 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* User menu */}
          <div className="ml-2">
            <UserMenu status={status} />
          </div>
        </div>
      </nav>
    </>
  );
}
