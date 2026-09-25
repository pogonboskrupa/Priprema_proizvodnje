"use client";
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";

/** Ime osobe koja je unijela/izmijenila podatak skriveno je dok se ne klikne */
export function UnioOtkrij({ children, label }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      title={open ? "Sakrij" : (label ?? "Ko je unio?")}
      className={`inline-flex items-center gap-1 rounded-full leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${
        open
          ? "px-1.5 py-0.5 text-[11px] text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800"
          : "w-4 h-4 justify-center text-[10px] font-semibold italic border border-blue-300 dark:border-blue-700 text-blue-400 dark:text-blue-500 hover:text-blue-600 hover:border-blue-500 dark:hover:text-blue-300 dark:hover:border-blue-400 bg-blue-50 dark:bg-blue-950/40"
      }`}
    >
      {open ? (
        <>
          <Icon name="user" className="w-3 h-3 flex-shrink-0" strokeWidth={2} />
          {children}
        </>
      ) : "i"}
    </button>
  );
}
