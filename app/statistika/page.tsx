"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  getStatistikaPrisutnosti, getStatistikaUcinka, getUporedbaUcinka, getStatistikaPoOdjelima, getKorisnici,
  PrisutnostRow, UcinakMjesec, UporedbaRed, OdjelStatistika,
} from "@/lib/db";
import type { Korisnik, VrstaRada } from "@/lib/types";
import { VRSTA, heatClass } from "@/lib/vrste";
import { godineEvidencije } from "@/lib/godine";

const MJ_SHORT = ["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Avg","Sep","Okt","Nov","Dec"];
const MJ_FULL  = ["Januar","Februar","Mart","April","Maj","Juni","Juli","August","Septembar","Oktobar","Novembar","Decembar"];

type Tab = "prisutnost" | "ucanak" | "usporedba" | "odjeli";
type PVrsta = "teren" | "kancelarija" | "godisnji" | "bolovanje";
type SortKey = "ha" | "stabala" | "km";

const cfgFor = (v: VrstaRada) => ({ label: VRSTA[v].label, color: VRSTA[v].text, bg: (n: number) => heatClass(v, n) });
const VRSTA_CFG: Record<PVrsta, ReturnType<typeof cfgFor>> = {
  teren: cfgFor("TEREN"),
  kancelarija: cfgFor("KANCELARIJA"),
  godisnji: cfgFor("GODISNJI"),
  bolovanje: cfgFor("BOLOVANJE"),
};


export default function StatistikaPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const currentYear = new Date().getFullYear();

  const [tab, setTab]   = useState<Tab>("prisutnost");
  const [year, setYear] = useState(currentYear);

  // Prisutnost
  const [prisutnostData, setPrisutnostData] = useState<PrisutnostRow[]>([]);
  const [vrsta, setVrsta] = useState<PVrsta>("teren");

  // Učinak
  const [ucinakData, setUcinakData]     = useState<UcinakMjesec[]>([]);
  const [radnici, setRadnici]           = useState<Korisnik[]>([]);
  const [filterRadnik, setFilterRadnik] = useState("");

  // Usporedba
  const [uporedbaData, setUporedbaData]   = useState<UporedbaRed[]>([]);
  const [upoMjesec, setUpoMjesec]         = useState<number>(0);
  const [sortKey, setSortKey]             = useState<SortKey>("ha");

  // Po odjelima
  const [odjeliData, setOdjeliData]       = useState<OdjelStatistika[]>([]);
  const [odjeliMjesec, setOdjeliMjesec]   = useState<number>(0);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!loading && !session) router.replace("/login/");
    if (!loading && session && session.role !== "admin") router.replace("/");
  }, [session, loading]);

  useEffect(() => {
    if (!session) return;
    getKorisnici({ ukljuciArhivirane: true }).then((k) => setRadnici(k.filter((x) => x.role === "worker")));
  }, [session]);

  useEffect(() => {
    if (!session) return;
    // zastarjeli odgovor (brza promjena taba/godine) ne smije prepisati noviji
    let cancelled = false;
    const guard = <T,>(set: (v: T) => void) => (v: T) => { if (!cancelled) set(v); };
    setBusy(true);
    setErr("");
    const req =
      tab === "prisutnost" ? getStatistikaPrisutnosti(year).then(guard(setPrisutnostData))
      : tab === "ucanak" ? getStatistikaUcinka(year, filterRadnik || undefined).then(guard(setUcinakData))
      : tab === "usporedba" ? getUporedbaUcinka(year, upoMjesec || undefined).then(guard(setUporedbaData))
      : getStatistikaPoOdjelima(year, odjeliMjesec || undefined).then(guard(setOdjeliData));
    req
      .catch(() => { if (!cancelled) setErr("Greška pri učitavanju statistike. Provjeri internet i pokušaj ponovo."); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [session, tab, year, filterRadnik, upoMjesec, odjeliMjesec]);

  if (loading || !session || session.role !== "admin") return null;

  const years = godineEvidencije();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Statistika</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Presjeci po tipu dana, učinku i usporedba projektanata</p>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit max-w-full overflow-x-auto">
        {([
          ["prisutnost",  "📅 Prisutnost"],
          ["ucanak",      "🌲 Učinak"],
          ["usporedba",   "🏆 Usporedba"],
          ["odjeli",      "🗺️ Po odjelima"],
        ] as [Tab, string][]).map(([t, label]) => (
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
            <button key={y} onClick={() => setYear(y)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                year === y ? "bg-green-700 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}>
              {y}
            </button>
          ))}
        </div>
        {busy && <span className="text-xs text-gray-400 animate-pulse">Učitava…</span>}
      </div>

      {err && (
        <div className="rounded-lg px-4 py-2.5 text-sm border bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          {err}
        </div>
      )}

      {/* ── PRISUTNOST ── */}
      {tab === "prisutnost" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tip dana</span>
            {(Object.entries(VRSTA_CFG) as [PVrsta, typeof VRSTA_CFG[PVrsta]][]).map(([k, cfg]) => (
              <button key={k} onClick={() => setVrsta(k)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
                  vrsta === k
                    ? `${cfg.color} border-current bg-current/10`
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}>
                {cfg.label}
              </button>
            ))}
          </div>
          {prisutnostData.length === 0 && !busy && (
            <p className="text-sm text-gray-400 py-4">Nema podataka za {year}. godinu.</p>
          )}
          {prisutnostData.length > 0 && <PrisutnostTabela data={prisutnostData} vrsta={vrsta} year={year} />}
        </div>
      )}

      {/* ── UČINAK ── */}
      {tab === "ucanak" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Projektant</span>
            <select
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
              value={filterRadnik}
              onChange={(e) => setFilterRadnik(e.target.value)}>
              <option value="">Svi projektanti</option>
              {radnici.map((r) => <option key={r.id} value={r.id}>{r.fullName || r.ime}{r.arhiviran ? " (arhiviran)" : ""}</option>)}
            </select>
          </div>
          {ucinakData.length > 0 && <UcinakTabela data={ucinakData} year={year} />}
        </div>
      )}

      {/* ── USPOREDBA ── */}
      {/* ── PO ODJELIMA ── */}
      {tab === "odjeli" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Period</span>
            <button onClick={() => setOdjeliMjesec(0)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${odjeliMjesec === 0 ? "bg-green-700 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
              Cijela godina
            </button>
            {MJ_SHORT.map((m, i) => (
              <button key={i} onClick={() => setOdjeliMjesec(i + 1)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${odjeliMjesec === i + 1 ? "bg-green-700 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                {m}
              </button>
            ))}
          </div>

          {odjeliData.length === 0 && !busy && (
            <p className="text-sm text-gray-400 py-4">Nema podataka za odabrani period.</p>
          )}
          {odjeliData.length > 0 && (
            <OdjeliView data={odjeliData} year={year} mjesec={odjeliMjesec} />
          )}
        </div>
      )}

      {tab === "usporedba" && (
        <div className="space-y-4">
          {/* Period filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Period</span>
            <button
              onClick={() => setUpoMjesec(0)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                upoMjesec === 0 ? "bg-green-700 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}>
              Cijela godina
            </button>
            {MJ_SHORT.map((m, i) => (
              <button key={i} onClick={() => setUpoMjesec(i + 1)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  upoMjesec === i + 1 ? "bg-green-700 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}>
                {m}
              </button>
            ))}
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sortiraj po</span>
            {([["ha", "Hektarima"], ["stabala", "Stablima"], ["km", "Km vlaka"]] as [SortKey, string][]).map(([k, lbl]) => (
              <button key={k} onClick={() => setSortKey(k)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
                  sortKey === k
                    ? "border-green-600 bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}>
                {lbl}
              </button>
            ))}
          </div>

          {uporedbaData.length === 0 && !busy && (
            <p className="text-sm text-gray-400 py-4">Nema podataka za odabrani period.</p>
          )}
          {uporedbaData.length > 0 && (
            <UporedbaView
              data={uporedbaData}
              sortKey={sortKey}
              year={year}
              mjesec={upoMjesec}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Prisutnost tabela ────────────────────────────────────────────────────────

function PrisutnostTabela({ data, vrsta, year }: { data: PrisutnostRow[]; vrsta: PVrsta; year: number }) {
  const cfg = VRSTA_CFG[vrsta];
  const currentMonth = new Date().getFullYear() === year ? new Date().getMonth() + 1 : 12;

  const totalsPerMonth = MJ_SHORT.map((_, mi) =>
    data.reduce((s, row) => s + (row.podaci[mi + 1]?.[vrsta] ?? 0), 0)
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
            <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 min-w-[160px]">Projektant</th>
            {MJ_SHORT.map((m, i) => (
              <th key={m} className={`px-3 py-3 text-center font-semibold text-gray-600 dark:text-gray-400 min-w-[52px] ${i + 1 === currentMonth ? "underline underline-offset-4" : ""}`}>{m}</th>
            ))}
            <th className="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-300 min-w-[60px]">∑</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {data.map((row) => {
            const total = Object.values(row.podaci).reduce((s, v) => s + (v[vrsta] ?? 0), 0);
            return (
              <tr key={row.radnikId} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors">
                <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200 truncate max-w-[180px]">{row.ime}</td>
                {MJ_SHORT.map((_, i) => {
                  const n = row.podaci[i + 1]?.[vrsta] ?? 0;
                  return (
                    <td key={i} className={`px-3 py-2.5 text-center tabular-nums font-medium text-sm transition-colors ${n > 0 ? `${cfg.color} ${cfg.bg(n)}` : "text-gray-300 dark:text-gray-700"}`}>
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
          <tr className="bg-gray-50 dark:bg-gray-800/60 border-t-2 border-gray-200 dark:border-gray-700">
            <td className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ukupno</td>
            {totalsPerMonth.map((n, i) => (
              <td key={i} className={`px-3 py-2.5 text-center tabular-nums text-sm font-bold ${n > 0 ? cfg.color : "text-gray-300 dark:text-gray-700"}`}>{n > 0 ? n : "·"}</td>
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
            <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 min-w-[130px]">Mjesec</th>
            <th className="px-4 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-400 min-w-[90px]">Ha</th>
            <th className="px-4 py-3 text-right font-semibold text-green-700 dark:text-green-400 min-w-[90px]">Stabala</th>
            <th className="px-4 py-3 text-right font-semibold text-amber-700 dark:text-amber-400 min-w-[90px]">Km vlaka</th>
            <th className="px-4 py-3 min-w-[140px]"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {data.map((m) => {
            const hasData = m.ha > 0 || m.stabala > 0 || m.km > 0;
            return (
              <tr key={m.mjesec} className={`transition-colors ${m.mjesec === currentMonth ? "bg-green-50/60 dark:bg-green-950/20" : "hover:bg-gray-50/60 dark:hover:bg-gray-800/30"}`}>
                <td className={`px-4 py-3 font-medium ${m.mjesec === currentMonth ? "text-green-700 dark:text-green-400 font-bold" : "text-gray-700 dark:text-gray-300"}`}>
                  {MJ_FULL[m.mjesec - 1]}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums font-mono text-sm ${m.ha > 0 ? "text-emerald-700 dark:text-emerald-300 font-semibold" : "text-gray-300 dark:text-gray-700"}`}>
                  {m.ha > 0 ? m.ha.toFixed(2) : "—"}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums font-mono text-sm ${m.stabala > 0 ? "text-green-700 dark:text-green-300 font-semibold" : "text-gray-300 dark:text-gray-700"}`}>
                  {m.stabala > 0 ? m.stabala.toLocaleString("bs-BA") : "—"}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums font-mono text-sm ${m.km > 0 ? "text-amber-700 dark:text-amber-300 font-semibold" : "text-gray-300 dark:text-gray-700"}`}>
                  {m.km > 0 ? m.km.toFixed(2) : "—"}
                </td>
                <td className="px-4 py-3">
                  {hasData && (
                    <div className="flex flex-col gap-1">
                      {m.ha > 0 && <MiniBar ratio={m.ha / maxHa} color="bg-emerald-400 dark:bg-emerald-500" track="bg-emerald-100 dark:bg-emerald-900/50" />}
                      {m.km > 0 && <MiniBar ratio={m.km / maxKm} color="bg-amber-400 dark:bg-amber-500"     track="bg-amber-100 dark:bg-amber-900/50" />}
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
            <td className="px-4 py-3 text-right tabular-nums font-extrabold text-emerald-700 dark:text-emerald-300 font-mono">{totalHa.toFixed(2)}</td>
            <td className="px-4 py-3 text-right tabular-nums font-extrabold text-green-700 dark:text-green-300 font-mono">{totalStabala.toLocaleString("bs-BA")}</td>
            <td className="px-4 py-3 text-right tabular-nums font-extrabold text-amber-700 dark:text-amber-300 font-mono">{totalKm.toFixed(2)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Usporedba view ────────────────────────────────────────────────────────────

function UporedbaView({ data, sortKey, year, mjesec }: {
  data: UporedbaRed[]; sortKey: SortKey; year: number; mjesec: number;
}) {
  const sorted = [...data].sort((a, b) => b[sortKey] - a[sortKey]);
  const maxHa      = Math.max(...sorted.map((r) => r.ha), 0.01);
  const maxStabala = Math.max(...sorted.map((r) => r.stabala), 1);
  const maxKm      = Math.max(...sorted.map((r) => r.km), 0.01);

  const periodLabel = mjesec === 0 ? `${year}. godina` : `${MJ_FULL[mjesec - 1]} ${year}`;

  const hasHa  = sorted.some((r) => r.ha > 0);
  const hasKm  = sorted.some((r) => r.km > 0);

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{periodLabel} · sortirano po {sortKey === "ha" ? "hektarima" : sortKey === "stabala" ? "stablima" : "km vlaka"}</p>

      <div className="space-y-2">
        {sorted.map((row, idx) => {
          const haRatio  = maxHa      > 0 ? row.ha      / maxHa      : 0;
          const stRatio  = maxStabala > 0 ? row.stabala / maxStabala : 0;
          const kmRatio  = maxKm      > 0 ? row.km      / maxKm      : 0;
          const isEmpty  = row.ha === 0 && row.stabala === 0 && row.km === 0;
          const medal    = row[sortKey] <= 0 ? null : idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;

          return (
            <div
              key={row.radnikId}
              className={`rounded-xl border transition-colors ${
                isEmpty
                  ? "border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
              } p-4`}
            >
              {/* Name row */}
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-gray-400 dark:text-gray-600 w-5 tabular-nums flex-shrink-0">
                    {medal ?? `${idx + 1}.`}
                  </span>
                  <span className={`font-semibold text-sm truncate ${isEmpty ? "text-gray-400 dark:text-gray-600" : "text-gray-800 dark:text-gray-100"}`}>
                    {row.ime}
                  </span>
                </div>
                {/* Summary chips */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {row.ha > 0 && (
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 tabular-nums bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
                      {row.ha.toFixed(2)} ha
                    </span>
                  )}
                  {row.stabala > 0 && (
                    <span className="text-xs font-bold text-green-700 dark:text-green-300 tabular-nums bg-green-50 dark:bg-green-950/50 px-2 py-0.5 rounded-full">
                      {row.stabala.toLocaleString("bs-BA")} st
                    </span>
                  )}
                  {row.km > 0 && (
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-300 tabular-nums bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full">
                      {row.km.toFixed(2)} km
                    </span>
                  )}
                  {isEmpty && <span className="text-xs text-gray-400 dark:text-gray-600 italic">bez unosa</span>}
                </div>
              </div>

              {/* Bars */}
              {!isEmpty && (
                <div className="space-y-1.5">
                  {hasHa && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 w-16 text-right flex-shrink-0">Ha</span>
                      <div className="flex-1 h-2.5 rounded-full bg-emerald-100 dark:bg-emerald-950 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 dark:from-emerald-500 dark:to-emerald-400 transition-all duration-500"
                          style={{ width: `${haRatio * 100}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300 w-14 text-right flex-shrink-0 tabular-nums">
                        {row.ha > 0 ? row.ha.toFixed(2) : "—"}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 w-16 text-right flex-shrink-0">Stabala</span>
                    <div className="flex-1 h-2.5 rounded-full bg-green-100 dark:bg-green-950 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600 dark:from-green-500 dark:to-green-400 transition-all duration-500"
                        style={{ width: `${stRatio * 100}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-green-700 dark:text-green-300 w-14 text-right flex-shrink-0 tabular-nums">
                      {row.stabala > 0 ? row.stabala.toLocaleString("bs-BA") : "—"}
                    </span>
                  </div>
                  {hasKm && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 w-16 text-right flex-shrink-0">Km vlaka</span>
                      <div className="flex-1 h-2.5 rounded-full bg-amber-100 dark:bg-amber-950 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 dark:from-amber-500 dark:to-amber-400 transition-all duration-500"
                          style={{ width: `${kmRatio * 100}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-amber-700 dark:text-amber-300 w-14 text-right flex-shrink-0 tabular-nums">
                        {row.km > 0 ? row.km.toFixed(2) : "—"}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniBar({ ratio, color, track }: { ratio: number; color: string; track: string }) {
  return (
    <div className={`h-1.5 rounded-full ${track} flex-1 max-w-[100px] overflow-hidden`}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}

// ── Po odjelima view ──────────────────────────────────────────────────────────

function OdjeliView({ data, year, mjesec }: { data: OdjelStatistika[]; year: number; mjesec: number }) {
  const periodLabel = mjesec === 0 ? `${year}. godina` : `${MJ_FULL[mjesec - 1]} ${year}`;

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{periodLabel} · {data.length} aktivnih odjela</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {data.map((odjel) => {
          const maxHa = Math.max(...odjel.projektanti.map((p) => p.ha), 0.01);
          const maxKm = Math.max(...odjel.projektanti.map((p) => p.km), 0.01);
          const maxSt = Math.max(...odjel.projektanti.map((p) => p.stabala), 1);
          const hasHa = odjel.projektanti.some((p) => p.ha > 0);
          const hasKm = odjel.projektanti.some((p) => p.km > 0);

          return (
            <div key={odjel.odjelId} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
              {/* Odjel header */}
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-gray-900 dark:text-gray-100">{odjel.gj}</span>
                  <span className="text-gray-400 dark:text-gray-500 mx-1">/</span>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">{odjel.broj}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {odjel.totalHa > 0 && (
                    <span className="text-xs font-bold tabular-nums text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
                      {odjel.totalHa.toFixed(2)} ha
                    </span>
                  )}
                  {odjel.totalStabala > 0 && (
                    <span className="text-xs font-bold tabular-nums text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/50 px-2 py-0.5 rounded-full">
                      {odjel.totalStabala.toLocaleString("bs-BA")} st
                    </span>
                  )}
                  {odjel.totalKm > 0 && (
                    <span className="text-xs font-bold tabular-nums text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full">
                      {odjel.totalKm.toFixed(2)} km
                    </span>
                  )}
                </div>
              </div>

              {/* Projektanti */}
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {odjel.projektanti.map((p, idx) => {
                  const haRatio = maxHa  > 0 ? p.ha / maxHa  : 0;
                  const kmRatio = maxKm  > 0 ? p.km / maxKm  : 0;
                  const stRatio = p.stabala / maxSt;

                  return (
                    <div key={p.radnikId} className="px-4 py-3">
                      {/* Name + chips */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-600 w-4 tabular-nums flex-shrink-0">{idx + 1}.</span>
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{p.ime}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 text-[11px] font-mono tabular-nums">
                          {p.ha > 0 && <span className="text-emerald-600 dark:text-emerald-400">{p.ha.toFixed(2)} ha</span>}
                          {p.stabala > 0 && <span className="text-green-600 dark:text-green-400">{p.stabala.toLocaleString("bs-BA")} st</span>}
                          {p.km > 0 && <span className="text-amber-600 dark:text-amber-400">{p.km.toFixed(2)} km</span>}
                        </div>
                      </div>

                      {/* Bars */}
                      <div className="space-y-1">
                        {hasHa && (
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-gray-400 dark:text-gray-600 w-10 text-right flex-shrink-0">Ha</span>
                            <div className="flex-1 h-2 rounded-full bg-emerald-100 dark:bg-emerald-950 overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
                                style={{ width: `${haRatio * 100}%` }} />
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-gray-400 dark:text-gray-600 w-10 text-right flex-shrink-0">Stabala</span>
                          <div className="flex-1 h-2 rounded-full bg-green-100 dark:bg-green-950 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
                              style={{ width: `${stRatio * 100}%` }} />
                          </div>
                        </div>
                        {hasKm && (
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-gray-400 dark:text-gray-600 w-10 text-right flex-shrink-0">Km vlaka</span>
                            <div className="flex-1 h-2 rounded-full bg-amber-100 dark:bg-amber-950 overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-500"
                                style={{ width: `${kmRatio * 100}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
