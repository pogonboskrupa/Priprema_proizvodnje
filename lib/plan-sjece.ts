import type { Odjel, OdjelGodina } from "@/lib/types";
import { EVIDENCIJA_OD } from "@/lib/godine";

const PRAZNO: OdjelGodina = { plan_cet: 0, plan_lis: 0, real_cet: 0, real_lis: 0 };

/**
 * Plan i realizacija odjela za godinu. Vrijednosti upisane prije uvođenja godina
 * (ravna polja na odjelu) pripadaju prvoj godini evidencije.
 */
export function odjelZaGodinu(o: Odjel, year: number): OdjelGodina {
  const g = o.poGodini?.[String(year)];
  if (g) return { ...PRAZNO, ...g };
  if (year === EVIDENCIJA_OD) {
    return {
      plan_cet: Number(o.plan_cet) || 0,
      plan_lis: Number(o.plan_lis) || 0,
      real_cet: Number(o.real_cet) || 0,
      real_lis: Number(o.real_lis) || 0,
    };
  }
  return PRAZNO;
}

export function imaPodatke(g: OdjelGodina): boolean {
  return g.plan_cet > 0 || g.plan_lis > 0 || g.real_cet > 0 || g.real_lis > 0;
}
