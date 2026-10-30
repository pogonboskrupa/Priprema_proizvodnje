"use client";
import { useEffect, useState } from "react";
import { getSumarije } from "@/lib/db";
import type { Sumarija } from "@/lib/sumarija";

export function useSumarije(): Sumarija[] {
  const [lista, setLista] = useState<Sumarija[]>([]);
  useEffect(() => {
    let otkazano = false;
    getSumarije().then((s) => { if (!otkazano) setLista(s); }).catch(() => {});
    return () => { otkazano = true; };
  }, []);
  return lista;
}
