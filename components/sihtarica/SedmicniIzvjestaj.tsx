"use client";
import { useMemo, useState } from "react";
import { localDateStr } from "@/lib/format";
import { fmtBroj } from "@/lib/sihtarica";
import { EVIDENCIJA_OD_DATUM } from "@/lib/godine";
import { useRadPoProjektantima } from "@/hooks/useRadPoProjektantima";
import { useIzvjestajPostavke } from "@/hooks/useIzvjestajPostavke";
import { poredaj, imeUIzvjestaju, zvanjeUIzvjestaju, type IzvjestajPostavke } from "@/lib/izvjestaj-postavke";
import {
  segmentSedmice, sljedeciSegment, prethodniSegment, datumiSegmenta, nazivDana, sedmicniRedovi, rasponLabel, type SedmicniRed,
} from "@/lib/sedmicni";
import { PapirList, PeriodTraka, tdPapir as td, type Orijentacija } from "@/components/sihtarica/PapirIzvjestaj";

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
  const [seg, setSeg] = useState(() => segmentSedmice(new Date()));
  const [orijentacija, setOrijentacija] = useState<Orijentacija>("portrait");
  const kraj = useMemo(() => {
    const d = new Date(seg.do_);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [seg]);
  const { podaci, loading, err } = useRadPoProjektantima(seg.od, kraj);
  const { postavke } = useIzvjestajPostavke();

  const datumi = useMemo(() => datumiSegmenta(seg, podaci?.unosi ?? []), [seg, podaci]);
  const redovi = useMemo(
    () => (podaci ? sedmicniRedovi(poredaj(podaci.korisnici, postavke.redoslijed), podaci.unosi, datumi) : []),
    [podaci, datumi, postavke.redoslijed],
  );

  return (
    <div className="space-y-4">
      <PeriodTraka
        label={rasponLabel(datumi)}
        onPrev={() => setSeg(prethodniSegment)}
        onNext={() => setSeg(sljedeciSegment)}
        prevDisabled={localDateStr(seg.od) <= EVIDENCIJA_OD_DATUM}
        nextDisabled={localDateStr(sljedeciSegment(seg).od) > localDateStr()}
        orijentacija={orijentacija}
        onOrijentacija={setOrijentacija}
        loading={loading}
        err={err}
      />
      <PapirList
        postavke={postavke}
        orijentacija={orijentacija}
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
              {datumi.map((d) => <th key={d} className={`${td} font-normal`}>{nazivDana(d)}</th>)}
              <th className={`${td} font-bold`}>UKUPNO:</th>
            </tr>
          </thead>
          <tbody>
            {redovi.map((r, i) => <RadnikRedovi key={r.korisnik.id} rb={i + 1} red={r} postavke={postavke} />)}
            {!loading && podaci && redovi.length === 0 && (
              <tr><td colSpan={datumi.length + 5} className={`${td} py-6`}>Nema projektanata.</td></tr>
            )}
          </tbody>
        </table>
      </PapirList>
    </div>
  );
}

function RadnikRedovi({ rb, red, postavke }: { rb: number; red: SedmicniRed; postavke: IzvjestajPostavke }) {
  const { korisnik: k } = red;
  return (
    <>
      <tr className="break-inside-avoid">
        <td rowSpan={2} className={td}>{rb}.</td>
        <td rowSpan={2} className={`${td} text-[12px]`}>
          {imeUIzvjestaju(k, postavke)}
          {zvanjeUIzvjestaju(k, postavke) && <div>{zvanjeUIzvjestaju(k, postavke)}</div>}
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
