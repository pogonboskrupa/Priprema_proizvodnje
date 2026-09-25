import type { VrstaPomocnog } from "@/lib/types";
import { VRSTA } from "@/lib/vrste";
import { praznik, jeRadniDan } from "@/lib/praznici";

export interface PomocniStil {
  label: string;
  /** Oznaka u ćeliji matrice (1–2 slova) */
  kod: string;
  dot: string;
  /** Svijetla pozadina + tamni tekst — čitljivo u oba moda */
  badge: string;
  text: string;
}

// Zajedničke vrste preuzimaju boje iz lib/vrste da Teren izgleda isto kao kod projektanata
export const POMOCNI: Record<VrstaPomocnog, PomocniStil> = {
  TEREN:       { label: VRSTA.TEREN.label,       kod: "T",  dot: VRSTA.TEREN.dot,       badge: VRSTA.TEREN.badge,       text: VRSTA.TEREN.text },
  KANCELARIJA: { label: VRSTA.KANCELARIJA.label, kod: "K",  dot: VRSTA.KANCELARIJA.dot, badge: VRSTA.KANCELARIJA.badge, text: VRSTA.KANCELARIJA.text },
  GODISNJI:    { label: VRSTA.GODISNJI.label,    kod: "GO", dot: VRSTA.GODISNJI.dot,    badge: VRSTA.GODISNJI.badge,    text: VRSTA.GODISNJI.text },
  BOLOVANJE:   { label: VRSTA.BOLOVANJE.label,   kod: "B",  dot: VRSTA.BOLOVANJE.dot,   badge: VRSTA.BOLOVANJE.badge,   text: VRSTA.BOLOVANJE.text },
  OSTALO: {
    label: "Ostalo", kod: "O", dot: "bg-slate-400",
    badge: "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-100",
    text: "text-slate-600 dark:text-slate-300",
  },
};

export const VRSTE_POMOCNI: readonly VrstaPomocnog[] = ["TEREN", "KANCELARIJA", "GODISNJI", "BOLOVANJE", "OSTALO"];

export type DaniSihte = Record<string, VrstaPomocnog>;

export interface DanMjeseca {
  dan: number;
  datum: string;
  /** 0 = Pon … 6 = Ned */
  dow: number;
  vikend: boolean;
  praznik: string | null;
  radni: boolean;
}

export function daniUMjesecu(year: number, month: number): DanMjeseca[] {
  const n = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return Array.from({ length: n }, (_, i) => {
    const dan = i + 1;
    const datum = `${year}-${mm}-${String(dan).padStart(2, "0")}`;
    const js = new Date(year, month - 1, dan).getDay();
    const dow = js === 0 ? 6 : js - 1;
    return { dan, datum, dow, vikend: dow >= 5, praznik: praznik(datum), radni: jeRadniDan(datum) };
  });
}

export interface RezimeSihte {
  po: Record<VrstaPomocnog, number>;
  ukupno: number;
  /** Radni dani do danas (ili cijeli prošli mjesec) bez upisa */
  nepopunjeno: number;
}

export function rezimeSihte(dani: DaniSihte, kalendar: readonly DanMjeseca[], danas: string): RezimeSihte {
  const po = { TEREN: 0, KANCELARIJA: 0, GODISNJI: 0, BOLOVANJE: 0, OSTALO: 0 } satisfies Record<VrstaPomocnog, number>;
  let nepopunjeno = 0;
  for (const d of kalendar) {
    const v = dani[String(d.dan)];
    if (v) po[v]++;
    else if (d.radni && d.datum <= danas) nepopunjeno++;
  }
  return { po, ukupno: Object.values(po).reduce((s, n) => s + n, 0), nepopunjeno };
}

export function inicijali(ime: string, prezime: string): string {
  return ((prezime[0] ?? "") + (ime[0] ?? "")).toUpperCase() || "?";
}

export function punoIme(r: { ime: string; prezime: string }): string {
  return `${r.prezime} ${r.ime}`.trim();
}
