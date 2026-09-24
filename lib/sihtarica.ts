import type { UnosRada, VrstaRada } from "@/lib/types";
import { localDateStr } from "@/lib/format";
import { praznik, jeRadniDan } from "@/lib/praznici";
import { VRSTA } from "@/lib/vrste";

// Odsustvo isključuje rad istog dana; oba zajedno su greška u unosu
const ODSUSTVO: ReadonlySet<VrstaRada> = new Set<VrstaRada>(["GODISNJI", "BOLOVANJE"]);

export const DANI_KRATKO = ["Ned", "Pon", "Uto", "Sri", "Čet", "Pet", "Sub"] as const;

export interface DanSihtarice {
  datum: string; // "YYYY-MM-DD"
  dan: number;
  weekday: number; // 0 = nedjelja
  vikend: boolean;
  praznik: string | null;
  /** Vikend ili praznik */
  neradni: boolean;
  /** Nedjeljom se ne upisuje (isto pravilo kao Unos rada) */
  zakljucan: boolean;
  /** Godišnji/bolovanje zajedno s drugom aktivnošću istog dana */
  konflikt: boolean;
  buduci: boolean;
  danas: boolean;
  unosi: UnosRada[];
}

export function daniMjeseca(year: number, month: number, unosi: readonly UnosRada[]): DanSihtarice[] {
  const poDanu = new Map<string, UnosRada[]>();
  for (const u of unosi) {
    const k = u.datum.slice(0, 10);
    const list = poDanu.get(k);
    if (list) list.push(u);
    else poDanu.set(k, [u]);
  }
  const danas = localDateStr();
  const brojDana = new Date(year, month, 0).getDate();
  return Array.from({ length: brojDana }, (_, i) => {
    const d = new Date(year, month - 1, i + 1);
    const datum = localDateStr(d);
    const weekday = d.getDay();
    const vikend = weekday === 0 || weekday === 6;
    const p = praznik(datum);
    const dnevni = poDanu.get(datum) ?? [];
    return {
      datum,
      dan: i + 1,
      weekday,
      vikend,
      praznik: p,
      neradni: vikend || !!p,
      zakljucan: weekday === 0,
      konflikt: jeKonflikt(dnevni),
      buduci: datum > danas,
      danas: datum === danas,
      unosi: dnevni,
    };
  });
}

export function jeKonflikt(unosi: readonly { vrsta: VrstaRada }[]): boolean {
  const vrste = new Set(unosi.map((u) => u.vrsta));
  const odsustva = [...vrste].filter((v) => ODSUSTVO.has(v)).length;
  return odsustva > 0 && vrste.size > 1;
}

/**
 * Pravila upisa zajednička za Šihtaricu, Unos rada i Unos učinka.
 * null = dozvoljeno; inače poruka zašto nije.
 */
export function zabranaUpisa(datum: string, postojeci: readonly { vrsta: VrstaRada }[], vrsta: VrstaRada): string | null {
  const label = VRSTA[vrsta].label;
  // doznaka/vlaka mogu biti u više odjela istog dana
  const visestruko = vrsta === "DOZNAKA" || vrsta === "VLAKA";
  if (!visestruko && postojeci.some((u) => u.vrsta === vrsta)) return `${label} je već upisan za ovaj dan.`;
  if (vrsta === "GODISNJI" && !jeRadniDan(datum)) return "Godišnji se ne upisuje za vikend ni praznik — ti dani se ne troše iz godišnjeg.";
  if (jeKonflikt([...postojeci, { vrsta }])) {
    return ODSUSTVO.has(vrsta)
      ? `${label} je za cijeli dan — ovaj dan već ima drugu aktivnost.`
      : "Za ovaj dan je upisan godišnji ili bolovanje.";
  }
  return null;
}

export interface SihtaricaRezime {
  radnihDana: number;
  popunjeno: number;
  ha: number;
  stabala: number;
  km: number;
  konflikti: number;
  /** Broj dana u kojima se vrsta pojavljuje (ne broj unosa) */
  daniPoVrsti: Record<VrstaRada, number>;
}

export function rezime(dani: readonly DanSihtarice[]): SihtaricaRezime {
  const r: SihtaricaRezime = {
    radnihDana: 0, popunjeno: 0, ha: 0, stabala: 0, km: 0, konflikti: 0,
    daniPoVrsti: { DOZNAKA: 0, VLAKA: 0, TEREN: 0, KANCELARIJA: 0, GODISNJI: 0, BOLOVANJE: 0 },
  };
  for (const d of dani) {
    if (!d.neradni && !d.buduci) {
      r.radnihDana++;
      if (d.unosi.length) r.popunjeno++;
    }
    if (d.konflikt) r.konflikti++;
    for (const v of new Set(d.unosi.map((u) => u.vrsta))) r.daniPoVrsti[v]++;
    for (const u of d.unosi) {
      r.ha += Number(u.hektari) || 0;
      r.stabala += Number(u.brojStabala) || 0;
      r.km += Number(u.kilometri) || 0;
    }
  }
  return r;
}

export function datumiZaPopunu(
  dani: readonly DanSihtarice[],
  od: string,
  do_: string,
  opts: { preskociNeradne: boolean; samoPrazne: boolean; vrsta: VrstaRada },
): string[] {
  return dani
    .filter((d) => d.datum >= od && d.datum <= do_ && !d.buduci && !d.zakljucan)
    .filter((d) => !(opts.preskociNeradne && d.neradni))
    .filter((d) => !(opts.samoPrazne && d.unosi.length > 0))
    .filter((d) => !zabranaUpisa(d.datum, d.unosi, opts.vrsta))
    .map((d) => d.datum);
}

/** Najbliži raniji dan u mjesecu koji ima unose (za "Kao prethodni dan") */
export function prethodniPopunjen(dani: readonly DanSihtarice[], datum: string): DanSihtarice | null {
  for (let i = dani.length - 1; i >= 0; i--) {
    if (dani[i].datum < datum && dani[i].unosi.length) return dani[i];
  }
  return null;
}

export const fmtBroj = (n: number, dec = 2) => n.toLocaleString("bs-BA", { maximumFractionDigits: dec });

/** "1,5 ha · 120 st." / "0,8 km" / "" */
export function ucinakLabel(u: UnosRada): string {
  const parts: string[] = [];
  if (u.hektari) parts.push(`${fmtBroj(u.hektari)} ha`);
  if (u.brojStabala) parts.push(`${fmtBroj(u.brojStabala, 0)} st.`);
  if (u.kilometri) parts.push(`${fmtBroj(u.kilometri)} km`);
  return parts.join(" · ");
}
