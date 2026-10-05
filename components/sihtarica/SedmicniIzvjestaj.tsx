"use client";
import { useMemo, useState } from "react";
import { localDateStr } from "@/lib/format";
import { fmtBroj } from "@/lib/sihtarica";
import { EVIDENCIJA_OD_DATUM } from "@/lib/godine";
import { useRadPoProjektantima } from "@/hooks/useRadPoProjektantima";
import { DANI_SEDMICE, ponedjeljak, pomjeriDane, sedmicniRedovi, datumiSedmice, rasponLabel, type SedmicniRed } from "@/lib/sedmicni";
import { PapirList, PeriodTraka, tdPapir as td } from "@/components/sihtarica/PapirIzvjestaj";

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
  const subotaKraj = useMemo(() => {
    const d = pomjeriDane(pon, 5);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [pon]);
  const { podaci, loading, err } = useRadPoProjektantima(pon, subotaKraj);

  const datumi = useMemo(() => datumiSedmice(pon, podaci?.unosi ?? []), [pon, podaci]);
  const redovi = useMemo(
    () => (podaci ? sedmicniRedovi(podaci.korisnici, podaci.unosi, datumi) : []),
    [podaci, datumi],
  );

  return (
    <div className="space-y-4">
      <PeriodTraka
        label={rasponLabel(datumi)}
        onPrev={() => setPon((p) => pomjeriDane(p, -7))}
        onNext={() => setPon((p) => pomjeriDane(p, 7))}
        prevDisabled={localDateStr(pon) <= EVIDENCIJA_OD_DATUM}
        nextDisabled={localDateStr(pon) >= localDateStr(ponedjeljak(new Date()))}
        loading={loading}
        err={err}
      />
      <PapirList
        orijentacija="portrait"
        minSirina="720px"
        prigusen={loading && !!podaci}
        naslov={<>SEDMIČNI IZVJEŠTAJ O RADU<br />{rasponLabel(datumi)} godine</>}
      >
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
            {redovi.map((r, i) => <RadnikRedovi key={r.korisnik.id} rb={i + 1} red={r} />)}
            {!loading && podaci && redovi.length === 0 && (
              <tr><td colSpan={datumi.length + 5} className={`${td} py-6`}>Nema projektanata.</td></tr>
            )}
          </tbody>
        </table>
      </PapirList>
    </div>
  );
}

function RadnikRedovi({ rb, red }: { rb: number; red: SedmicniRed }) {
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
