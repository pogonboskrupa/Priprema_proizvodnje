import type { Korisnik, UnosRada, VrstaRada } from "@/lib/types";
import { localDateStr } from "@/lib/format";
import { praznik } from "@/lib/praznici";

export interface MjesecniRed {
  korisnik: Korisnik;
  go: number;
  clan76: number;
  placeno: number;
  /** Praznici na radne dane u koje radnik nema unos */
  praznici: number;
  bolovanje: number;
  teren: number;
  kancelarija: number;
  stabala: number;
  ha: number;
  km: number;
}

type TipDana = "go" | "clan76" | "placeno" | "bolovanje" | "teren" | "kancelarija";

const TERENSKE: ReadonlySet<VrstaRada> = new Set<VrstaRada>(["TEREN", "DOZNAKA", "VLAKA"]);

/** Jedan dan = jedna kategorija; odsustvo ima prednost nad radom ako su (greškom) oba upisana */
function tipDana(vrste: ReadonlySet<VrstaRada>): TipDana | null {
  if (vrste.has("BOLOVANJE")) return "bolovanje";
  if (vrste.has("GODISNJI")) return "go";
  if (vrste.has("CLAN76")) return "clan76";
  if (vrste.has("PLACENO")) return "placeno";
  if ([...vrste].some((v) => TERENSKE.has(v))) return "teren";
  if (vrste.has("KANCELARIJA")) return "kancelarija";
  return null;
}

/** Pon–Pet u mjesecu (uključujući praznike — oni idu u kolonu PRAZ.) */
export function radniDaniMjeseca(year: number, month: number): string[] {
  const n = new Date(year, month, 0).getDate();
  return Array.from({ length: n }, (_, i) => new Date(year, month - 1, i + 1))
    .filter((d) => d.getDay() !== 0 && d.getDay() !== 6)
    .map((d) => localDateStr(d));
}

export function mjesecniRedovi(korisnici: readonly Korisnik[], unosi: readonly UnosRada[], year: number, month: number): MjesecniRed[] {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const prazniciRadni = radniDaniMjeseca(year, month).filter((d) => praznik(d));

  const poRadniku = new Map<string, Map<string, UnosRada[]>>();
  for (const u of unosi) {
    const d = u.datum.slice(0, 10);
    if (!d.startsWith(prefix)) continue;
    const dani = poRadniku.get(u.inzinjerId) ?? new Map<string, UnosRada[]>();
    dani.set(d, [...(dani.get(d) ?? []), u]);
    poRadniku.set(u.inzinjerId, dani);
  }

  return korisnici.map((korisnik) => {
    const dani = poRadniku.get(korisnik.id) ?? new Map<string, UnosRada[]>();
    const red: MjesecniRed = {
      korisnik, go: 0, clan76: 0, placeno: 0, bolovanje: 0, teren: 0, kancelarija: 0,
      praznici: prazniciRadni.filter((d) => !dani.has(d)).length,
      stabala: 0, ha: 0, km: 0,
    };
    for (const lista of dani.values()) {
      const tip = tipDana(new Set(lista.map((u) => u.vrsta)));
      if (tip) red[tip]++;
      for (const u of lista) {
        if (u.vrsta === "DOZNAKA") {
          red.stabala += Number(u.brojStabala) || 0;
          red.ha += Number(u.hektari) || 0;
        } else if (u.vrsta === "VLAKA") {
          red.km += Number(u.kilometri) || 0;
        }
      }
    }
    return red;
  });
}
