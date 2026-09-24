import { mesecLabel } from "@/lib/format";

/** Prva godina vođenja evidencije — ranije godine se nigdje ne nude */
export const EVIDENCIJA_OD = 2026;
export const EVIDENCIJA_OD_DATUM = `${EVIDENCIJA_OD}-01-01`;

/**
 * Godine evidencije, najnovija prva. Nova godina se pojavljuje sama od 1. januara,
 * a prošle ostaju u listi kao arhiva.
 * iSljedeca: dodaje narednu godinu (za unos plana unaprijed).
 */
export function godineEvidencije(opts: { iSljedeca?: boolean } = {}): number[] {
  const zadnja = Math.max(new Date().getFullYear() + (opts.iSljedeca ? 1 : 0), EVIDENCIJA_OD);
  return Array.from({ length: zadnja - EVIDENCIJA_OD + 1 }, (_, i) => zadnja - i);
}

export interface MjesecOpcija {
  value: string; // "YYYY-MM"
  label: string;
  year: number;
  month: number; // 1-12
}

/** Mjeseci od januara prve godine evidencije do tekućeg, najnoviji prvi */
export function mjeseciEvidencije(): MjesecOpcija[] {
  const now = new Date();
  const opts: MjesecOpcija[] = [];
  for (let d = new Date(now.getFullYear(), now.getMonth(), 1); d.getFullYear() >= EVIDENCIJA_OD; d.setMonth(d.getMonth() - 1)) {
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    opts.push({ value: `${year}-${String(month).padStart(2, "0")}`, label: mesecLabel(d), year, month });
  }
  return opts;
}

export function jePrviMjesecEvidencije(year: number, month: number): boolean {
  return year < EVIDENCIJA_OD || (year === EVIDENCIJA_OD && month <= 1);
}
