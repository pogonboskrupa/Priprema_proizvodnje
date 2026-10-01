import type { Korisnik } from "./types";

export interface RadniDani {
  dozDana: number;
  vlDana: number;
}

export type UcinakAcc = {
  ha: number;
  stabala: number;
  km: number;
  doz: Set<string>;
  vl: Set<string>;
};

export const noviUcinakAcc = (): UcinakAcc => ({
  ha: 0,
  stabala: 0,
  km: 0,
  doz: new Set(),
  vl: new Set(),
});

export function dodajUcinak(acc: UcinakAcc, unos: Record<string, unknown>): void {
  const kljuc = `${unos.inzinjerId}|${String(unos.datum).slice(0, 10)}`;
  if (unos.vrsta === "DOZNAKA") {
    acc.ha += Number(unos.hektari) || 0;
    acc.stabala += Number(unos.brojStabala) || 0;
    acc.doz.add(kljuc);
  } else if (unos.vrsta === "VLAKA") {
    acc.km += Number(unos.kilometri) || 0;
    acc.vl.add(kljuc);
  }
}

export const zatvoriUcinak = ({ ha, stabala, km, doz, vl }: UcinakAcc) => ({
  ha,
  stabala,
  km,
  dozDana: doz.size,
  vlDana: vl.size,
});

export function jeRadnikZaIzvjestaj(korisnik: Korisnik, imaPodatke: boolean): boolean {
  return korisnik.role === "worker" && (!korisnik.arhiviran || imaPodatke);
}
