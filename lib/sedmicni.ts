import type { Korisnik, UnosRada, VrstaRada } from "@/lib/types";
import { localDateStr } from "@/lib/format";
import { fmtBroj } from "@/lib/sihtarica";

export const DANI_SEDMICE = ["Ponedjeljak", "Utorak", "Srijeda", "Četvrtak", "Petak", "Subota"] as const;

const ODSUSTVO_SIFRA: Partial<Record<VrstaRada, string>> = {
  KANCELARIJA: "K",
  BOLOVANJE: "B",
  CLAN76: "ČL.76",
  PLACENO: "PO",
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

/** Dio sedmice (Pon–Sub) unutar jednog mjeseca; od i do_ su ponoć prvog i zadnjeg dana */
export interface SegmentSedmice { od: Date; do_: Date }

const bezNedjelje = (d: Date, smjer: 1 | -1) => (d.getDay() === 0 ? pomjeriDane(d, smjer) : d);

/** Sedmica koja prelazi mjesec dijeli se na dva izvještaja, npr. 28.09–30.09 i 01.10–03.10 */
export function segmentSedmice(datum: Date): SegmentSedmice {
  const d = bezNedjelje(new Date(datum.getFullYear(), datum.getMonth(), datum.getDate()), -1);
  const pon = ponedjeljak(d);
  const sub = pomjeriDane(pon, 5);
  const prvi = new Date(d.getFullYear(), d.getMonth(), 1);
  const zadnji = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { od: pon < prvi ? prvi : pon, do_: sub > zadnji ? zadnji : sub };
}

export const sljedeciSegment = (s: SegmentSedmice) => segmentSedmice(bezNedjelje(pomjeriDane(s.do_, 1), 1));
export const prethodniSegment = (s: SegmentSedmice) => segmentSedmice(bezNedjelje(pomjeriDane(s.od, -1), -1));

/** Radni dani segmenta; subota samo ako neko ima unos tog dana ili je jedini dan segmenta */
export function datumiSegmenta(s: SegmentSedmice, unosi: readonly UnosRada[]): string[] {
  const svi: Date[] = [];
  for (let d = s.od; d <= s.do_; d = pomjeriDane(d, 1)) svi.push(d);
  const radni = svi.filter((d) => d.getDay() >= 1 && d.getDay() <= 5).map((d) => localDateStr(d));
  const subota = svi.find((d) => d.getDay() === 6);
  if (!subota) return radni;
  const sub = localDateStr(subota);
  return !radni.length || unosi.some((u) => u.datum.slice(0, 10) === sub) ? [...radni, sub] : radni;
}

/** "2026-09-28" → "Ponedjeljak" */
export function nazivDana(datum: string): string {
  const [y, m, d] = datum.split("-").map(Number);
  return DANI_SEDMICE[new Date(y, m - 1, d).getDay() - 1] ?? "";
}

/** "28.09 – 30.09.2026" */
export function rasponLabel(datumi: readonly string[]): string {
  if (!datumi.length) return "";
  const f = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}`;
  const zadnji = datumi[datumi.length - 1];
  return datumi.length === 1 ? `${f(zadnji)}.${zadnji.slice(0, 4)}` : `${f(datumi[0])} – ${f(zadnji)}.${zadnji.slice(0, 4)}`;
}
