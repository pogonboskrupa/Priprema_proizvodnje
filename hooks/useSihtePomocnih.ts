"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSihteZaMjesec, upisiDaneSihte } from "@/lib/db";
import type { VrstaPomocnog } from "@/lib/types";
import type { DaniSihte } from "@/lib/pomocni";

type Sihte = Record<string, DaniSihte>;
export type IzmjeneDana = Record<number, VrstaPomocnog | null>;

// Potez četkom preko više dana = jedan upis dokumenta, ne upis po ćeliji
const SAVE_DELAY_MS = 600;
const EMPTY: Sihte = {};

interface Stanje { key: string; sihte: Sihte; error: boolean }
/** Izmjene radnika koje čekaju upis; ključ = broj dana, null = obrisan dan */
interface Cekanje { timer: ReturnType<typeof setTimeout>; izmjene: Record<string, VrstaPomocnog | null> }

export function useSihtePomocnih(year: number, month: number, onSaveError: () => void) {
  const key = `${year}-${month}`;
  // loading se izvodi iz ključa: dok stanje ne pripada traženom mjesecu, učitava se
  const [stanje, setStanje] = useState<Stanje | null>(null);
  const data = useRef<Sihte>({});
  const ym = useRef({ year, month, key });
  const pending = useRef(new Map<string, Cekanje>());
  const onError = useRef(onSaveError);

  useEffect(() => { onError.current = onSaveError; }, [onSaveError]);

  const persist = useCallback((radnikId: string) => {
    const c = pending.current.get(radnikId);
    if (!c) return;
    clearTimeout(c.timer);
    pending.current.delete(radnikId);
    const { year: y, month: m } = ym.current;
    upisiDaneSihte(radnikId, y, m, c.izmjene).catch(() => onError.current());
  }, []);

  // Čita ym prije nego ga novi mjesec zamijeni — zato se zove iz cleanup-a
  const flush = useCallback(() => {
    for (const radnikId of [...pending.current.keys()]) persist(radnikId);
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

    const prev = pending.current.get(radnikId);
    if (prev) clearTimeout(prev.timer);
    pending.current.set(radnikId, {
      izmjene: { ...prev?.izmjene, ...izmjene },
      timer: setTimeout(() => persist(radnikId), SAVE_DELAY_MS),
    });
  }, [persist]);

  const loading = stanje?.key !== key;
  return {
    sihte: loading ? EMPTY : stanje.sihte,
    loading,
    error: !loading && stanje.error,
    postavi,
  };
}
