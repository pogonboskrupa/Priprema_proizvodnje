"use client";
import type { ReactNode } from "react";

export type SmjerSorta = "desc" | "asc";
export type SortStanje<K extends string> = { key: K; dir: SmjerSorta } | null;

/** Klik na zaglavlje: prvi smjer → suprotni → zadani redoslijed. Brojevi kreću od najvećeg, tekst od A. */
export function sljedeciSort<K extends string>(cur: SortStanje<K>, key: K, tekst = false): SortStanje<K> {
  const prvi: SmjerSorta = tekst ? "asc" : "desc";
  const drugi: SmjerSorta = tekst ? "desc" : "asc";
  if (!cur || cur.key !== key) return { key, dir: prvi };
  return cur.dir === prvi ? { key, dir: drugi } : null;
}

export function sortiraj<T, K extends string>(
  rows: readonly T[],
  stanje: SortStanje<K>,
  vrijednost: (red: T, key: K) => number | string,
): T[] {
  if (!stanje) return [...rows];
  const smjer = stanje.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = vrijednost(a, stanje.key);
    const y = vrijednost(b, stanje.key);
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "bs", { numeric: true });
    return c * smjer;
  });
}

function opis(tekst: boolean, smjer: SmjerSorta | null): string {
  if (!smjer) return tekst ? "Sortiraj od A do Ž" : "Sortiraj: najveće prvo";
  if (tekst) return smjer === "asc" ? "A–Ž — klikni za Ž–A" : "Ž–A — klikni za poništavanje sortiranja";
  return smjer === "desc" ? "Najveće prvo — klikni za najmanje prvo" : "Najmanje prvo — klikni za poništavanje sortiranja";
}

/** Zaglavlje kolone koje se klikom sortira; boja i poravnanje dolaze iz className */
export function SortTh<K extends string>({ label, col, stanje, onChange, tekst = false, className = "" }: {
  label: ReactNode;
  col: K;
  stanje: SortStanje<K>;
  onChange: (s: SortStanje<K>) => void;
  /** Tekstualna kolona: sortira A–Ž umjesto od najvećeg */
  tekst?: boolean;
  className?: string;
}) {
  const smjer = stanje?.key === col ? stanje.dir : null;
  return (
    <th
      aria-sort={smjer ? (smjer === "asc" ? "ascending" : "descending") : "none"}
      className={className}
    >
      <button
        type="button"
        onClick={() => onChange(sljedeciSort(stanje, col, tekst))}
        title={opis(tekst, smjer)}
        className="inline-flex items-center gap-1 select-none cursor-pointer hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 rounded"
      >
        {label}
        <span aria-hidden className={`text-[10px] leading-none print:hidden ${smjer ? "text-green-600 dark:text-green-400" : "opacity-30"}`}>
          {smjer === "desc" ? "▼" : smjer === "asc" ? "▲" : "↕"}
        </span>
      </button>
    </th>
  );
}
