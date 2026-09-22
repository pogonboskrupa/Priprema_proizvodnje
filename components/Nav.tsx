"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, limit, query } from "firebase/firestore";
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
  { href: "/unos", label: "Unos rada" },
  { href: "/izvjestaji", label: "Izvještaji" },
  { href: "/kalendar", label: "Kalendar" },
  { href: "/odjeli", label: "Odjeli" },
  { href: "/inzinjeri", label: "Projektanti" },
  { href: "/plan", label: "Plan sječe" },
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
  { href: "/postavke", label: "Postavke" },
];

export default function Nav() {
  const path = usePathname();
  const status = useConnectionStatus();
  const { session, logout } = useAuth();

  const links = session?.role === "admin" ? adminLinks : workerLinks;

  const dot =
    status === "online"
      ? { color: "bg-green-400", label: "Online · Firebase OK" }
      : status === "offline"
      ? { color: "bg-red-500", label: "Offline · nema konekcije" }
      : { color: "bg-yellow-400 animate-pulse", label: "Provjera konekcije..." };

  if (!session) return null;

  return (
    <nav className="bg-green-800 text-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 h-14 overflow-x-auto">
        <span className="font-bold text-sm mr-3 whitespace-nowrap flex-shrink-0">🌲 PP</span>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
              path === l.href
                ? "bg-white/25 text-white font-semibold"
                : "hover:bg-white/15 text-white/85"
            }`}
          >
            {l.label}
          </Link>
        ))}

        <div className="ml-auto flex items-center gap-2 flex-shrink-0 pl-2">
          <span className="text-green-200 text-xs hidden sm:block whitespace-nowrap">
            {session.ime}
          </span>
          <span className="text-green-300 text-xs">v{VERSION}</span>

          <div className="relative group">
            <span className={`block w-3 h-3 rounded-full flex-shrink-0 ${dot.color}`} />
            <div className="absolute right-0 top-5 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              {dot.label}
            </div>
          </div>

          <button
            onClick={logout}
            className="border border-white/30 text-white/80 rounded px-2 py-1 text-xs hover:bg-white/10 whitespace-nowrap flex-shrink-0"
          >
            Odjava
          </button>
        </div>
      </div>
    </nav>
  );
}
