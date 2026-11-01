import type { Korisnik, VrstaRada } from "@/lib/types";
import { ODSUSTVA } from "@/lib/vrste";
import { jeProjektant, sumarijaOd, type Sumarija } from "@/lib/sumarija";

/** Minimalan oblik unosa; datum je ISO string ("YYYY-MM-DD…") kakav vraća sloj podataka */
export interface UnosZaZbir {
  inzinjerId: string;
  datum: string;
  vrsta: string;
  brojStabala?: unknown;
  hektari?: unknown;
  kilometri?: unknown;
}

export interface Zbir {
  radniDani: number;
  teren: number;
  kancelarija: number;
  godisnji: number;
  bolovanje: number;
  stabala: number;
  ha: number;
  km: number;
}

export interface RedProjektanta { korisnik: Korisnik; zbir: Zbir }
export interface RedSumarije { sumarija: Sumarija; zbir: Zbir; projektanti: RedProjektanta[] }

export const prazanZbir = (): Zbir => ({ radniDani: 0, teren: 0, kancelarija: 0, godisnji: 0, bolovanje: 0, stabala: 0, ha: 0, km: 0 });

export function saberi(zbirovi: readonly Zbir[]): Zbir {
  const r = prazanZbir();
  for (const z of zbirovi) for (const k of Object.keys(r) as (keyof Zbir)[]) r[k] += z[k];
  return r;
}

/** Zbir jednog projektanta: dani se broje jednom po danu (dva unosa istog dana = jedan dan) */
function zbirProjektanta(unosi: readonly UnosZaZbir[]): Zbir {
  const z = prazanZbir();
  const dani = { radni: new Set<string>(), teren: new Set<string>(), kanc: new Set<string>(), go: new Set<string>(), bol: new Set<string>() };
  for (const u of unosi) {
    const dan = u.datum.slice(0, 10);
    z.ha += Number(u.hektari) || 0;
    z.stabala += Number(u.brojStabala) || 0;
    z.km += Number(u.kilometri) || 0;
    if (u.vrsta === "GODISNJI") dani.go.add(dan);
    else if (u.vrsta === "KANCELARIJA") dani.kanc.add(dan);
    else if (u.vrsta === "BOLOVANJE") dani.bol.add(dan);
    else if (u.vrsta === "TEREN" || u.vrsta === "DOZNAKA" || u.vrsta === "VLAKA") dani.teren.add(dan);
    if (!ODSUSTVA.has(u.vrsta as VrstaRada)) dani.radni.add(dan);
  }
  z.radniDani = dani.radni.size;
  z.teren = dani.teren.size;
  z.kancelarija = dani.kanc.size;
  z.godisnji = dani.go.size;
  z.bolovanje = dani.bol.size;
  return z;
}

/**
 * Po šumarijama, a unutar nje po projektantima (vodeći projektant prvi).
 * Arhivirani projektant ulazi samo ako u periodu ima unose; Šef sektora nije projektant i ne ulazi.
 */
export function agregirajPoSumarijama(
  unosi: readonly UnosZaZbir[],
  korisnici: readonly Korisnik[],
  sumarije: readonly Sumarija[],
): RedSumarije[] {
  const poKorisniku = new Map<string, UnosZaZbir[]>();
  for (const u of unosi) {
    const lista = poKorisniku.get(u.inzinjerId);
    if (lista) lista.push(u); else poKorisniku.set(u.inzinjerId, [u]);
  }
  const ime = (k: Korisnik) => k.fullName || k.ime;

  return sumarije.map((sumarija) => {
    const projektanti = korisnici
      .filter((k) => jeProjektant(k) && sumarijaOd(k) === sumarija.id && (!k.arhiviran || poKorisniku.has(k.id)))
      .sort((a, b) => (a.role === "admin" ? 0 : 1) - (b.role === "admin" ? 0 : 1) || ime(a).localeCompare(ime(b), "bs"))
      .map((korisnik) => ({ korisnik, zbir: zbirProjektanta(poKorisniku.get(korisnik.id) ?? []) }));
    return { sumarija, projektanti, zbir: saberi(projektanti.map((p) => p.zbir)) };
  });
}
