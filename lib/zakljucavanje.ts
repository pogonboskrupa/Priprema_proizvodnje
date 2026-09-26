import { monthYearLabel } from "@/lib/format";

/** "YYYY-MM": taj mjesec i svi raniji su zaključani; null = ništa nije zaključano */
export type ZakljucanoDo = string | null;

export function jeZakljucan(datum: string, zakljucanoDo: ZakljucanoDo): boolean {
  return !!zakljucanoDo && datum.slice(0, 7) <= zakljucanoDo;
}

/** Prvi dan koji se smije mijenjati ("YYYY-MM-DD"), null kad ništa nije zaključano */
export function prviOtkljucaniDan(zakljucanoDo: ZakljucanoDo): string | null {
  if (!zakljucanoDo) return null;
  const [y, m] = zakljucanoDo.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

export function zakljucanoLabel(zakljucanoDo: string): string {
  const [y, m] = zakljucanoDo.split("-").map(Number);
  return monthYearLabel(y, m);
}

export class ZakljucanMjesecError extends Error {
  constructor(datum: string) {
    const mj = zakljucanoLabel(datum.slice(0, 7));
    super(`${mj[0].toUpperCase()}${mj.slice(1)} je zaključan — izmjene može napraviti samo admin.`);
    this.name = "ZakljucanMjesecError";
  }
}

/** Poruka greške za prikaz: zaključan mjesec ima svoju, ostalo generičku */
export function porukaGreske(e: unknown, genericka: string): string {
  return e instanceof ZakljucanMjesecError ? e.message : genericka;
}

// Admin zaobilazi zaključavanje; postavlja ga AuthProvider iz sesije
let adminSesija = false;
export function postaviAdminSesiju(admin: boolean) { adminSesija = admin; }
export function jeAdminSesija(): boolean { return adminSesija; }
