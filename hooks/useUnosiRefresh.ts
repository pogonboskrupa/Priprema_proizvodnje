"use client";
import { useEffect, useRef } from "react";
import { onUnosiChanges } from "@/lib/firebase";

/**
 * Poziva reload kad se unosi promijene — upis na drugoj stranici, u drugom tabu
 * ili na drugom uređaju. Više promjena zaredom (npr. "Popuni period") = jedan reload.
 */
export function useUnosiRefresh(reload: () => void, delayMs = 400) {
  const ref = useRef(reload);
  useEffect(() => { ref.current = reload; });
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const unsub = onUnosiChanges(() => {
      clearTimeout(t);
      t = setTimeout(() => ref.current(), delayMs);
    });
    return () => { unsub(); clearTimeout(t); };
  }, [delayMs]);
}
