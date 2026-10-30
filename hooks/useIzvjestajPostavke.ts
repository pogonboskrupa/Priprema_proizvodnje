"use client";
import { useEffect, useState } from "react";
import { getZadanePostavke, pratiIzvjestajPostavke } from "@/lib/db";
import { ZADANE_POSTAVKE, type IzvjestajPostavke } from "@/lib/izvjestaj-postavke";

/** Uživo: izmjena u Postavkama odmah se vidi u otvorenom izvještaju; `zadane` je zaglavlje izvedeno iz naziva šumarije */
export function useIzvjestajPostavke(): { postavke: IzvjestajPostavke; zadane: IzvjestajPostavke; ucitano: boolean } {
  const [stanje, setStanje] = useState<{ postavke: IzvjestajPostavke; ucitano: boolean }>({ postavke: ZADANE_POSTAVKE, ucitano: false });
  const [zadane, setZadane] = useState<IzvjestajPostavke>(ZADANE_POSTAVKE);
  useEffect(() => pratiIzvjestajPostavke((postavke) => setStanje({ postavke, ucitano: true })), []);
  useEffect(() => {
    let otkazano = false;
    getZadanePostavke().then((z) => { if (!otkazano) setZadane(z); }).catch(() => {});
    return () => { otkazano = true; };
  }, []);
  return { ...stanje, zadane };
}
