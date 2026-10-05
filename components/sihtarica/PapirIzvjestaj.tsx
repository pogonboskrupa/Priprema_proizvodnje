import type { ReactNode } from "react";

export const ZAGLAVLJE = {
  firma: ["ŠPD »UNSKO-SANSKE ŠUME« d.o.o.", "BOSANSKA KRUPA", "Sekcija pripreme proizvodnje", "Pogon gospodarenja za općinu Bosanska Krupa"],
  primalac: "N/r Hikmet Kurbegović, dipl.ing.šum.",
  sekcija: "Sekcija Bosanska Krupa",
} as const;

/** Ćelija tabele na papiru */
export const tdPapir = "border border-black px-1.5 py-1 align-middle text-center";

const btnNav = "w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-30 disabled:hover:bg-transparent text-lg";
const btnGhost = "px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors";

export function PeriodTraka({ label, onPrev, onNext, prevDisabled, nextDisabled, loading, err }: {
  label: string;
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
        <button type="button" className={`${btnGhost} ml-auto`} onClick={() => window.print()}>Štampaj</button>
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
export function PapirList({ orijentacija, naslov, prijeTabele, prigusen, minSirina, children }: {
  orijentacija: "portrait" | "landscape";
  naslov: ReactNode;
  prijeTabele?: ReactNode;
  prigusen: boolean;
  minSirina: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 print:border-0 print:overflow-visible">
      <style>{`@media print{@page{size:A4 ${orijentacija};margin:10mm}}`}</style>
      <article style={{ minWidth: minSirina }}
        className={`bg-white text-black px-8 py-10 print:!min-w-0 print:p-0 transition-opacity ${prigusen ? "opacity-50" : ""}`}>
        <header className="font-serif text-[15px] leading-snug">
          {ZAGLAVLJE.firma.map((l) => <div key={l}>{l}</div>)}
          <div className="mt-6 text-right">{ZAGLAVLJE.primalac}</div>
          <h2 className="mt-6 text-center text-base">{naslov}</h2>
          {prijeTabele}
        </header>
        {children}
        <footer className="mt-14 flex justify-end font-serif text-[15px]">
          <span>VODEĆI PROJEKTANT :</span>
          <span className="ml-6 inline-block w-40 border-b border-black" />
        </footer>
      </article>
    </div>
  );
}
