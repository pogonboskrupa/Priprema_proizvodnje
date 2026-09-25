"use client";
import { useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { VrstaPomocnog } from "@/lib/types";
import { POMOCNI, VRSTE_POMOCNI } from "@/lib/pomocni";

export type Cetka = VrstaPomocnog | "BRISI";

export function CetkaTraka({ value, onChange }: { value: Cetka; onChange: (c: Cetka) => void }) {
  return (
    <div role="radiogroup" aria-label="Vrsta za upis" className="flex flex-wrap items-center gap-1.5">
      {VRSTE_POMOCNI.map((v) => {
        const on = value === v;
        return (
          <button key={v} type="button" role="radio" aria-checked={on} onClick={() => onChange(v)}
            className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${
              on
                ? `${POMOCNI[v].badge} border-current shadow-sm`
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500"
            }`}>
            <span className={`w-2.5 h-2.5 rounded-full ${POMOCNI[v].dot}`} aria-hidden />
            {POMOCNI[v].label}
            <kbd className="hidden sm:inline text-[10px] font-mono opacity-60">{POMOCNI[v].kod}</kbd>
          </button>
        );
      })}
      <button type="button" role="radio" aria-checked={value === "BRISI"} onClick={() => onChange("BRISI")}
        className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${
          value === "BRISI"
            ? "border-gray-800 dark:border-gray-200 bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900"
            : "border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-500"
        }`}>
        Briši
      </button>
    </div>
  );
}

/**
 * Mišem: pritisni i prevuci preko ćelija. Dodirom: tap po ćeliji (povlačenje prstom je scroll).
 * Prva ćelija poteza određuje radnju: ako već ima odabranu vrstu, potez briše.
 */
export function useCetkaPotez<T>(cetka: Cetka, apply: (target: T, v: VrstaPomocnog | null) => void) {
  const mode = useRef<VrstaPomocnog | null | undefined>(undefined);
  const skipClick = useRef(false);
  const applyRef = useRef(apply);
  useEffect(() => { applyRef.current = apply; }, [apply]);

  useEffect(() => {
    const stop = () => {
      mode.current = undefined;
      // click (ako ga ima) stiže sinhrono poslije pointerup; potez završen na drugoj ćeliji ga nema
      setTimeout(() => { skipClick.current = false; }, 0);
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  const start = (t: T, trenutna: VrstaPomocnog | undefined) => {
    const v = cetka === "BRISI" || trenutna === cetka ? null : cetka;
    mode.current = v;
    applyRef.current(t, v);
  };

  return {
    onPointerDown(t: T, trenutna: VrstaPomocnog | undefined, e: ReactPointerEvent) {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      e.preventDefault();
      skipClick.current = true;
      start(t, trenutna);
    },
    onPointerEnter(t: T, e: ReactPointerEvent) {
      if (mode.current === undefined || e.pointerType !== "mouse" || !(e.buttons & 1)) return;
      applyRef.current(t, mode.current);
    },
    onClick(t: T, trenutna: VrstaPomocnog | undefined) {
      if (skipClick.current) { skipClick.current = false; return; }
      start(t, trenutna);
      mode.current = undefined;
    },
  };
}
