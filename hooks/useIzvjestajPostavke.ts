"use client";
import { useEffect, useState } from "react";
import { pratiIzvjestajPostavke } from "@/lib/db";
import { ZADANE_POSTAVKE, type IzvjestajPostavke } from "@/lib/izvjestaj-postavke";

/** Uživo: izmjena u Postavkama odmah se vidi u otvorenom izvještaju */
export function useIzvjestajPostavke(): { postavke: IzvjestajPostavke; ucitano: boolean } {
  const [stanje, setStanje] = useState<{ postavke: IzvjestajPostavke; ucitano: boolean }>({ postavke: ZADANE_POSTAVKE, ucitano: false });
  useEffect(() => pratiIzvjestajPostavke((postavke) => setStanje({ postavke, ucitano: true })), []);
  return stanje;
}
