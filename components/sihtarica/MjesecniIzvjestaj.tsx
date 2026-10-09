"use client";
import { useMemo, useState } from "react";
import { monthName, monthYearLabel } from "@/lib/format";
import { fmtBroj } from "@/lib/sihtarica";
import { jePrviMjesecEvidencije } from "@/lib/godine";
import { useRadPoProjektantima } from "@/hooks/useRadPoProjektantima";
import { mjesecniRedovi, radniDaniMjeseca, type MjesecniRed } from "@/lib/mjesecni";
import { PapirList, PeriodTraka, tdPapir as td, type Orijentacija } from "@/components/sihtarica/PapirIzvjestaj";
import { useIzvjestajPostavke } from "@/hooks/useIzvjestajPostavke";
import { poredaj, imeUIzvjestaju, zvanjeUIzvjestaju, type IzvjestajPostavke } from "@/lib/izvjestaj-postavke";

interface Mjesec { year: number; month: number }

const tekuci = (): Mjesec => {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};

const pomjeri = (m: Mjesec, delta: number): Mjesec => {
  const d = new Date(m.year, m.month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};

const broj = (n: number, dec = 2) => (n ? fmtBroj(n, dec) : "");

// Širine u % — fiksni raspored tabele uvijek staje u širinu papira (uspravno i položeno)
const KOLONE: readonly { naziv: string; sirina: string; normal?: boolean }[] = [
  { naziv: "GO", sirina: "5%" },
  { naziv: "ČL.76", sirina: "6.2%" },
  { naziv: "plaćeno odsustvo", sirina: "8%", normal: true },
  { naziv: "PRAZ.", sirina: "6.2%" },
  { naziv: "BOLOV.", sirina: "7%" },
  { naziv: "TEREN", sirina: "6.5%" },
  { naziv: "KANC.", sirina: "6.5%" },
  { naziv: "BROJ STABALA", sirina: "8.5%" },
  { naziv: "POV ha", sirina: "6%" },
  { naziv: "VLAKA km", sirina: "7%" },
];

export function MjesecniIzvjestaj() {
  const [mj, setMj] = useState<Mjesec>(tekuci);
  const [orijentacija, setOrijentacija] = useState<Orijentacija>("landscape");
  const od = useMemo(() => new Date(mj.year, mj.month - 1, 1), [mj]);
  const do_ = useMemo(() => new Date(mj.year, mj.month, 0, 23, 59, 59, 999), [mj]);
  const { podaci, loading, err } = useRadPoProjektantima(od, do_);
  const { postavke } = useIzvjestajPostavke();

  const radniDani = radniDaniMjeseca(mj.year, mj.month).length;
  const redovi = useMemo(
    () => (podaci ? mjesecniRedovi(poredaj(podaci.korisnici, postavke.redoslijed), podaci.unosi, mj.year, mj.month) : []),
    [podaci, mj, postavke.redoslijed],
  );
  const t = tekuci();

  return (
    <div className="space-y-4">
      <PeriodTraka
        label={monthYearLabel(mj.year, mj.month)}
        onPrev={() => setMj((m) => pomjeri(m, -1))}
        onNext={() => setMj((m) => pomjeri(m, 1))}
        prevDisabled={jePrviMjesecEvidencije(mj.year, mj.month)}
        nextDisabled={mj.year === t.year && mj.month === t.month}
        loading={loading}
        err={err}
        orijentacija={orijentacija}
        onOrijentacija={setOrijentacija}
      />
      <PapirList
        postavke={postavke}
        orijentacija={orijentacija}
        prigusen={loading && !!podaci}
        naslov={<>MJESEČNI IZVJEŠTAJ O RADU ZA MJESEC – {monthName(mj.month).toUpperCase()}<br />{mj.year}. GODINE</>}
        prijeTabele={postavke.sekcija && <div className="mt-4 ml-24">{postavke.sekcija}</div>}
      >
        <MjesecnaTabela redovi={redovi} radniDani={radniDani} postavke={postavke} prazno={!loading && !!podaci && redovi.length === 0} />
      </PapirList>
    </div>
  );
}

export function MjesecnaTabela({ redovi, radniDani, postavke, prazno }: {
  redovi: readonly MjesecniRed[];
  radniDani: number;
  postavke: IzvjestajPostavke;
  prazno: boolean;
}) {
  return (
    <table className="papir-tabela mt-3 w-full border-collapse border-2 border-black text-[12px] print:text-[10.5px] leading-tight tabular-nums">
      <colgroup>
        <col style={{ width: "4%" }} />
        <col />
        <col style={{ width: "6.5%" }} />
        {KOLONE.map((k) => <col key={k.naziv} style={{ width: k.sirina }} />)}
      </colgroup>
      <thead className="print:text-[9px]">
        <tr>
          <th className={td}>RB</th>
          <th className={td}>IME I PREZIME</th>
          <th className={td}>RADNI DANI</th>
          {KOLONE.map((k) => <th key={k.naziv} className={`${td} ${k.normal ? "font-normal" : ""}`}>{k.naziv}</th>)}
        </tr>
      </thead>
      <tbody>
        {redovi.map((r, i) => (
          <tr key={r.korisnik.id} className="break-inside-avoid">
            <td className={td}>{i + 1}</td>
            <td className={`${td} text-left`}>
              <span className={postavke.imeBold ? "font-bold" : ""}>{imeUIzvjestaju(r.korisnik, postavke)}</span>
              {zvanjeUIzvjestaju(r.korisnik, postavke) && <div>{zvanjeUIzvjestaju(r.korisnik, postavke)}</div>}
            </td>
            <td className={td}>{radniDani}</td>
            <td className={td}>{broj(r.go)}</td>
            <td className={td}>{broj(r.clan76)}</td>
            <td className={td}>{broj(r.placeno)}</td>
            <td className={td}>{broj(r.praznici)}</td>
            <td className={td}>{broj(r.bolovanje)}</td>
            <td className={td}>{broj(r.teren)}</td>
            <td className={td}>{broj(r.kancelarija)}</td>
            <td className={td}>{broj(r.stabala, 0)}</td>
            <td className={td}>{broj(r.ha)}</td>
            <td className={td}>{broj(r.km)}</td>
          </tr>
        ))}
        {prazno && <tr><td colSpan={KOLONE.length + 3} className={`${td} py-6`}>Nema projektanata.</td></tr>}
      </tbody>
    </table>
  );
}
