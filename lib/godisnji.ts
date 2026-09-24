import type { UnosRada } from "@/lib/types";
import { jeRadniDan } from "@/lib/praznici";

// Pravo na GO se broji od 1. jula: neiskorišteni dani prethodne godine važe do 30. juna
export const GO_POCETAK_MJESEC = 7;

export interface GoPeriod {
  /** Godina u kojoj period počinje — ključ u Korisnik.goDanaPoUgovoru */
  godina: number;
  od: string; // "YYYY-07-01"
  do: string; // "YYYY+1-06-30"
  label: string; // "2026/27"
}

export function goPeriod(year: number, month: number): GoPeriod {
  const godina = month >= GO_POCETAK_MJESEC ? year : year - 1;
  return {
    godina,
    od: `${godina}-07-01`,
    do: `${godina + 1}-06-30`,
    label: `${godina}/${String(godina + 1).slice(2)}`,
  };
}

/**
 * Broj radnih dana s GO unosom u periodu. Vikendi i praznici se po Zakonu o radu
 * ne uračunavaju u godišnji; dva unosa istog dana = jedan dan.
 */
export function iskoristenoDanaGO(unosi: readonly UnosRada[], p: GoPeriod): number {
  const dani = new Set<string>();
  for (const u of unosi) {
    if (u.vrsta !== "GODISNJI") continue;
    const d = u.datum.slice(0, 10);
    if (d >= p.od && d <= p.do && jeRadniDan(d)) dani.add(d);
  }
  return dani.size;
}
