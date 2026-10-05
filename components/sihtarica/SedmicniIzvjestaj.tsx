"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSedmicniIzvjestaj } from "@/lib/db";
import type { Korisnik, UnosRada } from "@/lib/types";
import { localDateStr } from "@/lib/format";
import { fmtBroj } from "@/lib/sihtarica";
import { EVIDENCIJA_OD_DATUM } from "@/lib/godine";
import { useUnosiRefresh } from "@/hooks/useUnosiRefresh";
import {
  ZAGLAVLJE, DANI_SEDMICE, ponedjeljak, pomjeriDane, sedmicniRedovi, datumiSedmice, rasponLabel, type SedmicniRed,
} from "@/lib/sedmicni";

const PRINT_CSS = "@media print{@page{size:A4 portrait;margin:10mm}}";

const btnNav = "w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-30 disabled:hover:bg-transparent text-lg";
const btnGhost = "px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors";

function Celija({ grupe }: { grupe: string[][] }) {
  if (!grupe.length) return null;
  return (
    <div className="space-y-1">
      {grupe.map((linije, i) => (
        <div key={i} className={i > 0 ? "pt-1 border-t border-dotted border-black/40" : ""}>
          {linije.map((l, j) => <div key={j}>{l}</div>)}
        </div>
      ))}
    </div>
  );
}

export function SedmicniIzvjestaj() {
  const [pon, setPon] = useState(() => ponedjeljak(new Date()));
  const [podaci, setPodaci] = useState<{ korisnici: Korisnik[]; unosi: UnosRada[] } | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [err, setErr] = useState("");
  const reqId = useRef(0);
  const ponKey = localDateStr(pon);
  const loading = loadedKey !== ponKey;

  const load = useCallback((): Promise<void> => {
    const id = ++reqId.current;
    const do_ = pomjeriDane(pon, 5);
    do_.setHours(23, 59, 59, 999);
    return getSedmicniIzvjestaj(pon, do_)
      .then((r) => {
        if (id !== reqId.current) return;
        setPodaci(r);
        setErr("");
      })
      .catch(() => { if (id === reqId.current) setErr("Greška pri učitavanju — provjeri internet i pokušaj ponovo."); })
      .finally(() => { if (id === reqId.current) setLoadedKey(localDateStr(pon)); });
  }, [pon]);

  useEffect(() => { load(); }, [load]);
  useUnosiRefresh(load);

  const datumi = useMemo(() => datumiSedmice(pon, podaci?.unosi ?? []), [pon, podaci]);
  const redovi = useMemo(
    () => (podaci ? sedmicniRedovi(podaci.korisnici, podaci.unosi, datumi) : []),
    [podaci, datumi],
  );

  const naPrvoj = localDateStr(pon) <= EVIDENCIJA_OD_DATUM;
  const naTekucoj = localDateStr(pon) >= localDateStr(ponedjeljak(new Date()));
  const td = "border border-black px-1.5 py-1 align-middle text-center";

  return (
    <div className="space-y-4">
      <style>{PRINT_CSS}</style>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="flex items-center gap-1">
          <button type="button" className={btnNav} disabled={naPrvoj || loading}
            onClick={() => setPon((p) => pomjeriDane(p, -7))} aria-label="Prethodna sedmica">‹</button>
          <span className="min-w-[10rem] text-center text-sm font-semibold text-gray-800 dark:text-gray-100 tabular-nums">
            {rasponLabel(datumi)}
          </span>
          <button type="button" className={btnNav} disabled={naTekucoj || loading}
            onClick={() => setPon((p) => pomjeriDane(p, 7))} aria-label="Sljedeća sedmica">›</button>
        </div>
        {loading && <span className="text-xs text-gray-400 animate-pulse">Učitavam…</span>}
        <button type="button" className={`${btnGhost} ml-auto`} onClick={() => window.print()}>Štampaj</button>
      </div>

      {err && (
        <div className="rounded-lg px-4 py-2.5 text-sm border bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 print:hidden">
          {err}
        </div>
      )}

      {/* List papira: uvijek crno na bijelom, i u tamnoj temi i pri štampi */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 print:border-0 print:overflow-visible">
        <article className={`min-w-[720px] bg-white text-black px-8 py-10 print:min-w-0 print:p-0 transition-opacity ${loading && podaci ? "opacity-50" : ""}`}>
          <header className="font-serif text-[15px] leading-snug">
            {ZAGLAVLJE.firma.map((l) => <div key={l}>{l}</div>)}
            <div className="mt-8 text-right">{ZAGLAVLJE.primalac}</div>
            <h2 className="mt-8 text-center text-base">
              SEDMIČNI IZVJEŠTAJ O RADU<br />
              {rasponLabel(datumi)} godine
            </h2>
          </header>

          <table className="mt-4 w-full border-collapse border-2 border-black text-[11px] leading-tight">
            <thead>
              <tr>
                <th className={`${td} w-8 font-normal`}>RB</th>
                <th className={`${td} font-normal`}>IME I<br />PREZIME</th>
                <th className={`${td} font-normal`}>ODJEL</th>
                <th className={`${td} font-normal`}>DANI</th>
                {datumi.map((_, i) => <th key={i} className={`${td} font-normal`}>{DANI_SEDMICE[i]}</th>)}
                <th className={`${td} font-bold`}>UKUPNO:</th>
              </tr>
            </thead>
            <tbody>
              {redovi.map((r, i) => (
                <RadnikRedovi key={r.korisnik.id} rb={i + 1} red={r} td={td} />
              ))}
              {!loading && podaci && redovi.length === 0 && (
                <tr><td colSpan={datumi.length + 5} className={`${td} py-6`}>Nema projektanata.</td></tr>
              )}
            </tbody>
          </table>

          <footer className="mt-14 flex justify-end font-serif text-[15px]">
            <span>VODEĆI PROJEKTANT :</span>
            <span className="ml-6 inline-block w-40 border-b border-black" />
          </footer>
        </article>
      </div>
    </div>
  );
}

function RadnikRedovi({ rb, red, td }: { rb: number; red: SedmicniRed; td: string }) {
  const { korisnik: k } = red;
  return (
    <>
      <tr className="break-inside-avoid">
        <td rowSpan={2} className={td}>{rb}.</td>
        <td rowSpan={2} className={`${td} text-[12px]`}>
          {k.fullName || k.ime}
          {k.title && <div>{k.title}</div>}
        </td>
        <td rowSpan={2} className={td}>{red.odjeli.map((o) => <div key={o}>{o}</div>)}</td>
        <td className={`${td} whitespace-nowrap`}>Broj stabala</td>
        {red.dani.map((g, i) => <td key={i} rowSpan={2} className={td}><Celija grupe={g} /></td>)}
        <td className={td}>{red.stabala ? `${fmtBroj(red.stabala, 0)}st` : ""}</td>
      </tr>
      <tr className="break-inside-avoid">
        <td className={`${td} whitespace-nowrap`}>Površina ha</td>
        <td className={td}>
          {red.ha ? `${fmtBroj(red.ha)}ha` : ""}
          {red.km > 0 && <div>{fmtBroj(red.km)}km</div>}
        </td>
      </tr>
    </>
  );
}
