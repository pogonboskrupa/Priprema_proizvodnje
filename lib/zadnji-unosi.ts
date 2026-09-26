import type { UnosRada } from "@/lib/types";
import { localDateStr } from "@/lib/format";

export type DioUnosa = "prosli" | "izmjene" | "novi";

export const zadnjaAktivnost = (u: UnosRada): string => u.updatedAt ?? u.createdAt ?? "";

export const jeIzmijenjen = (u: UnosRada): boolean => !!u.updatedAt && !!u.createdAt && u.updatedAt !== u.createdAt;

/** Lokalni dan zadnje aktivnosti — ISO je UTC, pa bi slice(0, 10) izmjenu iza ponoći stavio u prethodni dan */
export function danAktivnosti(u: UnosRada): string {
  const iso = zadnjaAktivnost(u);
  return iso ? localDateStr(new Date(iso)) : "";
}

/** Unos koji je dirnut u kasnijem mjesecu od svog datuma rada mijenja već zaključen mjesec */
export function dioUnosa(u: UnosRada): DioUnosa {
  if (u.datum.slice(0, 7) < danAktivnosti(u).slice(0, 7)) return "prosli";
  return jeIzmijenjen(u) ? "izmjene" : "novi";
}

export type GrupaDana = readonly [dan: string, unosi: UnosRada[]];

/** Grupe po danu aktivnosti, najnovije gore; unutar dana najnovija aktivnost gore */
export function grupisiPoDanuAktivnosti(unosi: readonly UnosRada[]): GrupaDana[] {
  const grupe = new Map<string, UnosRada[]>();
  for (const u of unosi) {
    const d = danAktivnosti(u);
    grupe.set(d, [...(grupe.get(d) ?? []), u]);
  }
  return [...grupe.entries()]
    .map(([d, l]) => [d, [...l].sort((a, b) => zadnjaAktivnost(b).localeCompare(zadnjaAktivnost(a)))] as const)
    .sort(([a], [b]) => b.localeCompare(a));
}

export function podijeliUnose(unosi: readonly UnosRada[]): Record<DioUnosa, UnosRada[]> {
  const po: Record<DioUnosa, UnosRada[]> = { prosli: [], izmjene: [], novi: [] };
  for (const u of unosi) po[dioUnosa(u)].push(u);
  return po;
}
