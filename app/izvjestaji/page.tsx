"use client";
import { useEffect, useRef, useState } from "react";
import { useUnosiRefresh } from "@/hooks/useUnosiRefresh";
import { getIzvjestaj, getSedmicnaTabela, getDetaljanPregledPoOdjelima, type DnevnaAktivnost, type DetaljanOdjelRed } from "@/lib/db";
import { vrsta as vrstaStyle } from "@/lib/vrste";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { exportXlsx } from "@/lib/export";
import { fmtDate } from "@/lib/format";
import { godineEvidencije, mjeseciEvidencije, EVIDENCIJA_OD_DATUM } from "@/lib/godine";
import { localDateStr } from "@/lib/format";

type Period = "sedmicno" | "mjesecno" | "godisnje";
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
  // Computed inside state initializer to avoid SSR/client timezone mismatch
  const [monthOptions] = useState(mjeseciEvidencije);
  const [selectedMonth, setSelectedMonth] = useState(() => mjeseciEvidencije()[0].value);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [weekOffset, setWeekOffset] = useState(0); // 0 = tekuća sedmica, -1 = prošla...
  const [err, setErr] = useState("");
  const [data, setData] = useState<IzvjestajData | null>(null);
  const [tabelaData, setTabelaData] = useState<TabelaData | null>(null);
  const [loading, setLoading] = useState(false);
  const genRef = useRef(0);

  useEffect(() => {
    if (!authLoading && !session) router.replace("/login/");
  }, [session, authLoading]);

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

  function refDateFor(p: Period, monthVal: string, yearVal: number, weekOff: number): Date | undefined {
    if (p === "godisnje") return new Date(yearVal, 6, 1);
    if (p === "sedmicno") return weekRefDate(weekOff);
    if (p !== "mjesecno") return undefined;
    const [y, m] = monthVal.split("-").map(Number);
    return new Date(y, m - 1, 15); // mid-month → getDateRange calculates correct range
  }

  async function load(p: Period = period, t: Tip = tip, monthVal: string = selectedMonth, yearVal: number = selectedYear, weekOff: number = weekOffset) {
    const gen = ++genRef.current;
    setLoading(true);
    setErr("");
    try {
      const fetches: [Promise<unknown>, Promise<TabelaData | null>] = [
        getIzvjestaj(p, t, refDateFor(p, monthVal, yearVal, weekOff)),
        p === "sedmicno" && t === "inzinjer" ? getSedmicnaTabela(weekRefDate(weekOff)) : Promise.resolve(null),
      ];
      const [json, tabela] = await Promise.all(fetches);
      if (gen !== genRef.current) return;
      setData(json as IzvjestajData);
      setTabelaData(tabela as TabelaData | null);
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

  // ‹ se gasi na sedmici u kojoj počinje evidencija
  const naPrvojSedmici = localDateStr(mondayOf(weekRefDate(weekOffset))) <= EVIDENCIJA_OD_DATUM;

  function handleYear(val: number) {
    setSelectedYear(val);
    load(period, tip, selectedMonth, val);
  }

  const yearOptions = godineEvidencije();

  const formatDate = (d: string) => fmtDate(d);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Izvještaji</h1>

      {/* Glavni tabovi */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {([
          ["statistike", "📊", "Statistike", "Pregled aktivnosti po periodima"],
          ["odjeli",     "🗺️", "Detaljan pregled po odjelima", "Svi odjeli razvrstani po GJ"],
        ] as const).map(([id, icon, label, sub]) => (
          <button
            key={id}
            onClick={() => setMainTab(id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
              mainTab === id
                ? "bg-green-700 border-green-700 text-white shadow-md"
                : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-green-400 dark:hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-950/40"
            }`}
          >
            <span className="text-xl leading-none">{icon}</span>
            <span>
              <span className="block text-sm font-semibold leading-tight">{label}</span>
              <span className={`block text-xs mt-0.5 ${mainTab === id ? "text-green-100" : "text-gray-400 dark:text-gray-500"}`}>{sub}</span>
            </span>
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

      {mainTab === "statistike" && (<><div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 mb-6 flex flex-wrap gap-4 items-end">
        {/* Period */}
        <div>
          <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">Period</span>
          <div className="flex gap-1.5">
            {(["sedmicno", "mjesecno", "godisnje"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  period === p
                    ? "bg-green-700 text-white shadow-sm"
                    : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
                }`}
              >
                {p === "sedmicno" ? "Sedmično" : p === "mjesecno" ? "Mjesečno" : "Godišnje"}
              </button>
            ))}
          </div>
        </div>

        {/* Month picker — only for "miesecno" */}
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
          <div>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">Mjesec</span>
            <select
              value={selectedMonth}
              onChange={(e) => handleMonth(e.target.value)}
              className="h-9 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm px-3 pr-8 focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
            >
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        {period === "godisnje" && (
          <div>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">Godina</span>
            <select
              value={selectedYear}
              onChange={(e) => handleYear(Number(e.target.value))}
              className="h-9 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm px-3 pr-8 focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}

        {/* Grouping — admin only */}
        {!isWorker && (
          <div>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">Grupiranje</span>
            <div className="flex gap-1.5">
              {(["odjel", "inzinjer"] as Tip[]).map((t) => (
                <button
                  key={t}
                  onClick={() => handleTip(t)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tip === t
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
                  }`}
                >
                  {t === "odjel" ? "🗺️ Po odjelu" : "👷 Po projektantu"}
                </button>
              ))}
            </div>
          </div>
        )}

        {data && (
          <div className="ml-auto">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatDate(data.od)} – {data.do_ ? formatDate(data.do_) : ""}
            </span>
          </div>
        )}
      </div>

      {err && (
        <div className="mb-4 rounded-lg px-4 py-2.5 text-sm border bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          {err}
        </div>
      )}

      {loading && <div className="text-center py-16 text-gray-500 dark:text-gray-400">Učitavam...</div>}

      {!loading && data?.tip === "odjel" && (
        <OdjelIzvjestaj rows={data.data as OdjelRow[]} period={data.period} />
      )}

      {!loading && data?.tip === "inzinjer" && (
        <InzinjerIzvjestaj
          rows={data.data as InzinjerRow[]}
          period={data.period}
          filterInzinjerId={isWorker ? session.userId : null}
        />
      )}

      {!loading && tabelaData && (
        <SedmicnaTabela
          data={tabelaData}
          filterRadnikId={isWorker ? session.userId : null}
        />
      )}
    </>)}
    </div>
  );
}

function OdjelIzvjestaj({ rows, period }: { rows: OdjelRow[]; period: Period }) {
  if (rows.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-10 text-center text-gray-400 dark:text-gray-500">
        <p className="text-2xl mb-2">📭</p>
        <p className="font-medium">Nema aktivnosti u odabranom periodu</p>
      </div>
    );
  }

  const ukupnoHa = rows.reduce((s, r) => s + r.ukupnoHektara, 0);
  const ukupnoSt = rows.reduce((s, r) => s + r.ukupnoStabala, 0);
  const ukupnoKm = rows.reduce((s, r) => s + r.ukupnoKm, 0);
  const ukupnoPovrsina = rows.reduce((s, r) => s + r.odjel.povrsina, 0);

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
        <StatCard label="Ukupno obrađeno" value={`${ukupnoHa.toFixed(2)} ha`} color="green" />
        <StatCard label="Ukupna površina" value={`${ukupnoPovrsina.toFixed(2)} ha`} color="blue" />
        <StatCard label="Doznačenih stabala" value={ukupnoSt.toString()} color="emerald" />
        <StatCard label="Vlake projektovano" value={`${ukupnoKm.toFixed(2)} km`} color="amber" />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-between items-center">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200">Pregled po odjelima</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400">{rows.length} odjela sa aktivnošću</span>
            <button onClick={handleExport} className="bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-800">
              Export XLSX
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 dark:border-gray-700">
              <tr className="text-left">
                <th className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Odjel</th>
                <th className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium text-right">Površina (ha)</th>
                <th className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium text-right">U periodu (ha)</th>
                <th className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium text-right" title="Sva doznaka u odjelu do kraja odabranog perioda">Ukupno (ha)</th>
                <th className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium text-right">Preostalo (ha)</th>
                <th className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium text-right">Stabala</th>
                <th className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium text-right">Vlake (km)</th>
                <th className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Napredak</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{r.odjel.broj}</span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2 text-xs">{r.odjel.gj}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{r.odjel.povrsina.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700 dark:text-green-400">
                    {r.ukupnoHektara.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-200 tabular-nums">
                    {r.kumulativnoHektara.toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${r.preostalo <= 0 ? "text-green-600 dark:text-green-400" : "text-gray-700 dark:text-gray-200"}`}>
                    {r.preostalo <= 0 ? "✓ Završeno" : r.preostalo.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-800 dark:text-gray-200">{r.ukupnoStabala > 0 ? r.ukupnoStabala : "–"}</td>
                  <td className="px-4 py-3 text-right text-gray-800 dark:text-gray-200">{r.ukupnoKm > 0 ? r.ukupnoKm.toFixed(2) : "–"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 min-w-[80px]">
                        <div
                          className={`h-1.5 rounded-full ${r.postotak >= 100 ? "bg-green-500" : r.postotak >= 50 ? "bg-amber-500" : "bg-blue-500"}`}
                          style={{ width: `${Math.min(r.postotak, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right">{r.postotak}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InzinjerIzvjestaj({
  rows,
  period,
  filterInzinjerId,
}: {
  rows: InzinjerRow[];
  period: Period;
  filterInzinjerId?: string | null;
}) {
  const visibleRows = filterInzinjerId
    ? rows.filter((r) => r.inzinjer.id === filterInzinjerId)
    : rows;

  const aktivni = visibleRows.filter((r) => r.ukupnoHektara > 0 || r.ukupnoKm > 0 || r.ukupnoStabala > 0);
  const ukupnoHa = visibleRows.reduce((s, r) => s + r.ukupnoHektara, 0);
  const ukupnoSt = visibleRows.reduce((s, r) => s + r.ukupnoStabala, 0);
  const ukupnoKm = visibleRows.reduce((s, r) => s + r.ukupnoKm, 0);
  const ukupnoOdsustvo = visibleRows.reduce((s, r) => s + (r.danaGodisnji ?? 0) + (r.danaBolovanje ?? 0), 0);
  const ukupnoRadniDani = visibleRows.reduce((s, r) => s + (r.danaRadnih ?? (r.danaTeren ?? 0) + (r.danaKancelarija ?? 0)), 0);

  const isPersonal = !!filterInzinjerId;

  if (!isPersonal && aktivni.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-10 text-center text-gray-400 dark:text-gray-500">
        <p className="text-2xl mb-2">📭</p>
        <p className="font-medium">Nema aktivnosti u odabranom periodu</p>
      </div>
    );
  }

  function handleExport() {
    const data = visibleRows.map((r) => ({
      Projektant: `${r.inzinjer.prezime} ${r.inzinjer.ime}`.trim(),
      Odjeli: r.inzinjer.odjeli.join(', '),
      "Hektara (ha)": r.ukupnoHektara,
      Stabala: r.ukupnoStabala,
      "Vlake (km)": r.ukupnoKm,
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
        <StatCard label="Ukupno obrađeno" value={`${ukupnoHa.toFixed(2)} ha`} color="green" />
        <StatCard label="Doznačenih stabala" value={ukupnoSt.toString()} color="emerald" />
        <StatCard label="Vlake projektovano" value={`${ukupnoKm.toFixed(2)} km`} color="amber" />
        <StatCard label="Radni dani" value={ukupnoRadniDani.toString()} color="orange" />
        <StatCard label="Dana odsustva" value={ukupnoOdsustvo.toString()} color="blue" />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-between items-center">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200">
            {isPersonal ? "Moji podaci" : "Pregled po projektantima"}
          </h2>
          <div className="flex items-center gap-3">
            {!isPersonal && (
              <span className="text-xs text-gray-500 dark:text-gray-400">{aktivni.length} projektanata sa aktivnošću</span>
            )}
            <button onClick={handleExport} className="bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-800">
              Export XLSX
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 dark:border-gray-700">
              <tr className="text-left">
                <th className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Projektant</th>
                <th className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Odjel</th>
                <th className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium text-right">Hektara (ha)</th>
                <th className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium text-right">Stabala</th>
                <th className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium text-right">Vlake (km)</th>
                <th className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium text-right">Teren</th>
                <th className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium text-right">God.</th>
                <th className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium text-right">Kanc.</th>
                <th className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium text-right">Bol.</th>
                <th className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium text-right">Unosa</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r, idx) => (
                <tr
                  key={idx}
                  className={`border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 ${r.brojUnosa === 0 ? "opacity-40" : ""}`}
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                    {r.inzinjer.prezime} {r.inzinjer.ime}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.inzinjer.odjeli.length > 0
                        ? r.inzinjer.odjeli.map((b) => (
                            <span key={b} className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs px-2 py-0.5 rounded-full">
                              {b}
                            </span>
                          ))
                        : <span className="text-gray-400 text-xs">–</span>
                      }
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700 dark:text-green-400">
                    {r.ukupnoHektara > 0 ? r.ukupnoHektara.toFixed(2) : "–"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-800 dark:text-gray-200">{r.ukupnoStabala > 0 ? r.ukupnoStabala : "–"}</td>
                  <td className="px-4 py-3 text-right text-gray-800 dark:text-gray-200">{r.ukupnoKm > 0 ? r.ukupnoKm.toFixed(2) : "–"}</td>
                  <td className="px-4 py-3 text-right text-orange-600 dark:text-orange-400">{(r.danaTeren ?? 0) > 0 ? r.danaTeren : "–"}</td>
                  <td className="px-4 py-3 text-right text-sky-600 dark:text-sky-400">{(r.danaGodisnji ?? 0) > 0 ? r.danaGodisnji : "–"}</td>
                  <td className="px-4 py-3 text-right text-violet-600 dark:text-violet-400">{(r.danaKancelarija ?? 0) > 0 ? r.danaKancelarija : "–"}</td>
                  <td className="px-4 py-3 text-right text-red-500 dark:text-red-400">{(r.danaBolovanje ?? 0) > 0 ? r.danaBolovanje : "–"}</td>
                  <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{r.brojUnosa}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
  // Group by GJ, preserving cmpOdjel sort order from DB
  const byGj: Map<string, DetaljanOdjelRed[]> = new Map();
  for (const row of data) {
    if (!byGj.has(row.gj)) byGj.set(row.gj, []);
    byGj.get(row.gj)!.push(row);
  }

  function fmtPeriod(od: string | null, do_: string | null): string {
    if (!od) return "–";
    if (!do_ || od === do_) return fmtDate(od);
    return `${fmtDate(od)} – ${fmtDate(do_)}`;
  }

  return (
    <div>
      {/* Year selector */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">Godina</span>
          <select
            value={year}
            onChange={(e) => onYear(Number(e.target.value))}
            className="h-9 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm px-3 pr-8 focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
          >
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {!loading && data.length > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400 self-end pb-1">
            {data.length} odjela · {byGj.size} GJ
          </span>
        )}
      </div>

      {err && (
        <div className="mb-4 rounded-lg px-4 py-2.5 text-sm border bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          {err}
        </div>
      )}

      {loading && <div className="text-center py-16 text-gray-500 dark:text-gray-400">Učitavam...</div>}

      {!loading && !err && data.length === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-10 text-center text-gray-400 dark:text-gray-500">
          <p className="text-2xl mb-2">📭</p>
          <p className="font-medium">Nema unesenih odjela za {year}. godinu</p>
        </div>
      )}

      {!loading && byGj.size > 0 && (
        <div className="space-y-6">
          {[...byGj.entries()].map(([gj, rows]) => {
            const gjHa = rows.reduce((s, r) => s + r.totalHa, 0);
            const gjSt = rows.reduce((s, r) => s + r.totalStabala, 0);
            const gjKm = rows.reduce((s, r) => s + r.totalKm, 0);
            return (
              <div key={gj} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                {/* GJ header */}
                <div className="px-5 py-3 bg-green-50 dark:bg-green-950 border-b border-green-200 dark:border-green-800 flex flex-wrap gap-4 items-center">
                  <h2 className="font-bold text-green-900 dark:text-green-100 text-base flex-1">{gj}</h2>
                  <div className="flex gap-4 text-xs text-green-800 dark:text-green-200">
                    <span><span className="font-semibold">{rows.length}</span> odjela</span>
                    {gjHa > 0 && <span><span className="font-semibold">{gjHa.toFixed(2)}</span> ha</span>}
                    {gjSt > 0 && <span><span className="font-semibold">{gjSt}</span> st.</span>}
                    {gjKm > 0 && <span><span className="font-semibold">{gjKm.toFixed(2)}</span> km vlaka</span>}
                  </div>
                </div>

                {/* Odjel rows */}
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rows.map((r) => (
                    <div key={r.odjelId} className="px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      {/* Odjel header row */}
                      <div className="flex flex-wrap gap-x-6 gap-y-1 items-baseline mb-2">
                        <span className="font-bold text-gray-900 dark:text-gray-100 text-base">{r.broj}</span>
                        {r.povrsina != null && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {r.povrsina.toFixed(2)} ha površina
                          </span>
                        )}
                      </div>

                      {/* Doznaka + Vlaka info */}
                      <div className="flex flex-wrap gap-4 mb-2">
                        {r.doznakaOd && (
                          <div className="flex items-start gap-2 text-sm">
                            <span className="inline-block bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs font-semibold px-2 py-0.5 rounded mt-0.5">DOZ</span>
                            <div>
                              <div className="text-gray-700 dark:text-gray-200">{fmtPeriod(r.doznakaOd, r.doznakaDo)}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-2 mt-0.5">
                                <span>{r.doznakaRadnihDana} rad. dana</span>
                                {r.totalHa > 0 && <span>· {r.totalHa.toFixed(2)} ha</span>}
                                {r.totalStabala > 0 && <span>· {r.totalStabala} stabala</span>}
                              </div>
                            </div>
                          </div>
                        )}
                        {r.vlakaOd && (
                          <div className="flex items-start gap-2 text-sm">
                            <span className="inline-block bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 text-xs font-semibold px-2 py-0.5 rounded mt-0.5">VLA</span>
                            <div>
                              <div className="text-gray-700 dark:text-gray-200">{fmtPeriod(r.vlakaOd, r.vlakaDo)}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-2 mt-0.5">
                                <span>{r.vlakaRadnihDana} rad. dana</span>
                                {r.totalKm > 0 && <span>· {r.totalKm.toFixed(2)} km</span>}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Projektanti */}
                      {r.projektanti.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {r.projektanti.map((p) => (
                            <span key={p.radnikId} className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs px-2.5 py-1 rounded-full">
                              <span className="font-medium">{p.ime}</span>
                              {p.ha > 0 && <span className="text-gray-500 dark:text-gray-400">{p.ha.toFixed(1)} ha</span>}
                              {p.stabala > 0 && <span className="text-gray-500 dark:text-gray-400">{p.stabala} st.</span>}
                              {p.km > 0 && <span className="text-gray-500 dark:text-gray-400">{p.km.toFixed(1)} km</span>}
                              <span className="text-gray-400 dark:text-gray-500">
                                {[p.dozDana > 0 ? `${p.dozDana}d doz` : null, p.vlaDana > 0 ? `${p.vlaDana}d vla` : null].filter(Boolean).join(", ")}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "green" | "blue" | "emerald" | "amber" | "orange";
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
      <div className={`text-2xl font-bold ${c.value}`}>{value}</div>
    </div>
  );
}
