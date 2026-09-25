import type { UnosRada } from "@/lib/types";

export interface Faza {
  /** Prvi i zadnji dan rada "YYYY-MM-DD" */
  od: string;
  do_: string;
  /** Kalendarski dani od prvog do zadnjeg, uključivo */
  trajanje: number;
  /** Različiti dani u kojima se radilo */
  radnihDana: number;
}

export interface ProjektantUcinak {
  id: string;
  ime: string;
  doznaka: { dana: number; stabala: number; ha: number; faza: Faza | null };
  vlaka: { dana: number; km: number; faza: Faza | null };
}

export interface MjesecUcinak {
  mjesec: string; // "YYYY-MM"
  ha: number;
  stabala: number;
  km: number;
}

export interface OdjelStatistika {
  doznaka: {
    faza: Faza | null;
    stabala: number;
    ha: number;
    unosa: number;
    haPoDanu: number;
    stabalaPoDanu: number;
    /** Gustoća doznake */
    stabalaPoHa: number;
    /** Doznačeni ha / površina odjela, 0–1+ (null ako površina nije upisana) */
    pokrivenost: number | null;
  };
  vlaka: { faza: Faza | null; km: number; unosa: number; kmPoDanu: number };
  projektanti: ProjektantUcinak[];
  poMjesecima: MjesecUcinak[];
}

const dan = (u: UnosRada) => u.datum.slice(0, 10);

function dnevnaRazlika(od: string, do_: string): number {
  const [y1, m1, d1] = od.split("-").map(Number);
  const [y2, m2, d2] = do_.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

export function faza(unosi: readonly UnosRada[]): Faza | null {
  if (!unosi.length) return null;
  const dani = [...new Set(unosi.map(dan))].sort();
  const od = dani[0];
  const do_ = dani[dani.length - 1];
  return { od, do_, trajanje: dnevnaRazlika(od, do_) + 1, radnihDana: dani.length };
}

const podijeli = (a: number, b: number) => (b > 0 ? a / b : 0);

export function statistikaOdjela(unosi: readonly UnosRada[], povrsina: number): OdjelStatistika {
  const doz = unosi.filter((u) => u.vrsta === "DOZNAKA");
  const vl = unosi.filter((u) => u.vrsta === "VLAKA");
  const sum = (list: readonly UnosRada[], f: (u: UnosRada) => number | null | undefined) =>
    list.reduce((s, u) => s + (Number(f(u)) || 0), 0);

  const dozFaza = faza(doz);
  const vlFaza = faza(vl);
  const stabala = sum(doz, (u) => u.brojStabala);
  const ha = sum(doz, (u) => u.hektari);
  const km = sum(vl, (u) => u.kilometri);

  const poProjektantu = new Map<string, UnosRada[]>();
  for (const u of [...doz, ...vl]) {
    const list = poProjektantu.get(u.inzinjerId);
    if (list) list.push(u);
    else poProjektantu.set(u.inzinjerId, [u]);
  }
  const projektanti: ProjektantUcinak[] = [...poProjektantu.entries()].map(([id, list]) => {
    const d = list.filter((u) => u.vrsta === "DOZNAKA");
    const v = list.filter((u) => u.vrsta === "VLAKA");
    const k = list[0].korisnik;
    return {
      id,
      ime: k ? (k.fullName || k.ime) : "Nepoznat projektant",
      doznaka: { dana: new Set(d.map(dan)).size, stabala: sum(d, (u) => u.brojStabala), ha: sum(d, (u) => u.hektari), faza: faza(d) },
      vlaka: { dana: new Set(v.map(dan)).size, km: sum(v, (u) => u.kilometri), faza: faza(v) },
    };
  }).sort((a, b) => b.doznaka.ha - a.doznaka.ha || b.vlaka.km - a.vlaka.km || a.ime.localeCompare(b.ime));

  const mjeseci = new Map<string, MjesecUcinak>();
  for (const u of [...doz, ...vl]) {
    const m = u.datum.slice(0, 7);
    const acc = mjeseci.get(m) ?? { mjesec: m, ha: 0, stabala: 0, km: 0 };
    acc.ha += Number(u.hektari) || 0;
    acc.stabala += Number(u.brojStabala) || 0;
    acc.km += Number(u.kilometri) || 0;
    mjeseci.set(m, acc);
  }

  return {
    doznaka: {
      faza: dozFaza,
      stabala,
      ha,
      unosa: doz.length,
      haPoDanu: podijeli(ha, dozFaza?.radnihDana ?? 0),
      stabalaPoDanu: podijeli(stabala, dozFaza?.radnihDana ?? 0),
      stabalaPoHa: podijeli(stabala, ha),
      pokrivenost: povrsina > 0 ? ha / povrsina : null,
    },
    vlaka: { faza: vlFaza, km, unosa: vl.length, kmPoDanu: podijeli(km, vlFaza?.radnihDana ?? 0) },
    projektanti,
    poMjesecima: [...mjeseci.values()].sort((a, b) => a.mjesec.localeCompare(b.mjesec)),
  };
}

/** Godine u kojima u odjelu ima doznake/vlaka, najnovija prva */
export function godineRada(unosi: readonly UnosRada[]): number[] {
  return [...new Set(unosi.filter((u) => u.vrsta === "DOZNAKA" || u.vrsta === "VLAKA").map((u) => Number(u.datum.slice(0, 4))))]
    .sort((a, b) => b - a);
}
