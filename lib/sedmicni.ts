import type { Korisnik, UnosRada, VrstaRada } from "@/lib/types";
import { localDateStr } from "@/lib/format";
import { fmtBroj } from "@/lib/sihtarica";

export const DANI_SEDMICE = ["Ponedjeljak", "Utorak", "Srijeda", "Četvrtak", "Petak", "Subota"] as const;

const ODSUSTVO_SIFRA: Partial<Record<VrstaRada, string>> = {
  KANCELARIJA: "K",
  BOLOVANJE: "B",
  GODISNJI: "GO",
  TEREN: "T",
};

export interface SedmicniRed {
  korisnik: Korisnik;
  odjeli: string[];
  /** Po danu: grupe linija, jedna grupa po unosu */
  dani: string[][][];
  stabala: number;
  ha: number;
  km: number;
}

export function ponedjeljak(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() || 7) - 1));
  return m;
}

export function pomjeriDane(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const odjelLabel = (u: UnosRada) => (u.odjel ? `${u.odjel.gj} ${u.odjel.broj}` : null);

function linijeUnosa(u: UnosRada): string[] {
  const linije: string[] = [];
  if (u.vrsta === "DOZNAKA" || u.vrsta === "VLAKA") {
    const o = odjelLabel(u);
    if (o) linije.push(o);
    if (u.vrsta === "DOZNAKA") {
      if (u.brojStabala) linije.push(String(u.brojStabala));
      if (u.hektari) linije.push(`${fmtBroj(u.hektari)}ha`);
    } else {
      linije.push("VLAKA");
      if (u.kilometri) linije.push(`${fmtBroj(u.kilometri)}km`);
    }
  } else {
    linije.push(ODSUSTVO_SIFRA[u.vrsta] ?? u.vrsta);
  }
  const nap = u.napomena?.trim();
  if (nap) linije.push(nap.toUpperCase());
  return linije;
}

export function sedmicniRedovi(korisnici: readonly Korisnik[], unosi: readonly UnosRada[], datumi: readonly string[]): SedmicniRed[] {
  const poRadniku = new Map<string, UnosRada[]>();
  for (const u of unosi) {
    const list = poRadniku.get(u.inzinjerId);
    if (list) list.push(u);
    else poRadniku.set(u.inzinjerId, [u]);
  }
  return korisnici.map((korisnik) => {
    const svi = (poRadniku.get(korisnik.id) ?? []).filter((u) => datumi.includes(u.datum.slice(0, 10)));
    const odjeli = [...new Set(svi.map(odjelLabel).filter((o): o is string => !!o))];
    const dani = datumi.map((d) => svi.filter((u) => u.datum.slice(0, 10) === d).map(linijeUnosa));
    const zbir = (f: (u: UnosRada) => number) => svi.reduce((s, u) => s + f(u), 0);
    return {
      korisnik,
      odjeli,
      dani,
      stabala: zbir((u) => (u.vrsta === "DOZNAKA" ? Number(u.brojStabala) || 0 : 0)),
      ha: zbir((u) => (u.vrsta === "DOZNAKA" ? Number(u.hektari) || 0 : 0)),
      km: zbir((u) => (u.vrsta === "VLAKA" ? Number(u.kilometri) || 0 : 0)),
    };
  });
}

/** Pon–Pet; subota samo ako neko ima unos tog dana */
export function datumiSedmice(pon: Date, unosi: readonly UnosRada[]): string[] {
  const datumi = Array.from({ length: 6 }, (_, i) => localDateStr(pomjeriDane(pon, i)));
  const subota = datumi[5];
  return unosi.some((u) => u.datum.slice(0, 10) === subota) ? datumi : datumi.slice(0, 5);
}

/** "07.09 – 11.09.2026" */
export function rasponLabel(datumi: readonly string[]): string {
  const f = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}`;
  const zadnji = datumi[datumi.length - 1];
  return `${f(datumi[0])} – ${f(zadnji)}.${zadnji.slice(0, 4)}`;
}
