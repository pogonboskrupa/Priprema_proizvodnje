"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useUnosiRefresh } from "@/hooks/useUnosiRefresh";
import {
  getIzvjestaj, getSedmicnaTabela, getDetaljanPregledPoOdjelima, getRezimeZaPeriod, getRezimePoOdjelima, getDateRange,
  type DnevnaAktivnost, type DetaljanOdjelRed, type MjesecniRezime, type OdjelMjesecRezime,
} from "@/lib/db";
import { vrsta as vrstaStyle } from "@/lib/vrste";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { exportXlsx } from "@/lib/export";
import { fmtDate, fmtDateShort, localDateStr } from "@/lib/format";
import { fmtBroj } from "@/lib/sihtarica";
import { godineEvidencije, mjeseciEvidencije, EVIDENCIJA_OD_DATUM } from "@/lib/godine";
import { prethodniRef, NAZIV_PRETHODNOG, type Period } from "@/lib/usporedba";
import { Delta } from "@/components/Delta";
import { Icon, type IconName } from "@/components/Icon";

const pak = (st: number) => (st / 30).toFixed(1);

type Tip = "odjel" | "inzinjer";

type OdjelRow = {
  odjel: { id: unknown; gj: string; broj: string; povrsina: number };
  ukupnoHektara: number;
  kumulativnoHektara: number;
  ukupnoStabala: number;
  ukupnoKm: number;
  preostalo: number;
  postotak: number;
  brojUnosa: number;
};

type InzinjerRow = {
  inzinjer: { id: unknown; ime: string; prezime: string; odjeli: string[] };
  ukupnoHektara: number;
  ukupnoStabala: number;
  ukupnoKm: number;
  danaGodisnji: number;
  danaKancelarija: number;
  danaBolovanje: number;
  danaTeren: number;
  danaRadnih?: number;
  brojUnosa: number;
};

type IzvjestajData = {
  period: Period;
  od: string;
  do_?: string;
  tip: Tip;
  data: OdjelRow[] | InzinjerRow[];
};

type TabelaData = {
  radnici: { id: string; name: string }[];
  entries: Record<string, Record<number, DnevnaAktivnost[]>>;
  od: string;
  do_: string;
};

/** Rezime prethodnog perioda; null kad je prethodni period prije početka evidencije */
type Usporedba = { rezime: MjesecniRezime; naziv: string } | null;

function weekRefDate(weekOffset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + weekOffset * 7);
  return d;
}

function sedmicaLabel(offset: number): string {
  if (offset === 0) return "Ova sedmica";
  if (offset === -1) return "Prošla sedmica";
  const n = -offset;
  const paucal = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
  return `Prije ${n} ${paucal ? "sedmice" : "sedmica"}`;
}

function mondayOf(d: Date): Date {
  const m = new Date(d);
  m.setDate(d.getDate() - ((d.getDay() || 7) - 1));
  return m;
}

function refDateFor(p: Period, monthVal: string, yearVal: number, weekOff: number): Date {
  if (p === "godisnje") return new Date(yearVal, 6, 1);
  if (p === "sedmicno") return weekRefDate(weekOff);
  const [y, m] = monthVal.split("-").map(Number);
  return new Date(y, m - 1, 15); // sredina mjeseca → getDateRange daje cijeli mjesec
}

const PERIODI: { id: Period; label: string }[] = [
  { id: "sedmicno", label: "Sedmično" },
  { id: "mjesecno", label: "Mjesečno" },
  { id: "godisnje", label: "Godišnje" },
];

const GRUPE: { id: Tip; label: string; icon: IconName }[] = [
  { id: "odjel", label: "Po odjelu", icon: "map" },
  { id: "inzinjer", label: "Po projektantu", icon: "users" },
];

const selectCls = "h-9 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm px-3 pr-8 focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer";

function segCls(aktivan: boolean) {
  return `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
    aktivan
      ? "bg-white dark:bg-gray-900 text-green-800 dark:text-green-300 shadow-sm"
      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
  }`;
}

export default function IzvjestajiPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const isWorker = session?.role === "worker";
  const [mainTab, setMainTab] = useState<"statistike" | "odjeli">("statistike");
  const [odjeliYear, setOdjeliYear] = useState(() => new Date().getFullYear());
  const [odjeliData, setOdjeliData] = useState<DetaljanOdjelRed[]>([]);
  const [odjeliLoading, setOdjeliLoading] = useState(false);
  const [odjeliErr, setOdjeliErr] = useState("");
  const odjeliGenRef = useRef(0);
  const [period, setPeriod] = useState<Period>("mjesecno");
  const [tip, setTip] = useState<Tip>("odjel");
  // u initializeru: izbjegava SSR/klijent razliku u vremenskoj zoni
  const [monthOptions] = useState(mjeseciEvidencije);
  const [selectedMonth, setSelectedMonth] = useState(() => mjeseciEvidencije()[0].value);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [weekOffset, setWeekOffset] = useState(0); // 0 = tekuća sedmica, -1 = prošla...
  const [err, setErr] = useState("");
  const [data, setData] = useState<IzvjestajData | null>(null);
  const [tabelaData, setTabelaData] = useState<TabelaData | null>(null);
  const [usporedba, setUsporedba] = useState<Usporedba>(null);
  const [mojiOdjeli, setMojiOdjeli] = useState<OdjelMjesecRezime[]>([]);
  const [loading, setLoading] = useState(false);
  const genRef = useRef(0);

  useEffect(() => {
    if (!authLoading && !session) router.replace("/login/");
  }, [session, authLoading, router]);

  useEffect(() => {
    if (!session) return;
    const initialTip: Tip = session.role === "worker" ? "inzinjer" : "odjel";
    if (session.role === "worker") setTip(initialTip);
    load(period, initialTip, selectedMonth, selectedYear, weekOffset);
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  useUnosiRefresh(() => { if (session) load(); });

  async function loadOdjeli(year = odjeliYear) {
    const gen = ++odjeliGenRef.current;
    setOdjeliLoading(true);
    setOdjeliErr("");
    try {
      const rows = await getDetaljanPregledPoOdjelima(year);
      if (gen === odjeliGenRef.current) setOdjeliData(rows);
    } catch {
      if (gen === odjeliGenRef.current) setOdjeliErr("Greška pri učitavanju — provjeri internet.");
    } finally {
      if (gen === odjeliGenRef.current) setOdjeliLoading(false);
    }
  }

  useEffect(() => {
    if (mainTab === "odjeli" && session) loadOdjeli();
  }, [mainTab, odjeliYear, session]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load(p: Period = period, t: Tip = tip, monthVal: string = selectedMonth, yearVal: number = selectedYear, weekOff: number = weekOffset) {
    const gen = ++genRef.current;
    setLoading(true);
    setErr("");
    const ref = refDateFor(p, monthVal, yearVal, weekOff);
    const opseg = getDateRange(p, ref);
    const prethodni = getDateRange(p, prethodniRef(p, ref));
    // operater vidi sve unose, a lični izvještaj mora biti samo njegov
    const ids = session?.role === "worker" ? [session.userId] : undefined;
    try {
      const [json, tabela, prev, moji] = await Promise.all([
        getIzvjestaj(p, t, ref),
        p === "sedmicno" && t === "inzinjer" ? getSedmicnaTabela(ref) : Promise.resolve(null),
        localDateStr(prethodni.do_) >= EVIDENCIJA_OD_DATUM
          ? getRezimeZaPeriod(prethodni.od, prethodni.do_, ids)
          : Promise.resolve(null),
        ids ? getRezimePoOdjelima(opseg.od, opseg.do_, ids) : Promise.resolve([]),
      ]);
      if (gen !== genRef.current) return;
      setData(json as IzvjestajData);
      setTabelaData(tabela as TabelaData | null);
      setUsporedba(prev ? { rezime: prev, naziv: NAZIV_PRETHODNOG[p] } : null);
      setMojiOdjeli(moji);
    } catch {
      if (gen === genRef.current) setErr("Greška pri učitavanju izvještaja — prikazani su prethodni podaci. Provjeri internet i pokušaj ponovo.");
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }

  if (authLoading || !session) return null;

  function handlePeriod(p: Period) {
    setPeriod(p);
    load(p, tip, selectedMonth);
  }

  function handleTip(t: Tip) {
    setTip(t);
    load(period, t, selectedMonth);
  }

  function handleMonth(val: string) {
    setSelectedMonth(val);
    load(period, tip, val);
  }

  function handleWeek(delta: number) {
    const next = Math.min(0, weekOffset + delta);
    setWeekOffset(next);
    load(period, tip, selectedMonth, selectedYear, next);
  }

  function handleYear(val: number) {
    setSelectedYear(val);
    load(period, tip, selectedMonth, val);
  }

  // ‹ se gasi na sedmici u kojoj počinje evidencija
  const naPrvojSedmici = localDateStr(mondayOf(weekRefDate(weekOffset))) <= EVIDENCIJA_OD_DATUM;
  const yearOptions = godineEvidencije();
  const danas = localDateStr();
  const uToku = !!data?.do_ && data.od <= danas && danas <= data.do_;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          {isWorker ? "Moji izvještaji" : "Izvještaji"}
        </h1>
        <button type="button" onClick={() => window.print()}
          className="print:hidden px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          Štampaj
        </button>
      </div>

      <div className="inline-flex gap-1 p-1 mb-6 rounded-lg bg-gray-100 dark:bg-gray-800 print:hidden" role="tablist">
        {([
          ["statistike", "chart", "Učinak"],
          ["odjeli", "map", "Pregled odjela"],
        ] as const).map(([id, icon, label]) => (
          <button key={id} role="tab" aria-selected={mainTab === id} onClick={() => setMainTab(id)} className={segCls(mainTab === id)}>
            <Icon name={icon} className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {mainTab === "odjeli" && (
        <DetaljOdjeli
          data={odjeliData}
          loading={odjeliLoading}
          err={odjeliErr}
          year={odjeliYear}
          yearOptions={yearOptions}
          onYear={(y) => setOdjeliYear(y)}
        />
      )}

      {mainTab === "statistike" && (
        <>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 mb-6 flex flex-wrap gap-4 items-end print:hidden">
            <div>
              <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">Period</span>
              <div className="inline-flex gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800">
                {PERIODI.map(({ id, label }) => (
                  <button key={id} onClick={() => handlePeriod(id)} aria-pressed={period === id} className={segCls(period === id)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {period === "sedmicno" && (
              <div>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">Sedmica</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleWeek(-1)}
                    disabled={naPrvojSedmici || loading}
                    aria-label="Prethodna sedmica"
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-40"
                  >‹</button>
                  <span className="text-sm text-gray-700 dark:text-gray-200 px-2 min-w-[92px] text-center">
                    {sedmicaLabel(weekOffset)}
                  </span>
                  <button
                    onClick={() => handleWeek(1)}
                    disabled={weekOffset === 0 || loading}
                    aria-label="Sljedeća sedmica"
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-40"
                  >›</button>
                </div>
              </div>
            )}

            {period === "mjesecno" && (
              <label>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">Mjesec</span>
                <select value={selectedMonth} onChange={(e) => handleMonth(e.target.value)} className={`${selectCls} capitalize`}>
                  {monthOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            )}

            {period === "godisnje" && (
              <label>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">Godina</span>
                <select value={selectedYear} onChange={(e) => handleYear(Number(e.target.value))} className={selectCls}>
                  {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
            )}

            {!isWorker && (
              <div>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">Grupiranje</span>
                <div className="inline-flex gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800">
                  {GRUPE.map(({ id, label, icon }) => (
                    <button key={id} onClick={() => handleTip(id)} aria-pressed={tip === id} className={segCls(tip === id)}>
                      <Icon name={icon} className="w-4 h-4" />{label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {data && (
              <div className="ml-auto text-right text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                <div>{fmtDate(data.od)} – {data.do_ ? fmtDate(data.do_) : ""}</div>
                {loading
                  ? <div className="text-green-700 dark:text-green-400">Osvježavam…</div>
                  : uToku && <div>period u toku</div>}
              </div>
            )}
            <button type="button" onClick={() => window.print()}
              className="self-end px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              Štampaj
            </button>
          </div>

          {err && (
            <div className="mb-4 rounded-lg px-4 py-2.5 text-sm border bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
              {err}
            </div>
          )}

          {loading && !data && <SkeletonIzvjestaj />}

          {data && (
            // stari podaci ostaju vidljivi dok stižu novi — nema treperenja praznog ekrana
            <div aria-busy={loading} className={`transition-opacity ${loading ? "opacity-50 pointer-events-none" : ""}`}>
              {data.tip === "odjel" && (
                <OdjelIzvjestaj rows={data.data as OdjelRow[]} period={data.period} usporedba={usporedba} />
              )}
              {data.tip === "inzinjer" && (isWorker ? (
                <MojIzvjestaj
                  row={(data.data as InzinjerRow[]).find((r) => r.inzinjer.id === session.userId)}
                  period={data.period}
                  usporedba={usporedba}
                  odjeli={mojiOdjeli}
                />
              ) : (
                <InzinjerIzvjestaj rows={data.data as InzinjerRow[]} period={data.period} usporedba={usporedba} />
              ))}
              {tabelaData && (
                <SedmicnaTabela data={tabelaData} filterRadnikId={isWorker ? session.userId : null} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SkeletonIzvjestaj() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-[92px] rounded-xl bg-gray-200/70 dark:bg-gray-800/70 animate-pulse" />)}
      </div>
      <div className="h-64 rounded-xl bg-gray-200/70 dark:bg-gray-800/70 animate-pulse" />
    </div>
  );
}

function Prazno({ tekst = "Nema aktivnosti u odabranom periodu" }: { tekst?: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center text-gray-500 dark:text-gray-400">
      <Icon name="chart" className="w-6 h-6 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
      <p className="font-medium">{tekst}</p>
    </div>
  );
}

function NapomenaUsporedbe({ usporedba }: { usporedba: Usporedba }) {
  if (!usporedba) return null;
  return <p className="-mt-2 text-[11px] text-gray-400 dark:text-gray-500">Strelice: razlika u odnosu na {usporedba.naziv}.</p>;
}

function stabalaLabel(st: number): ReactNode {
  if (st <= 0) return "0";
  return <>{fmtBroj(st, 0)} st <span className="text-sm font-medium opacity-70">· {pak(st)} pak.</span></>;
}

const thCls = "px-4 py-3 text-gray-600 dark:text-gray-300 font-medium";
const tfCls = "px-4 py-3 font-semibold text-gray-900 dark:text-gray-100 tabular-nums";

function TabelaKartica({ naslov, meta, onExport, children }: { naslov: string; meta?: string; onExport: () => void; children: ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-wrap gap-2 justify-between items-center">
        <h2 className="font-semibold text-gray-700 dark:text-gray-200">{naslov}</h2>
        <div className="flex items-center gap-3">
          {meta && <span className="text-xs text-gray-500 dark:text-gray-400">{meta}</span>}
          <button onClick={onExport} className="inline-flex items-center gap-1.5 bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-800">
            <Icon name="download" className="w-3.5 h-3.5" />Export XLSX
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

function OdjelIzvjestaj({ rows, period, usporedba }: { rows: OdjelRow[]; period: Period; usporedba: Usporedba }) {
  if (rows.length === 0) return <Prazno />;

  const ukupnoHa = rows.reduce((s, r) => s + r.ukupnoHektara, 0);
  const ukupnoSt = rows.reduce((s, r) => s + r.ukupnoStabala, 0);
  const ukupnoKm = rows.reduce((s, r) => s + r.ukupnoKm, 0);
  const ukupnoPovrsina = rows.reduce((s, r) => s + r.odjel.povrsina, 0);
  const ukupnoKum = rows.reduce((s, r) => s + r.kumulativnoHektara, 0);
  const ukupnoPreostalo = rows.reduce((s, r) => s + Math.max(r.preostalo, 0), 0);
  const ukupnoPct = ukupnoPovrsina > 0 ? Math.round((ukupnoKum / ukupnoPovrsina) * 100) : 0;
  const u = usporedba?.rezime;

  function handleExport() {
    const data = rows.map((r) => ({
      Odjel: r.odjel.broj,
      GJ: r.odjel.gj,
      "Površina (ha)": r.odjel.povrsina,
      "Obrađeno u periodu (ha)": r.ukupnoHektara,
      "Ukupno do kraja perioda (ha)": r.kumulativnoHektara,
      "Preostalo (ha)": r.preostalo,
      Stabala: r.ukupnoStabala,
      "Vlake (km)": r.ukupnoKm,
      "Napredak (%)": r.postotak,
    }));
    exportXlsx(data, `izvjestaj-odjeli-${period}`);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Obrađeno u periodu" value={`${fmtBroj(ukupnoHa)} ha`} color="green"
          sub={u && <Delta cur={ukupnoHa} prev={u.ha} />} />
        <StatCard label="Površina odjela" value={`${fmtBroj(ukupnoPovrsina)} ha`} color="blue"
          sub={`${rows.length} ${rows.length === 1 ? "odjel" : "odjela"} sa aktivnošću`} />
        <StatCard label="Doznačenih stabala" value={stabalaLabel(ukupnoSt)} color="emerald"
          sub={u && <Delta cur={ukupnoSt} prev={u.stabala} dec={0} />} />
        <StatCard label="Vlake projektovano" value={`${fmtBroj(ukupnoKm)} km`} color="amber"
          sub={u && <Delta cur={ukupnoKm} prev={u.km} />} />
      </div>
      <NapomenaUsporedbe usporedba={usporedba} />

      <TabelaKartica naslov="Pregled po odjelima" meta={`${rows.length} odjela`} onExport={handleExport}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 dark:border-gray-700">
              <tr className="text-left">
                <th className={thCls}>Odjel</th>
                <th className={`${thCls} text-right`}>Površina (ha)</th>
                <th className={`${thCls} text-right`}>U periodu (ha)</th>
                <th className={`${thCls} text-right`} title="Sva doznaka u odjelu do kraja odabranog perioda">Ukupno (ha)</th>
                <th className={`${thCls} text-right`}>Preostalo (ha)</th>
                <th className={`${thCls} text-right`}>Stabala</th>
                <th className={`${thCls} text-right`}>Vlake (km)</th>
                <th className={thCls}>Napredak</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.odjel.id)} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 tabular-nums">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-gray-500 dark:text-gray-400 text-xs">{r.odjel.gj} /</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100 ml-1">{r.odjel.broj}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{fmtBroj(r.odjel.povrsina)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700 dark:text-green-400">{r.ukupnoHektara > 0 ? fmtBroj(r.ukupnoHektara) : "–"}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-200">{fmtBroj(r.kumulativnoHektara)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${r.preostalo <= 0 ? "text-green-600 dark:text-green-400" : "text-gray-700 dark:text-gray-200"}`}>
                    {r.preostalo <= 0 ? "✓ Završeno" : fmtBroj(r.preostalo)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-800 dark:text-gray-200 whitespace-nowrap">
                    {r.ukupnoStabala > 0 ? (
                      <>{fmtBroj(r.ukupnoStabala, 0)}<span className="text-xs text-gray-400 dark:text-gray-500 ml-1">({pak(r.ukupnoStabala)} pak.)</span></>
                    ) : "–"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-800 dark:text-gray-200">{r.ukupnoKm > 0 ? fmtBroj(r.ukupnoKm) : "–"}</td>
                  <td className="px-4 py-3"><Napredak pct={r.postotak} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
              <tr>
                <td className={tfCls}>Ukupno</td>
                <td className={`${tfCls} text-right`}>{fmtBroj(ukupnoPovrsina)}</td>
                <td className={`${tfCls} text-right text-green-700 dark:text-green-400`}>{fmtBroj(ukupnoHa)}</td>
                <td className={`${tfCls} text-right`}>{fmtBroj(ukupnoKum)}</td>
                <td className={`${tfCls} text-right`}>{fmtBroj(ukupnoPreostalo)}</td>
                <td className={`${tfCls} text-right`}>{ukupnoSt > 0 ? fmtBroj(ukupnoSt, 0) : "–"}</td>
                <td className={`${tfCls} text-right`}>{ukupnoKm > 0 ? fmtBroj(ukupnoKm) : "–"}</td>
                <td className="px-4 py-3"><Napredak pct={ukupnoPct} /></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </TabelaKartica>
    </div>
  );
}

function Napredak({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 min-w-[80px]">
        <div
          className={`h-1.5 rounded-full ${pct >= 100 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-blue-500"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right tabular-nums">{pct}%</span>
    </div>
  );
}

function radniDani(r: InzinjerRow) {
  return r.danaRadnih ?? (r.danaTeren ?? 0) + (r.danaKancelarija ?? 0);
}

function InzinjerIzvjestaj({ rows, period, usporedba }: { rows: InzinjerRow[]; period: Period; usporedba: Usporedba }) {
  const aktivni = rows.filter((r) => r.brojUnosa > 0);
  if (aktivni.length === 0) return <Prazno />;

  const zbir = (f: (r: InzinjerRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  const ukupnoHa = zbir((r) => r.ukupnoHektara);
  const ukupnoSt = zbir((r) => r.ukupnoStabala);
  const ukupnoKm = zbir((r) => r.ukupnoKm);
  const ukupnoOdsustvo = zbir((r) => (r.danaGodisnji ?? 0) + (r.danaBolovanje ?? 0));
  const ukupnoRadniDani = zbir(radniDani);
  const u = usporedba?.rezime;

  function handleExport() {
    const data = rows.map((r) => ({
      Projektant: `${r.inzinjer.prezime} ${r.inzinjer.ime}`.trim(),
      Odjeli: r.inzinjer.odjeli.join(', '),
      "Hektara (ha)": r.ukupnoHektara,
      Stabala: r.ukupnoStabala,
      "Vlake (km)": r.ukupnoKm,
      "Radni dani": radniDani(r),
      Teren: r.danaTeren ?? 0,
      "God. odmor": r.danaGodisnji ?? 0,
      Kancelarija: r.danaKancelarija ?? 0,
      Bolovanje: r.danaBolovanje ?? 0,
      "Ukupno unosa": r.brojUnosa,
    }));
    exportXlsx(data, `izvjestaj-inzinjeri-${period}`);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Obrađeno" value={`${fmtBroj(ukupnoHa)} ha`} color="green"
          sub={u && <Delta cur={ukupnoHa} prev={u.ha} />} />
        <StatCard label="Doznačenih stabala" value={stabalaLabel(ukupnoSt)} color="emerald"
          sub={u && <Delta cur={ukupnoSt} prev={u.stabala} dec={0} />} />
        <StatCard label="Vlake projektovano" value={`${fmtBroj(ukupnoKm)} km`} color="amber"
          sub={u && <Delta cur={ukupnoKm} prev={u.km} />} />
        <StatCard label="Radni dani" value={String(ukupnoRadniDani)} color="orange"
          sub={u && <Delta cur={ukupnoRadniDani} prev={u.radniDani} dec={0} />} />
        <StatCard label="Dana odsustva" value={String(ukupnoOdsustvo)} color="blue" />
      </div>
      <NapomenaUsporedbe usporedba={usporedba} />

      <TabelaKartica naslov="Pregled po projektantima" meta={`${aktivni.length} od ${rows.length} sa aktivnošću`} onExport={handleExport}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 dark:border-gray-700">
              <tr className="text-left">
                <th className={thCls}>Projektant</th>
                <th className={thCls}>Odjeli</th>
                <th className={`${thCls} text-right`}>Hektara (ha)</th>
                <th className={`${thCls} text-right`}>Stabala</th>
                <th className={`${thCls} text-right`}>Vlake (km)</th>
                <th className={`${thCls} text-right`} title="Dani na poslu: teren, kancelarija, doznaka ili vlaka">Rad. dani</th>
                <th className={`${thCls} text-right`}>Teren</th>
                <th className={`${thCls} text-right`}>God.</th>
                <th className={`${thCls} text-right`}>Kanc.</th>
                <th className={`${thCls} text-right`}>Bol.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.inzinjer.id)}
                  className={`border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 tabular-nums ${r.brojUnosa === 0 ? "opacity-40" : ""}`}>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                    {r.inzinjer.prezime} {r.inzinjer.ime}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.inzinjer.odjeli.length > 0
                        ? r.inzinjer.odjeli.map((b) => (
                            <span key={b} className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs px-2 py-0.5 rounded-full whitespace-nowrap">{b}</span>
                          ))
                        : <span className="text-gray-400 text-xs">–</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700 dark:text-green-400">{r.ukupnoHektara > 0 ? fmtBroj(r.ukupnoHektara) : "–"}</td>
                  <td className="px-4 py-3 text-right text-gray-800 dark:text-gray-200 whitespace-nowrap">
                    {r.ukupnoStabala > 0 ? (
                      <>{fmtBroj(r.ukupnoStabala, 0)}<span className="text-xs text-gray-400 dark:text-gray-500 ml-1">({pak(r.ukupnoStabala)} pak.)</span></>
                    ) : "–"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-800 dark:text-gray-200">{r.ukupnoKm > 0 ? fmtBroj(r.ukupnoKm) : "–"}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800 dark:text-gray-100">{radniDani(r) || "–"}</td>
                  <td className="px-4 py-3 text-right text-orange-600 dark:text-orange-400">{r.danaTeren || "–"}</td>
                  <td className="px-4 py-3 text-right text-sky-600 dark:text-sky-400">{r.danaGodisnji || "–"}</td>
                  <td className="px-4 py-3 text-right text-violet-600 dark:text-violet-400">{r.danaKancelarija || "–"}</td>
                  <td className="px-4 py-3 text-right text-red-500 dark:text-red-400">{r.danaBolovanje || "–"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
              <tr>
                <td className={tfCls} colSpan={2}>Ukupno</td>
                <td className={`${tfCls} text-right text-green-700 dark:text-green-400`}>{fmtBroj(ukupnoHa)}</td>
                <td className={`${tfCls} text-right`}>{ukupnoSt > 0 ? fmtBroj(ukupnoSt, 0) : "–"}</td>
                <td className={`${tfCls} text-right`}>{ukupnoKm > 0 ? fmtBroj(ukupnoKm) : "–"}</td>
                <td className={`${tfCls} text-right`}>{ukupnoRadniDani}</td>
                <td className={`${tfCls} text-right`}>{zbir((r) => r.danaTeren ?? 0)}</td>
                <td className={`${tfCls} text-right`}>{zbir((r) => r.danaGodisnji ?? 0)}</td>
                <td className={`${tfCls} text-right`}>{zbir((r) => r.danaKancelarija ?? 0)}</td>
                <td className={`${tfCls} text-right`}>{zbir((r) => r.danaBolovanje ?? 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </TabelaKartica>
    </div>
  );
}

function MojIzvjestaj({ row, period, usporedba, odjeli }: {
  row?: InzinjerRow; period: Period; usporedba: Usporedba; odjeli: OdjelMjesecRezime[];
}) {
  if (!row || row.brojUnosa === 0) return <Prazno tekst="U odabranom periodu nemaš unosa" />;
  const u = usporedba?.rezime;
  const radni = radniDani(row);
  const dani: { vrsta: string; label: string; n: number }[] = [
    { vrsta: "TEREN", label: "Teren", n: row.danaTeren ?? 0 },
    { vrsta: "KANCELARIJA", label: "Kancelarija", n: row.danaKancelarija ?? 0 },
    { vrsta: "GODISNJI", label: "Godišnji", n: row.danaGodisnji ?? 0 },
    { vrsta: "BOLOVANJE", label: "Bolovanje", n: row.danaBolovanje ?? 0 },
  ];

  function handleExport() {
    exportXlsx(odjeli.map((o) => ({
      GJ: o.gj,
      Odjel: o.broj,
      "Dana rada": o.dani,
      "Hektara (ha)": o.ha,
      Stabala: o.stabala,
      "Vlake (km)": o.km,
    })), `moj-izvjestaj-${period}`);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Obrađeno" value={`${fmtBroj(row.ukupnoHektara)} ha`} color="green"
          sub={u && <Delta cur={row.ukupnoHektara} prev={u.ha} />} />
        <StatCard label="Doznačenih stabala" value={stabalaLabel(row.ukupnoStabala)} color="emerald"
          sub={u && <Delta cur={row.ukupnoStabala} prev={u.stabala} dec={0} />} />
        <StatCard label="Vlake" value={`${fmtBroj(row.ukupnoKm)} km`} color="amber"
          sub={u && <Delta cur={row.ukupnoKm} prev={u.km} />} />
        <StatCard label="Radni dani" value={String(radni)} color="orange"
          sub={u && <Delta cur={radni} prev={u.radniDani} dec={0} />} />
      </div>
      <NapomenaUsporedbe usporedba={usporedba} />

      <div className="flex flex-wrap gap-2" aria-label="Dani po vrsti">
        {dani.map((d) => (
          <span key={d.vrsta} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
            d.n > 0 ? vrstaStyle(d.vrsta).badge : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
          }`}>
            {d.label}<span className="font-bold tabular-nums">{d.n}</span>
          </span>
        ))}
      </div>

      <TabelaKartica naslov="Po odjelima" meta={odjeli.length ? `${odjeli.length} ${odjeli.length === 1 ? "odjel" : "odjela"}` : undefined} onExport={handleExport}>
        {odjeli.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-500 dark:text-gray-400">U ovom periodu nema rada vezanog za odjele.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {odjeli.map((o) => (
              <li key={o.odjelId} className="px-5 py-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 tabular-nums">
                <span className="min-w-[7rem]">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{o.gj} /</span>
                  <span className="ml-1 font-semibold text-gray-900 dark:text-gray-100">{o.broj}</span>
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{o.dani} {o.dani === 1 ? "dan" : "dana"}</span>
                <span className="ml-auto flex flex-wrap gap-x-4 text-sm">
                  {o.ha > 0 && <span className="font-semibold text-green-700 dark:text-green-400">{fmtBroj(o.ha)} ha</span>}
                  {o.stabala > 0 && <span className="text-gray-700 dark:text-gray-200">{fmtBroj(o.stabala, 0)} st</span>}
                  {o.km > 0 && <span className="text-amber-700 dark:text-amber-400">{fmtBroj(o.km)} km</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </TabelaKartica>
    </div>
  );
}

const DANI = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub"] as const;
const DANI_DOW = [1, 2, 3, 4, 5, 6] as const; // 1=Ponedjeljak … 6=Subota

function formatAktivnost(a: DnevnaAktivnost): string {
  const prefix = a.gjBroj ?? "";
  switch (a.vrsta) {
    case "DOZNAKA": {
      const parts: string[] = [];
      if (a.stabala > 0) parts.push(`${a.stabala}st`);
      if (a.ha > 0) parts.push(`${a.ha.toFixed(1)}ha`);
      return [prefix, parts.join("/")].filter(Boolean).join(" ");
    }
    case "VLAKA":
      return [prefix, a.km > 0 ? `${a.km.toFixed(1)}km` : ""].filter(Boolean).join(" ");
    case "TEREN":
      return prefix ? `Teren ${prefix}` : "Teren";
    case "GODISNJI":
      return "God. odmor";
    case "KANCELARIJA":
      return "Kancelarija";
    case "BOLOVANJE":
      return "Bolovanje";
    default:
      return prefix || a.vrsta;
  }
}


function SedmicnaTabela({
  data,
  filterRadnikId,
}: {
  data: TabelaData;
  filterRadnikId?: string | null;
}) {
  const radnici = filterRadnikId
    ? data.radnici.filter((r) => r.id === filterRadnikId)
    : data.radnici;
  // subota se prikazuje samo kad je neko radio tu subotu
  const imaSubotu = radnici.some((r) => (data.entries[r.id]?.[6]?.length ?? 0) > 0);
  const dani = DANI_DOW.map((dow, i) => ({ dow, naziv: DANI[i] })).filter((d) => d.dow !== 6 || imaSubotu);

  return (
    <div className="mt-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <h2 className="font-semibold text-gray-700 dark:text-gray-200">
          Dnevna aktivnost — {fmtDate(data.od)} – {fmtDate(data.do_)}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[600px]">
          <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-2.5 text-left text-gray-600 dark:text-gray-300 font-semibold w-40">
                Ime i prezime
              </th>
              {dani.map(({ dow, naziv }) => (
                <th key={dow} className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-300 font-semibold">
                  {naziv}
                  <span className="block text-[10px] font-normal text-gray-400 dark:text-gray-500">
                    {fmtDayInTable(data.od, dow)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {radnici.map((radnik) => {
              const dayMap = data.entries[radnik.id] ?? {};
              const hasAny = dani.some(({ dow }) => (dayMap[dow]?.length ?? 0) > 0);
              return (
                <tr
                  key={radnik.id}
                  className={`border-t border-gray-100 dark:border-gray-800 align-top ${
                    !hasAny ? "opacity-40" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  }`}
                >
                  <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-100 whitespace-nowrap">
                    {radnik.name}
                  </td>
                  {dani.map(({ dow }) => {
                    const aktivnosti = dayMap[dow] ?? [];
                    return (
                      <td key={dow} className="px-2 py-2 text-center">
                        {aktivnosti.length === 0 ? (
                          <span className="text-gray-300 dark:text-gray-600">–</span>
                        ) : (
                          <div className="flex flex-col gap-1 items-center">
                            {aktivnosti.map((a, i) => (
                              <span
                                key={i}
                                className={`inline-block rounded px-1.5 py-0.5 leading-snug text-[11px] font-medium ${vrstaStyle(a.vrsta).badge}`}
                              >
                                {formatAktivnost(a)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {radnici.length === 0 && (
              <tr>
                <td colSpan={dani.length + 1} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                  Nema podataka za ovu sedmicu
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmtDayInTable(mondayIso: string, dow: number): string {
  const [y, m, d] = mondayIso.split("-").map(Number);
  const date = new Date(y, m - 1, d + (dow - 1));
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}.`;
}

type Zbir = { odjela: number; povrsina: number; ha: number; stabala: number; km: number; dozDana: number; vlaDana: number };

function zbirOdjela(rows: DetaljanOdjelRed[]): Zbir {
  return rows.reduce<Zbir>((z, r) => ({
    odjela: z.odjela + 1,
    povrsina: z.povrsina + (r.povrsina ?? 0),
    ha: z.ha + r.totalHa,
    stabala: z.stabala + r.totalStabala,
    km: z.km + r.totalKm,
    dozDana: z.dozDana + r.doznakaRadnihDana,
    vlaDana: z.vlaDana + r.vlakaRadnihDana,
  }), { odjela: 0, povrsina: 0, ha: 0, stabala: 0, km: 0, dozDana: 0, vlaDana: 0 });
}

/** "01.09. – 24.09." (godina je već izabrana gore) */
function kratkiPeriod(od: string | null, do_: string | null): string {
  if (!od) return "–";
  if (!do_ || od === do_) return fmtDateShort(od);
  return `${fmtDateShort(od)} – ${fmtDateShort(do_)}`;
}

const brojIliCrta = (n: number, dec = 2) => (n > 0 ? fmtBroj(n, dec) : "–");

// Odjel kolona ostaje vidljiva dok se tabela skrola vodoravno (mobitel)
const stickyCls = "sticky left-0 z-10";
const dthCls = "px-3 py-2 font-medium text-right whitespace-nowrap";

function ZbirRed({ z, naslov, jaki }: { z: Zbir; naslov: string; jaki?: boolean }) {
  const bg = jaki ? "bg-green-50 dark:bg-green-950" : "bg-gray-50 dark:bg-gray-800/70";
  const txt = jaki ? "text-green-900 dark:text-green-100" : "text-gray-700 dark:text-gray-200";
  const td = `px-3 py-2.5 text-right font-semibold ${txt}`;
  return (
    <tr className={`${bg} ${jaki ? "border-t-2 border-green-300 dark:border-green-800" : "border-t border-gray-200 dark:border-gray-700"} tabular-nums`}>
      <td className={`${stickyCls} ${bg} px-4 py-2.5 font-semibold ${txt} whitespace-nowrap`}>{naslov}</td>
      <td className={td}>{brojIliCrta(z.povrsina)}</td>
      <td className={td} />
      <td className={td}>{z.dozDana || "–"}</td>
      <td className={`${td} ${jaki ? "" : "text-emerald-700 dark:text-emerald-400"}`}>{brojIliCrta(z.ha)}</td>
      <td className={td}>{brojIliCrta(z.stabala, 0)}</td>
      <td className={td} />
      <td className={td}>{z.vlaDana || "–"}</td>
      <td className={`${td} ${jaki ? "" : "text-amber-700 dark:text-amber-400"}`}>{brojIliCrta(z.km)}</td>
      <td className={td} />
      <td className={`${td} border-l border-gray-200 dark:border-gray-700`}>{z.dozDana + z.vlaDana || "–"}</td>
    </tr>
  );
}

function DetaljOdjeli({
  data,
  loading,
  err,
  year,
  yearOptions,
  onYear,
}: {
  data: DetaljanOdjelRed[];
  loading: boolean;
  err: string;
  year: number;
  yearOptions: number[];
  onYear: (y: number) => void;
}) {
  // redoslijed iz baze (cmpOdjel) ostaje unutar svake GJ
  const byGj = new Map<string, DetaljanOdjelRed[]>();
  for (const row of data) byGj.set(row.gj, [...(byGj.get(row.gj) ?? []), row]);
  const ukupno = zbirOdjela(data);

  function handleExport() {
    exportXlsx(data.map((r) => ({
      GJ: r.gj,
      Odjel: r.broj,
      "Površina (ha)": r.povrsina ?? "",
      "Doznaka od": r.doznakaOd ? fmtDate(r.doznakaOd) : "",
      "Doznaka do": r.doznakaDo ? fmtDate(r.doznakaDo) : "",
      "Doznaka dana": r.doznakaRadnihDana,
      "Doznaka (ha)": r.totalHa,
      Stabala: r.totalStabala,
      "Vlaka od": r.vlakaOd ? fmtDate(r.vlakaOd) : "",
      "Vlaka do": r.vlakaDo ? fmtDate(r.vlakaDo) : "",
      "Vlaka dana": r.vlakaRadnihDana,
      "Vlake (km)": r.totalKm,
      Projektanti: r.projektanti.map((p) => p.ime).join(", "),
      "Ukupno dana": r.doznakaRadnihDana + r.vlakaRadnihDana,
    })), `pregled-odjela-${year}`);
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 flex flex-wrap gap-4 items-end">
        <label>
          <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">Godina</span>
          <select value={year} onChange={(e) => onYear(Number(e.target.value))} className={selectCls}>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        {loading && data.length > 0 && (
          <span className="ml-auto text-xs text-green-700 dark:text-green-400 pb-1">Osvježavam…</span>
        )}
      </div>

      {err && (
        <div className="rounded-lg px-4 py-2.5 text-sm border bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          {err}
        </div>
      )}

      {loading && data.length === 0 && <SkeletonIzvjestaj />}

      {!loading && !err && data.length === 0 && <Prazno tekst={`Nema rada po odjelima u ${year}. godini`} />}

      {data.length > 0 && (
        <div aria-busy={loading} className={`space-y-4 transition-opacity ${loading ? "opacity-50 pointer-events-none" : ""}`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Odjela sa radom" value={String(ukupno.odjela)} color="blue"
              sub={`${byGj.size} ${byGj.size === 1 ? "gospodarska jedinica" : "gospodarskih jedinica"}`} />
            <StatCard label="Doznaka" value={`${fmtBroj(ukupno.ha)} ha`} color="green"
              sub={`${ukupno.dozDana} dana doznake`} />
            <StatCard label="Doznačenih stabala" value={stabalaLabel(ukupno.stabala)} color="emerald" />
            <StatCard label="Vlake" value={`${fmtBroj(ukupno.km)} km`} color="amber"
              sub={`${ukupno.vlaDana} dana vlake`} />
          </div>

          <TabelaKartica naslov={`Pregled odjela ${year}`} meta={`${ukupno.odjela} odjela`} onExport={handleExport}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[980px]">
                <thead className="text-xs text-gray-600 dark:text-gray-300">
                  <tr className="bg-gray-50 dark:bg-gray-800">
                    <th rowSpan={2} className={`${stickyCls} bg-gray-50 dark:bg-gray-800 px-4 py-2 font-medium text-left align-bottom`}>Odjel</th>
                    <th rowSpan={2} className={`${dthCls} align-bottom`}>Površina<br />(ha)</th>
                    <th colSpan={4} className="px-3 pt-2 pb-1 font-semibold text-center text-emerald-800 dark:text-emerald-300 border-b-2 border-emerald-300 dark:border-emerald-700">Doznaka</th>
                    <th colSpan={3} className="px-3 pt-2 pb-1 font-semibold text-center text-amber-800 dark:text-amber-300 border-b-2 border-amber-300 dark:border-amber-700">Vlaka</th>
                    <th rowSpan={2} className="px-3 py-2 font-medium text-left align-bottom">Projektanti</th>
                    <th rowSpan={2} className={`${dthCls} align-bottom border-l border-gray-200 dark:border-gray-700`} title="Dani doznake + dani vlake u odjelu">Ukupno<br />dana</th>
                  </tr>
                  <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-3 py-2 font-medium text-left">Period</th>
                    <th className={dthCls}>Dana</th>
                    <th className={dthCls}>ha</th>
                    <th className={dthCls}>Stabala</th>
                    <th className="px-3 py-2 font-medium text-left">Period</th>
                    <th className={dthCls}>Dana</th>
                    <th className={dthCls}>km</th>
                  </tr>
                </thead>
                {[...byGj.entries()].map(([gj, rows]) => (
                  <tbody key={gj}>
                    <tr className="bg-white dark:bg-gray-900">
                      <td colSpan={11} className="px-4 pt-4 pb-1.5">
                        <span className={`${stickyCls} inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-green-800 dark:text-green-300`}>
                          <Icon name="map" className="w-3.5 h-3.5" />{gj}
                        </span>
                      </td>
                    </tr>
                    {rows.map((r) => (
                      <tr key={r.odjelId} className="group border-t border-gray-100 dark:border-gray-800 align-top tabular-nums">
                        <td className={`${stickyCls} bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-800 px-4 py-2.5 font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap`}>
                          {r.broj}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-500 dark:text-gray-400 group-hover:bg-gray-50 dark:group-hover:bg-gray-800">{r.povrsina != null ? fmtBroj(r.povrsina) : "–"}</td>
                        <td className="px-3 py-2.5 text-gray-700 dark:text-gray-200 whitespace-nowrap group-hover:bg-gray-50 dark:group-hover:bg-gray-800">{kratkiPeriod(r.doznakaOd, r.doznakaDo)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-200 group-hover:bg-gray-50 dark:group-hover:bg-gray-800">{r.doznakaRadnihDana || "–"}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-emerald-700 dark:text-emerald-400 group-hover:bg-gray-50 dark:group-hover:bg-gray-800">{brojIliCrta(r.totalHa)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-800 dark:text-gray-200 whitespace-nowrap group-hover:bg-gray-50 dark:group-hover:bg-gray-800">
                          {r.totalStabala > 0 ? <>{fmtBroj(r.totalStabala, 0)}<span className="ml-1 text-xs text-gray-400 dark:text-gray-500">({pak(r.totalStabala)} pak.)</span></> : "–"}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700 dark:text-gray-200 whitespace-nowrap group-hover:bg-gray-50 dark:group-hover:bg-gray-800">{kratkiPeriod(r.vlakaOd, r.vlakaDo)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-200 group-hover:bg-gray-50 dark:group-hover:bg-gray-800">{r.vlakaRadnihDana || "–"}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-amber-700 dark:text-amber-400 group-hover:bg-gray-50 dark:group-hover:bg-gray-800">{brojIliCrta(r.totalKm)}</td>
                        <td className="px-3 py-2 group-hover:bg-gray-50 dark:group-hover:bg-gray-800">
                          <ul className="space-y-0.5">
                            {r.projektanti.map((p) => (
                              <li key={p.radnikId} className="text-xs whitespace-nowrap">
                                <span className="font-medium text-gray-800 dark:text-gray-100">{p.ime}</span>
                                <span className="text-gray-500 dark:text-gray-400">
                                  {[
                                    p.ha > 0 ? `${fmtBroj(p.ha)} ha` : null,
                                    p.km > 0 ? `${fmtBroj(p.km)} km` : null,
                                    `${p.dozDana + p.vlaDana} d`,
                                  ].filter(Boolean).map((t) => ` · ${t}`).join("")}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-gray-900 dark:text-gray-100 border-l border-gray-200 dark:border-gray-700 group-hover:bg-gray-50 dark:group-hover:bg-gray-800">
                          {r.doznakaRadnihDana + r.vlakaRadnihDana}
                        </td>
                      </tr>
                    ))}
                    {byGj.size > 1 && <ZbirRed z={zbirOdjela(rows)} naslov="Ukupno GJ" />}
                  </tbody>
                ))}
                <tfoot>
                  <ZbirRed z={ukupno} naslov="Ukupno" jaki />
                </tfoot>
              </table>
            </div>
          </TabelaKartica>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: ReactNode;
  color: "green" | "blue" | "emerald" | "amber" | "orange";
  sub?: ReactNode;
}) {
  const colors = {
    green:   { card: "bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-800",   label: "text-green-800 dark:text-green-200",   value: "text-green-900 dark:text-green-100" },
    blue:    { card: "bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-800",     label: "text-blue-800 dark:text-blue-200",    value: "text-blue-900 dark:text-blue-100" },
    emerald: { card: "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800", label: "text-emerald-800 dark:text-emerald-200", value: "text-emerald-900 dark:text-emerald-100" },
    amber:   { card: "bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800",   label: "text-amber-900 dark:text-amber-200",   value: "text-amber-950 dark:text-amber-100" },
    orange:  { card: "bg-orange-50 dark:bg-orange-950 border-orange-300 dark:border-orange-800", label: "text-orange-800 dark:text-orange-200",  value: "text-orange-900 dark:text-orange-100" },
  };
  const c = colors[color];
  return (
    <div className={`rounded-xl border p-4 ${c.card}`}>
      <div className={`text-xs font-semibold mb-1 ${c.label}`}>{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${c.value}`}>{value}</div>
      {sub && <div className={`mt-1 text-[11px] font-medium ${c.label}`}>{sub}</div>}
    </div>
  );
}
