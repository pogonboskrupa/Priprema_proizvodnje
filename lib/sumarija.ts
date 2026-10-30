// Šumarije: grupe korisnika i odjela. Opseg (aktivna šumarija) je module-level stanje,
// kao unosiScope u lib/firebase — lib/db.ts ga čita bez React konteksta.
export const DEFAULT_SUMARIJA_ID = "bosanska-krupa";
export const DEFAULT_SUMARIJA_NAZIV = "Pogon gospodarenja Bosanska Krupa";

export interface Sumarija {
  id: string;
  naziv: string;
  arhivirana?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

type SaSumarijom = { sumarijaId?: unknown };

/** Korisnici i odjeli bez polja pripadaju zadanoj šumariji — baza se ne mijenja */
export const sumarijaOd = (e: SaSumarijom): string =>
  (typeof e.sumarijaId === "string" && e.sumarijaId) || DEFAULT_SUMARIJA_ID;

/** Admin bez šumarije vidi sve šumarije */
export const jeSuperAdmin = (k: { role?: unknown; sumarijaId?: unknown } | null | undefined): boolean =>
  k?.role === "admin" && !k.sumarijaId;

let aktivna: string | null = null;

/** null = sve šumarije (samo super admin) */
export function postaviOpseg(id: string | null) { aktivna = id; }
export function aktivniOpseg(): string | null { return aktivna; }

export function uOpsegu<T extends SaSumarijom>(lista: readonly T[]): T[] {
  return aktivna === null ? [...lista] : lista.filter((e) => sumarijaOd(e) === aktivna);
}

/** Zadana šumarija koristi izvorni dokument, ostale `{base}__{id}` */
export function postavkeDocId(base: string, id: string | null = aktivna): string {
  return !id || id === DEFAULT_SUMARIJA_ID ? base : `${base}__${id}`;
}

const IZBOR_KEY = "ppnext_sum";

export function procitajIzbor(): string | null {
  try { return localStorage.getItem(IZBOR_KEY) || null; } catch { return null; }
}

export function spremiIzbor(id: string | null) {
  try {
    if (id) localStorage.setItem(IZBOR_KEY, id);
    else localStorage.removeItem(IZBOR_KEY);
  } catch {}
}

/** Super admin: njegov izbor (null = sve); ostali: vlastita šumarija */
export function opsegZaSesiju(ses: { role?: unknown; sumarijaId?: unknown }): string | null {
  return jeSuperAdmin(ses) ? procitajIzbor() : sumarijaOd(ses);
}

/** "Pogon gospodarenja Bosanska Krupa" → "PG Bosanska Krupa"; ostali nazivi ostaju isti */
export const kratkiNaziv = (naziv: string): string => naziv.replace(/^Pogon gospodarenja\s+/i, "PG ");

/** Naziv uloge u aplikaciji: Šef sektora (vidi sve) / Vodeći projektant {šumarija} / Projektant */
export function ulogaLabel(
  k: { role?: unknown; operater?: boolean; sumarijaId?: unknown },
  sumarije: readonly Sumarija[],
  /** Gusti redovi (tabele, značke): "PG Bosanska Krupa" umjesto punog naziva */
  kratko = false,
): string {
  if (jeSuperAdmin(k)) return "Šef sektora";
  if (k.role === "admin") {
    const puni = sumarije.find((s) => s.id === sumarijaOd(k))?.naziv;
    const naziv = puni && (kratko ? kratkiNaziv(puni) : puni);
    return naziv ? `Vodeći projektant ${naziv}` : "Vodeći projektant";
  }
  return k.operater ? "Projektant · operater" : "Projektant";
}

export interface GrupaKorisnika<T> {
  sumarija: Sumarija;
  /** Admini šumarije (vodeći projektanti) */
  vodeci: T[];
  radnici: T[];
}

/** Razdvaja korisnike po šumarijama, redoslijedom u kojem su šumarije proslijeđene */
export function grupisiPoSumarijama<T extends { role?: unknown; sumarijaId?: unknown }>(
  korisnici: readonly T[],
  sumarije: readonly Sumarija[],
): GrupaKorisnika<T>[] {
  return sumarije.map((sumarija) => {
    const clanovi = korisnici.filter((k) => sumarijaOd(k) === sumarija.id);
    return {
      sumarija,
      vodeci: clanovi.filter((k) => k.role === "admin"),
      radnici: clanovi.filter((k) => k.role !== "admin"),
    };
  });
}

/** Samo vodeći projektant zadane šumarije (PG Bosanska Krupa) vidi kad su se korisnici zadnji put prijavili; prima onoga ko gleda */
export const vidiZadnjuPrijavu = (k: { role?: unknown; sumarijaId?: unknown } | null | undefined): boolean =>
  k?.role === "admin" && k.sumarijaId === DEFAULT_SUMARIJA_ID;

/** Evidenciju rada vode projektanti i vodeći projektanti šumarija (admin s šumarijom); Šef sektora ne */
export const jeProjektant = (k: { role?: unknown; sumarijaId?: unknown } | null | undefined): boolean =>
  k?.role === "worker" || (k?.role === "admin" && !!k.sumarijaId);
