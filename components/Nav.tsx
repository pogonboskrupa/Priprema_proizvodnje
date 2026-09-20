"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Početna" },
  { href: "/unos", label: "Unos rada" },
  { href: "/izvjestaji", label: "Izvještaji" },
  { href: "/odjeli", label: "Odjeli" },
  { href: "/inzinjeri", label: "Inžinjeri" },
];

export default function Nav() {
  const path = usePathname();
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
      </div>
    </nav>
  );
}
