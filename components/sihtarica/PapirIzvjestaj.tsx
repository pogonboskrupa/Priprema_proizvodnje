import type { ReactNode } from "react";
import type { IzvjestajPostavke } from "@/lib/izvjestaj-postavke";

export type Orijentacija = "portrait" | "landscape";

// A4 na ekranu (96 dpi): 210 mm ≈ 794 px, 297 mm ≈ 1123 px
const SIRINA: Record<Orijentacija, string> = { portrait: "794px", landscape: "1123px" };

/** Ćelija tabele na papiru */
export const tdPapir = "border border-black px-1.5 py-1 align-middle text-center";

const btnNav = "w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-30 disabled:hover:bg-transparent text-lg";
const btnGhost = "px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors";

export function PeriodTraka({ label, onPrev, onNext, prevDisabled, nextDisabled, loading, err, orijentacija, onOrijentacija }: {
  label: string;
  orijentacija: Orijentacija;
  onOrijentacija: (o: Orijentacija) => void;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
  loading: boolean;
  err: string;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="flex items-center gap-1">
          <button type="button" className={btnNav} disabled={prevDisabled || loading} onClick={onPrev} aria-label="Prethodni period">‹</button>
          <span className="min-w-[10rem] text-center text-sm font-semibold capitalize text-gray-800 dark:text-gray-100 tabular-nums">{label}</span>
          <button type="button" className={btnNav} disabled={nextDisabled || loading} onClick={onNext} aria-label="Sljedeći period">›</button>
        </div>
        {loading && <span className="text-xs text-gray-400 animate-pulse">Učitavam…</span>}
        <div className="ml-auto inline-flex gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800" role="group" aria-label="Orijentacija stranice">
          {([["portrait", "Uspravno"], ["landscape", "Položeno"]] as const).map(([o, l]) => (
            <button key={o} type="button" aria-pressed={orijentacija === o} onClick={() => onOrijentacija(o)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                orijentacija === o
                  ? "bg-white dark:bg-gray-900 text-green-800 dark:text-green-300 shadow-sm"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
              }`}>
              {l}
            </button>
          ))}
        </div>
        <button type="button" className={btnGhost} onClick={() => window.print()}>Štampaj</button>
      </div>
      {err && (
        <div className="rounded-lg px-4 py-2.5 text-sm border bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 print:hidden">
          {err}
        </div>
      )}
    </>
  );
}

/** List papira: uvijek crno na bijelom, i u tamnoj temi i pri štampi */
export function PapirList({ postavke, orijentacija, naslov, prijeTabele, prigusen, children }: {
  postavke: IzvjestajPostavke;
  orijentacija: Orijentacija;
  naslov: ReactNode;
  prijeTabele?: ReactNode;
  prigusen: boolean;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/60 p-3 sm:p-6 print:border-0 print:bg-transparent print:p-0 print:overflow-visible">
      <style>{`@media print{@page{size:A4 ${orijentacija};margin:0}}.papir-tabela{table-layout:fixed}.papir-tabela td,.papir-tabela th{overflow-wrap:break-word}`}</style>
      <article style={{ width: SIRINA[orijentacija] }}
        className={`mx-auto shadow-md print:shadow-none bg-white text-black px-8 py-10 print:!w-auto print:p-0 transition-opacity ${prigusen ? "opacity-50" : ""}`}>
        <header className="font-serif text-[15px] print:text-[13px] leading-snug">
          {postavke.firma.map((l, i) => <div key={i}>{l}</div>)}
          {postavke.primalac && <div className="mt-6 print:mt-3 text-right">{postavke.primalac}</div>}
          <h2 className="mt-6 print:mt-3 text-center text-base">{naslov}</h2>
          {prijeTabele}
        </header>
        {children}
        <footer className="mt-14 print:mt-8 flex justify-end font-serif text-[15px] break-inside-avoid">
          <span>{postavke.potpis}</span>
          <span className="ml-6 inline-block w-40 border-b border-black" />
        </footer>
      </article>
    </div>
  );
}
