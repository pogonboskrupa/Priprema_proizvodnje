"use client";
import { useEffect, useRef, useState } from "react";
import { getIzvjestaj, getSedmicnaTabela, type DnevnaAktivnost } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { exportXlsx } from "@/lib/export";
import { fmtDate } from "@/lib/format";

type Period = "sedmicno" | "mjesecno" | "godisnje";
type Tip = "odjel" | "inzinjer";

type OdjelRow = {
  odjel: { id: unknown; gj: string; broj: string; povrsina: number };
  ukupnoHektara: number;
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

// Generates last N months newest-first as { value: ISO date string, label }
function buildMonthOptions(count = 24) {
  const now = new Date();
  const opts: { value: string; label: string; date: Date }[] = [];
  const names = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      date: d,
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${names[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  return opts;
}

export default function IzvjestajiPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const isWorker = session?.role === "worker";
  const [period, setPeriod] = useState<Period>("mjesecno");
  const [tip, setTip] = useState<Tip>("odjel");
  // Computed inside state initializer to avoid SSR/client timezone mismatch
  const [monthOptions] = useState(() => buildMonthOptions(24));
  const [selectedMonth, setSelectedMonth] = useState(() => buildMonthOptions(1)[0].value);
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
    load(period, initialTip, selectedMonth);
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  function refDateFor(p: Period, monthVal: string): Date | undefined {
    if (p !== "mjesecno") return undefined;
    const [y, m] = monthVal.split("-").map(Number);
    return new Date(y, m - 1, 15); // mid-month → getDateRange calculates correct range
  }

  async function load(p: Period = period, t: Tip = tip, monthVal: string = selectedMonth) {
    const gen = ++genRef.current;
    setLoading(true);
    try {
      const fetches: [Promise<unknown>, Promise<TabelaData | null>] = [
        getIzvjestaj(p, t, refDateFor(p, monthVal)),
        p === "sedmicno" && t === "inzinjer" ? getSedmicnaTabela() : Promise.resolve(null),
      ];
      const [json, tabela] = await Promise.all(fetches);
      if (gen !== genRef.current) return;
      setData(json as IzvjestajData);
      setTabelaData(tabela as TabelaData | null);
    } catch {
      // data ostaje kao prije — korisnik vidi prethodne podatke
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

  const formatDate = (d: string) => fmtDate(d);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Izvještaji</h1>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 mb-6 flex flex-wrap gap-4 items-end">
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
      "Obrađeno (ha)": r.ukupnoHektara,
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
                <th className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium text-right">Obrađeno (ha)</th>
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
  const ukupnoOdsustvo = visibleRows.reduce((s, r) => s + (r.danaGodisnji ?? 0) + (r.danaKancelarija ?? 0) + (r.danaBolovanje ?? 0), 0);
  const ukupnoTeren = visibleRows.reduce((s, r) => s + (r.danaTeren ?? 0), 0);

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
        <StatCard label="Dana na terenu" value={ukupnoTeren.toString()} color="orange" />
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

const DANI = ["Pon", "Uto", "Sri", "Čet", "Pet"] as const;
const DANI_DOW = [1, 2, 3, 4, 5] as const; // 1=Ponedjeljak … 5=Petak

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

function aktivnostColor(vrsta: string) {
  switch (vrsta) {
    case "DOZNAKA":    return "bg-green-100 dark:bg-green-900/60 text-green-800 dark:text-green-200";
    case "VLAKA":      return "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200";
    case "TEREN":      return "bg-orange-100 dark:bg-orange-900/60 text-orange-800 dark:text-orange-200";
    case "GODISNJI":   return "bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200";
    case "KANCELARIJA":return "bg-violet-100 dark:bg-violet-900/60 text-violet-800 dark:text-violet-200";
    case "BOLOVANJE":  return "bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200";
    default:           return "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200";
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

  return (
    <div className="mt-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <h2 className="font-semibold text-gray-700 dark:text-gray-200">
          Dnevna aktivnost — {data.od} do {data.do_}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[600px]">
          <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-2.5 text-left text-gray-600 dark:text-gray-300 font-semibold w-40">
                Ime i prezime
              </th>
              {DANI.map((dan, i) => (
                <th key={dan} className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-300 font-semibold">
                  {dan}
                  <span className="block text-[10px] font-normal text-gray-400 dark:text-gray-500">
                    {fmtDayInTable(data.od, DANI_DOW[i])}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {radnici.map((radnik) => {
              const dayMap = data.entries[radnik.id] ?? {};
              const hasAny = DANI_DOW.some((dow) => (dayMap[dow]?.length ?? 0) > 0);
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
                  {DANI_DOW.map((dow) => {
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
                                className={`inline-block rounded px-1.5 py-0.5 leading-snug text-[11px] font-medium ${aktivnostColor(a.vrsta)}`}
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
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
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
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}`;
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
