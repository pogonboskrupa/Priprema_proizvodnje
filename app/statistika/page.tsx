"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  getStatistikaPrisutnosti, getStatistikaUcinka, getKorisnici,
  PrisutnostRow, UcinakMjesec,
} from "@/lib/db";
import type { Korisnik } from "@/lib/types";

const MJ_SHORT = ["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Avg","Sep","Okt","Nov","Dec"];
const MJ_FULL  = ["Januar","Februar","Mart","April","Maj","Juni","Juli","August","Septembar","Oktobar","Novembar","Decembar"];

type Tab = "prisutnost" | "ucanak";
type PVrsta = "teren" | "kancelarija" | "godisnji" | "bolovanje";

const VRSTA_CFG: Record<PVrsta, { label: string; color: string; bg: (n: number) => string }> = {
  teren:      { label: "Teren",       color: "text-amber-700 dark:text-amber-300",
    bg: (n) => n === 0 ? "" : n <= 2 ? "bg-amber-50 dark:bg-amber-950/40" : n <= 5 ? "bg-amber-100 dark:bg-amber-900/60" : "bg-amber-200 dark:bg-amber-800/80" },
  kancelarija:{ label: "Kancelarija", color: "text-violet-700 dark:text-violet-300",
    bg: (n) => n === 0 ? "" : n <= 2 ? "bg-violet-50 dark:bg-violet-950/40" : n <= 5 ? "bg-violet-100 dark:bg-violet-900/60" : "bg-violet-200 dark:bg-violet-800/80" },
  godisnji:   { label: "Godišnji odmor", color: "text-sky-700 dark:text-sky-300",
    bg: (n) => n === 0 ? "" : n <= 2 ? "bg-sky-50 dark:bg-sky-950/40" : n <= 5 ? "bg-sky-100 dark:bg-sky-900/60" : "bg-sky-200 dark:bg-sky-800/80" },
  bolovanje:  { label: "Bolovanje",   color: "text-red-700 dark:text-red-300",
    bg: (n) => n === 0 ? "" : n <= 2 ? "bg-red-50 dark:bg-red-950/40" : n <= 5 ? "bg-red-100 dark:bg-red-900/60" : "bg-red-200 dark:bg-red-800/80" },
};

function yearOptions(current: number) {
  return Array.from({ length: 5 }, (_, i) => current - i);
}

export default function StatistikaPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const currentYear = new Date().getFullYear();

  const [tab, setTab] = useState<Tab>("prisutnost");
  const [year, setYear] = useState(currentYear);

  const [prisutnostData, setPrisutnostData] = useState<PrisutnostRow[]>([]);
  const [vrsta, setVrsta] = useState<PVrsta>("teren");

  const [ucinakData, setUcinakData] = useState<UcinakMjesec[]>([]);
  const [radnici, setRadnici] = useState<Korisnik[]>([]);
  const [filterRadnik, setFilterRadnik] = useState("");

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !session) router.replace("/login/");
    if (!loading && session && session.role !== "admin") router.replace("/");
  }, [session, loading]);

  useEffect(() => {
    if (!session) return;
    getKorisnici().then((k) => setRadnici(k.filter((x) => x.role === "worker")));
  }, [session]);

  useEffect(() => {
    if (!session) return;
    setBusy(true);
    if (tab === "prisutnost") {
      getStatistikaPrisutnosti(year).then(setPrisutnostData).finally(() => setBusy(false));
    } else {
      getStatistikaUcinka(year, filterRadnik || undefined).then(setUcinakData).finally(() => setBusy(false));
    }
  }, [session, tab, year, filterRadnik]);

  if (loading || !session || session.role !== "admin") return null;

  const years = yearOptions(currentYear);

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Statistika</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Presjeci po tipu dana i učinku projektanata</p>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        {([["prisutnost", "📅 Prisutnost"], ["ucanak", "🌲 Učinak"]] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Year selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Godina</span>
        <div className="flex gap-1">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                year === y
                  ? "bg-green-700 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
        {busy && <span className="text-xs text-gray-400 animate-pulse">Učitava…</span>}
      </div>

      {/* ── PRISUTNOST TAB ── */}
      {tab === "prisutnost" && (
        <div className="space-y-4">
          {/* Vrsta selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tip dana</span>
            {(Object.entries(VRSTA_CFG) as [PVrsta, typeof VRSTA_CFG[PVrsta]][]).map(([k, cfg]) => (
              <button
                key={k}
                onClick={() => setVrsta(k)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
                  vrsta === k
                    ? `${cfg.color} border-current bg-current/10`
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {cfg.label}
              </button>
            ))}
          </div>

          {prisutnostData.length === 0 && !busy && (
            <p className="text-sm text-gray-400 py-4">Nema podataka za {year}. godinu.</p>
          )}

          {prisutnostData.length > 0 && (
            <PrisutnostTabela data={prisutnostData} vrsta={vrsta} year={year} />
          )}
        </div>
      )}

      {/* ── UČINAK TAB ── */}
      {tab === "ucanak" && (
        <div className="space-y-4">
          {/* Projektant filter */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Projektant</span>
            <select
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
              value={filterRadnik}
              onChange={(e) => setFilterRadnik(e.target.value)}
            >
              <option value="">Svi projektanti</option>
              {radnici.map((r) => (
                <option key={r.id} value={r.id}>{r.fullName || r.ime}</option>
              ))}
            </select>
          </div>

          {ucinakData.length > 0 && <UcinakTabela data={ucinakData} year={year} />}
        </div>
      )}
    </div>
  );
}

// ── Prisutnost tabela ────────────────────────────────────────────────────────

function PrisutnostTabela({ data, vrsta, year }: { data: PrisutnostRow[]; vrsta: PVrsta; year: number }) {
  const cfg = VRSTA_CFG[vrsta];
  const currentMonth = new Date().getFullYear() === year ? new Date().getMonth() + 1 : 12;

  const totalsPerMonth = MJ_SHORT.map((_, mi) => {
    const m = mi + 1;
    return data.reduce((s, row) => s + (row.podaci[m]?.[vrsta] ?? 0), 0);
  });

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
            <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 min-w-[160px]">
              Projektant
            </th>
            {MJ_SHORT.map((m, i) => (
              <th
                key={m}
                className={`px-3 py-3 text-center font-semibold text-gray-600 dark:text-gray-400 min-w-[52px] ${
                  i + 1 === currentMonth ? "underline underline-offset-4" : ""
                }`}
              >
                {m}
              </th>
            ))}
            <th className="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-300 min-w-[60px]">∑</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {data.map((row) => {
            const total = Object.values(row.podaci).reduce((s, v) => s + (v[vrsta] ?? 0), 0);
            return (
              <tr key={row.radnikId} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors">
                <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200 text-sm truncate max-w-[180px]">
                  {row.ime}
                </td>
                {MJ_SHORT.map((_, i) => {
                  const m = i + 1;
                  const n = row.podaci[m]?.[vrsta] ?? 0;
                  return (
                    <td
                      key={m}
                      className={`px-3 py-2.5 text-center tabular-nums font-medium text-sm transition-colors ${
                        n > 0 ? `${cfg.color} ${cfg.bg(n)}` : "text-gray-300 dark:text-gray-700"
                      }`}
                    >
                      {n > 0 ? n : "·"}
                    </td>
                  );
                })}
                <td className={`px-4 py-2.5 text-center font-bold tabular-nums ${total > 0 ? cfg.color : "text-gray-300 dark:text-gray-700"}`}>
                  {total > 0 ? total : "·"}
                </td>
              </tr>
            );
          })}

          {/* Totals row */}
          <tr className="bg-gray-50 dark:bg-gray-800/60 border-t-2 border-gray-200 dark:border-gray-700 font-semibold">
            <td className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Ukupno
            </td>
            {totalsPerMonth.map((n, i) => (
              <td key={i} className={`px-3 py-2.5 text-center tabular-nums text-sm font-bold ${n > 0 ? cfg.color : "text-gray-300 dark:text-gray-700"}`}>
                {n > 0 ? n : "·"}
              </td>
            ))}
            <td className={`px-4 py-2.5 text-center font-extrabold tabular-nums ${cfg.color}`}>
              {totalsPerMonth.reduce((a, b) => a + b, 0) || "·"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Učinak tabela ────────────────────────────────────────────────────────────

function UcinakTabela({ data, year }: { data: UcinakMjesec[]; year: number }) {
  const currentMonth = new Date().getFullYear() === year ? new Date().getMonth() + 1 : 12;
  const totalHa = data.reduce((s, m) => s + m.ha, 0);
  const totalStabala = data.reduce((s, m) => s + m.stabala, 0);
  const totalKm = data.reduce((s, m) => s + m.km, 0);

  const maxHa = Math.max(...data.map((m) => m.ha), 1);
  const maxKm = Math.max(...data.map((m) => m.km), 1);

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
            <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 min-w-[120px]">Mjesec</th>
            <th className="px-4 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-400 min-w-[90px]">Ha</th>
            <th className="px-4 py-3 text-right font-semibold text-green-700 dark:text-green-400 min-w-[90px]">Stabala</th>
            <th className="px-4 py-3 text-right font-semibold text-sky-700 dark:text-sky-400 min-w-[90px]">Km vlaka</th>
            <th className="px-4 py-3 min-w-[140px]"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {data.map((m) => {
            const haRatio = m.ha / maxHa;
            const kmRatio = m.km / maxKm;
            const hasData = m.ha > 0 || m.stabala > 0 || m.km > 0;
            return (
              <tr
                key={m.mjesec}
                className={`transition-colors ${
                  m.mjesec === currentMonth
                    ? "bg-green-50/60 dark:bg-green-950/20"
                    : "hover:bg-gray-50/60 dark:hover:bg-gray-800/30"
                }`}
              >
                <td className={`px-4 py-3 font-medium ${m.mjesec === currentMonth ? "text-green-700 dark:text-green-400 font-bold" : "text-gray-700 dark:text-gray-300"}`}>
                  {MJ_FULL[m.mjesec - 1]}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums font-mono text-sm ${m.ha > 0 ? "text-emerald-700 dark:text-emerald-300 font-semibold" : "text-gray-300 dark:text-gray-700"}`}>
                  {m.ha > 0 ? m.ha.toFixed(2) : "—"}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums font-mono text-sm ${m.stabala > 0 ? "text-green-700 dark:text-green-300 font-semibold" : "text-gray-300 dark:text-gray-700"}`}>
                  {m.stabala > 0 ? m.stabala.toLocaleString("bs-BA") : "—"}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums font-mono text-sm ${m.km > 0 ? "text-sky-700 dark:text-sky-300 font-semibold" : "text-gray-300 dark:text-gray-700"}`}>
                  {m.km > 0 ? m.km.toFixed(2) : "—"}
                </td>
                <td className="px-4 py-3">
                  {hasData && (
                    <div className="flex flex-col gap-1">
                      {m.ha > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 rounded-full bg-emerald-200 dark:bg-emerald-900 flex-1 max-w-[100px] overflow-hidden">
                            <div className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full" style={{ width: `${haRatio * 100}%` }} />
                          </div>
                        </div>
                      )}
                      {m.km > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 rounded-full bg-sky-200 dark:bg-sky-900 flex-1 max-w-[100px] overflow-hidden">
                            <div className="h-full bg-sky-500 dark:bg-sky-400 rounded-full" style={{ width: `${kmRatio * 100}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/60">
            <td className="px-4 py-3 font-extrabold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wide">Godišnji ∑</td>
            <td className="px-4 py-3 text-right tabular-nums font-extrabold text-emerald-700 dark:text-emerald-300 font-mono">
              {totalHa.toFixed(2)}
            </td>
            <td className="px-4 py-3 text-right tabular-nums font-extrabold text-green-700 dark:text-green-300 font-mono">
              {totalStabala.toLocaleString("bs-BA")}
            </td>
            <td className="px-4 py-3 text-right tabular-nums font-extrabold text-sky-700 dark:text-sky-300 font-mono">
              {totalKm.toFixed(2)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
