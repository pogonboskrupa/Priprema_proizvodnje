"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getRadPoProjektantima } from "@/lib/db";
import type { Korisnik, UnosRada } from "@/lib/types";
import { useUnosiRefresh } from "@/hooks/useUnosiRefresh";

export interface RadPoProjektantima {
  korisnici: Korisnik[];
  unosi: UnosRada[];
}

/** Unosi svih projektanata u periodu [od, do_]; stari podaci ostaju dok stižu novi */
export function useRadPoProjektantima(od: Date, do_: Date) {
  const odMs = od.getTime();
  const doMs = do_.getTime();
  const key = `${odMs}|${doMs}`;
  const [podaci, setPodaci] = useState<RadPoProjektantima | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [err, setErr] = useState("");
  const reqId = useRef(0);

  const load = useCallback((): Promise<void> => {
    const id = ++reqId.current;
    return getRadPoProjektantima(new Date(odMs), new Date(doMs))
      .then((r) => {
        if (id !== reqId.current) return;
        setPodaci(r);
        setErr("");
      })
      .catch(() => { if (id === reqId.current) setErr("Greška pri učitavanju — provjeri internet i pokušaj ponovo."); })
      .finally(() => { if (id === reqId.current) setLoadedKey(`${odMs}|${doMs}`); });
  }, [odMs, doMs]);

  useEffect(() => { load(); }, [load]);
  useUnosiRefresh(load);

  return { podaci, loading: loadedKey !== key, err };
}
