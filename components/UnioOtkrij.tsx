"use client";
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";

/** Ime osobe koja je unijela/izmijenila podatak skriveno je dok se ne klikne */
export function UnioOtkrij({ children, label = "ko je unio?" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      title={open ? "Sakrij" : undefined}
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${
        open
          ? "text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800"
          : "border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-700 hover:border-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-500"
      }`}
    >
      <Icon name="user" className="w-3 h-3 flex-shrink-0" strokeWidth={2} />
      {open ? children : label}
    </button>
  );
}
