"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { isActive } from "@/lib/nav";

// Odjeli su zadani podtab; URL-ovi stranica su ostali isti, pa postojeće veze i oznake rade
const PODTABOVI: readonly { href: string; label: string; icon: IconName }[] = [
  { href: "/odjeli", label: "Odjeli", icon: "map" },
  { href: "/plan", label: "Plan doznake", icon: "tree" },
  { href: "/realizacija", label: "Realizacija", icon: "trend" },
];

export default function PlanDoznakeLayout({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div>
      <nav aria-label="Plan doznake" className="print:hidden mb-6 flex overflow-x-auto">
        <div className="inline-flex gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800">
          {PODTABOVI.map((t) => {
            const aktivan = isActive(path, t.href);
            return (
              <Link key={t.href} href={t.href} aria-current={aktivan ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${
                  aktivan
                    ? "bg-white dark:bg-gray-900 text-green-800 dark:text-green-300 shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                }`}>
                <Icon name={t.icon} className="w-4 h-4" />{t.label}
              </Link>
            );
          })}
        </div>
      </nav>
      {children}
    </div>
  );
}
