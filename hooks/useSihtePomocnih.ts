"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSihteZaMjesec, saveSihtaPomocnog } from "@/lib/db";
import type { VrstaPomocnog } from "@/lib/types";
import type { DaniSihte } from "@/lib/pomocni";

type Sihte = Record<string, DaniSihte>;
export type IzmjeneDana = Record<number, VrstaPomocnog | null>;

// Potez četkom preko više dana = jedan upis dokumenta, ne upis po ćeliji
const SAVE_DELAY_MS = 600;
const EMPTY: Sihte = {};

interface Stanje { key: string; sihte: Sihte; error: boolean }

export function useSihtePomocnih(year: number, month: number, onSaveError: () => void) {
  const key = `${year}-${month}`;
  // loading se izvodi iz ključa: dok stanje ne pripada traženom mjesecu, učitava se
  const [stanje, setStanje] = useState<Stanje | null>(null);
  const data = useRef<Sihte>({});
  const ym = useRef({ year, month, key });
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const onError = useRef(onSaveError);

  useEffect(() => { onError.current = onSaveError; }, [onSaveError]);

  const persist = useCallback((radnikId: string) => {
    const { year: y, month: m } = ym.current;
    saveSihtaPomocnog(radnikId, y, m, data.current[radnikId] ?? {}).catch(() => onError.current());
  }, []);

  // Čita data/ym prije nego ih novi mjesec zamijeni — zato se zove iz cleanup-a
  const flush = useCallback(() => {
    for (const [radnikId, t] of pending.current) {
      clearTimeout(t);
      persist(radnikId);
    }
    pending.current.clear();
  }, [persist]);

  useEffect(() => {
    let cancelled = false;
    ym.current = { year, month, key };
    data.current = {};
    getSihteZaMjesec(year, month)
      .then((s) => {
        if (cancelled) return;
        data.current = s;
        setStanje({ key, sihte: s, error: false });
      })
      .catch(() => { if (!cancelled) setStanje({ key, sihte: {}, error: true }); });
    return () => { cancelled = true; flush(); };
  }, [year, month, key, flush]);

  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [flush]);

  const postavi = useCallback((radnikId: string, izmjene: IzmjeneDana) => {
    const next: DaniSihte = { ...(data.current[radnikId] ?? {}) };
    for (const [dan, v] of Object.entries(izmjene)) {
      if (v) next[dan] = v;
      else delete next[dan];
    }
    data.current = { ...data.current, [radnikId]: next };
    setStanje({ key: ym.current.key, sihte: data.current, error: false });

    const t = pending.current.get(radnikId);
    if (t) clearTimeout(t);
    pending.current.set(radnikId, setTimeout(() => {
      pending.current.delete(radnikId);
      persist(radnikId);
    }, SAVE_DELAY_MS));
  }, [persist]);

  const loading = stanje?.key !== key;
  return {
    sihte: loading ? EMPTY : stanje.sihte,
    loading,
    error: !loading && stanje.error,
    postavi,
  };
}
