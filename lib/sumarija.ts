// Šumarije: grupe korisnika i odjela. Opseg (aktivna šumarija) je module-level stanje,
// kao unosiScope u lib/firebase — lib/db.ts ga čita bez React konteksta.
export const DEFAULT_SUMARIJA_ID = "bosanska-krupa";
export const DEFAULT_SUMARIJA_NAZIV = "Bosanska Krupa";

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
