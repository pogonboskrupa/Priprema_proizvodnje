"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { VERSION } from "@/lib/version";

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

const links = [
  { href: "/", label: "Početna" },
  { href: "/unos", label: "Unos rada" },
  { href: "/izvjestaji", label: "Izvještaji" },
  { href: "/odjeli", label: "Odjeli" },
  { href: "/inzinjeri", label: "Inžinjeri" },
];

export default function Nav() {
  const path = usePathname();
  const status = useConnectionStatus();

  const dot =
    status === "online"
      ? { color: "bg-green-400", label: "Online · Firebase OK" }
      : status === "offline"
      ? { color: "bg-red-500", label: "Offline · nema konekcije" }
      : { color: "bg-yellow-400 animate-pulse", label: "Provjera konekcije..." };

  return (
    <nav className="bg-green-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 h-14">
        <span className="font-bold text-lg mr-4 whitespace-nowrap">🌲 Priprema Proizvodnje</span>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              path === l.href
                ? "bg-white/20 text-white"
                : "hover:bg-white/10 text-green-100"
            }`}
          >
            {l.label}
          </Link>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-green-300 text-xs hidden sm:block">v{VERSION}</span>
          <div className="relative group">
            <span className={`block w-3 h-3 rounded-full ${dot.color}`} />
            <div className="absolute right-0 top-5 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              {dot.label}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
