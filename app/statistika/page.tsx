"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  getStatistikaPrisutnosti, getStatistikaUcinka, getUporedbaUcinka, getStatistikaPoOdjelima, getKorisnici,
  type PrisutnostRow, type UcinakMjesec, type UporedbaRed, type OdjelStatistika, type RadniDani,
} from "@/lib/db";
import type { Korisnik, VrstaRada } from "@/lib/types";
import { VRSTA, heatClass } from "@/lib/vrste";
import { godineEvidencije } from "@/lib/godine";
import { useUnosiRefresh } from "@/hooks/useUnosiRefresh";
import { podijeli } from "@/lib/odjel-pregled";

const MJ_SHORT = ["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Avg","Sep","Okt","Nov","Dec"];
const MJ_FULL  = ["Januar","Februar","Mart","April","Maj","Juni","Juli","August","Septembar","Oktobar","Novembar","Decembar"];

type Tab = "prisutnost" | "ucanak" | "usporedba" | "odjeli";
type PVrsta = "teren" | "kancelarija" | "godisnji" | "bolovanje";
type SortKey = "ha" | "stabala" | "km" | "haDan" | "kmDan";
type OdjeliSort = "gj" | "ha" | "stabala" | "km";

const cfgFor = (v: VrstaRada) => ({ label: VRSTA[v].label, color: VRSTA[v].text, bg: (n: number) => heatClass(v, n) });
const VRSTA_CFG: Record<PVrsta, ReturnType<typeof cfgFor>> = {
  teren: cfgFor("TEREN"),
  kancelarija: cfgFor("KANCELARIJA"),
  godisnji: cfgFor("GODISNJI"),
  bolovanje: cfgFor("BOLOVANJE"),
};

const TAB_LABELS: [Tab, string][] = [
  ["prisutnost", "Prisutnost"],
  ["ucanak",     "Učinak"],
  ["usporedba",  "Usporedba"],
  ["odjeli",     "Po odjelima"],
];

function tabCls(active: boolean) {
  return active
    ? "px-4 py-2 text-sm font-semibold text-green-700 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400 -mb-px"
    : "px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border-b-2 border-transparent -mb-px transition-colors";
}

function YearBar({ years, year, onYear, busy }: { years: number[]; year: number; onYear: (y: number) => void; busy: boolean }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Godina</span>
      <div className="flex gap-1">
        {years.map((y) => (
          <button key={y} onClick={() => onYear(y)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              year === y ? "bg-green-700 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}>
            {y}
          </button>
        ))}
      </div>
      {busy && <span className="text-xs text-gray-400 animate-pulse">Učitava…</span>}
    </div>
  );
}

function PeriodBar({ mjesec, onMjesec }: { mjesec: number; onMjesec: (m: number) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button onClick={() => onMjesec(0)}
        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
          mjesec === 0 ? "bg-green-700 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
        }`}>
        Cijela godina
      </button>
      {MJ_SHORT.map((m, i) => (
        <button key={i} onClick={() => onMjesec(i + 1)}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
            mjesec === i + 1 ? "bg-green-700 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}>
          {m}
        </button>
      ))}
    </div>
  );
}

function fmtHa(n: number) { return n > 0 ? n.toFixed(2) : "—"; }
function fmtKm(n: number) { return n > 0 ? n.toFixed(2) : "—"; }
function fmtSt(n: number) { return n > 0 ? n.toLocaleString("bs-BA") : "—"; }
function fmtProsjek(n: number, dec = 2) { return n > 0 ? n.toFixed(dec) : "—"; }

interface UcinakZbir { ha: number; stabala: number; km: number; dozDana: number; vlDana: number }

/** Prosjeci po projektant-danu (dan doznake odnosno dan vlake jednog projektanta) */
function prosjeci(r: UcinakZbir) {
  return {
    haDan: podijeli(r.ha, r.dozDana),
    stDan: podijeli(r.stabala, r.dozDana),
    stHa: podijeli(r.stabala, r.ha),
    kmDan: podijeli(r.km, r.vlDana),
  };
}

function zbir(rows: readonly UcinakZbir[]): UcinakZbir {
  return rows.reduce<UcinakZbir>(
    (s, r) => ({ ha: s.ha + r.ha, stabala: s.stabala + r.stabala, km: s.km + r.km, dozDana: s.dozDana + r.dozDana, vlDana: s.vlDana + r.vlDana }),
    { ha: 0, stabala: 0, km: 0, dozDana: 0, vlDana: 0 },
  );
}

function ProsjeciTraka({ z, naslov }: { z: UcinakZbir; naslov: string }) {
  const p = prosjeci(z);
  const kartice = [
    { label: "ha po danu doznake", value: fmtProsjek(p.haDan), note: `${z.dozDana} dana doznake`, tone: "text-emerald-700 dark:text-emerald-300" },
    { label: "stabala po danu doznake", value: fmtProsjek(p.stDan, 0), note: `${fmtSt(z.stabala)} stabala`, tone: "text-green-700 dark:text-green-300" },
    { label: "stabala po ha", value: fmtProsjek(p.stHa, 0), note: `${fmtHa(z.ha)} ha`, tone: "text-green-700 dark:text-green-300" },
    { label: "km po danu vlake", value: fmtProsjek(p.kmDan), note: `${z.vlDana} dana vlake`, tone: "text-amber-700 dark:text-amber-300" },
  ];
  return (
    <section aria-label={naslov} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <h2 className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
        {naslov} <span className="normal-case tracking-normal font-normal text-gray-400 dark:text-gray-500">· učinak ÷ radni dani na tom poslu</span>
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-gray-200 dark:divide-gray-700">
        {kartice.map((k) => (
          <div key={k.label} className="px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{k.label}</div>
            <div className={`mt-0.5 text-2xl font-bold tabular-nums ${k.tone}`}>{k.value}</div>
            <div className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">{k.note}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function StatistikaPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const currentYear = new Date().getFullYear();

  const [tab, setTab]   = useState<Tab>("prisutnost");
  const [year, setYear] = useState(currentYear);

  const [prisutnostData, setPrisutnostData] = useState<PrisutnostRow[]>([]);
  const [vrsta, setVrsta] = useState<PVrsta>("teren");

  const [ucinakData, setUcinakData]     = useState<UcinakMjesec[]>([]);
  const [radnici, setRadnici]           = useState<Korisnik[]>([]);
  const [filterRadnik, setFilterRadnik] = useState("");

  const [uporedbaData, setUporedbaData] = useState<UporedbaRed[]>([]);
  const [upoMjesec, setUpoMjesec]       = useState<number>(0);
  const [sortKey, setSortKey]           = useState<SortKey>("ha");

  const [odjeliData, setOdjeliData]     = useState<OdjelStatistika[]>([]);
  const [odjeliDani, setOdjeliDani]     = useState<RadniDani>({ dozDana: 0, vlDana: 0 });
  const [odjeliMjesec, setOdjeliMjesec] = useState<number>(0);
  const [odjeliSort, setOdjeliSort]     = useState<OdjeliSort>("gj");

  const [busy, setBusy] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  useUnosiRefresh(() => setRefreshTick((t) => t + 1));
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!loading && !session) router.replace("/login/");
    if (!loading && session && session.role !== "admin") router.replace("/");
  }, [session, loading]);

  useEffect(() => {
    if (!session) return;
    getKorisnici({ ukljuciArhivirane: true }).then((k) => setRadnici(k.filter((x) => x.role === "worker"))).catch(() => {});
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const guard = <T,>(set: (v: T) => void) => (v: T) => { if (!cancelled) set(v); };
    setBusy(true);
    setErr("");
    const req =
      tab === "prisutnost" ? getStatistikaPrisutnosti(year).then(guard(setPrisutnostData))
      : tab === "ucanak"   ? getStatistikaUcinka(year, filterRadnik || undefined).then(guard(setUcinakData))
      : tab === "usporedba"? getUporedbaUcinka(year, upoMjesec || undefined).then(guard(setUporedbaData))
      : getStatistikaPoOdjelima(year, odjeliMjesec || undefined).then(guard((r) => { setOdjeliData(r.odjeli); setOdjeliDani(r.ukupno); }));
    req
      .catch(() => { if (!cancelled) setErr("Greška pri učitavanju. Provjeri internet i pokušaj ponovo."); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [session, tab, year, filterRadnik, upoMjesec, odjeliMjesec, refreshTick]);

  if (loading || !session || session.role !== "admin") return null;

  const years = godineEvidencije();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Statistika</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Prisutnost, učinak i usporedba projektanata</p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <div className="flex gap-0 overflow-x-auto" role="tablist">
          {TAB_LABELS.map(([t, label]) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={tabCls(tab === t)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <YearBar years={years} year={year} onYear={setYear} busy={busy} />

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
            {vrsta === "teren" && <span className="text-xs text-gray-400 dark:text-gray-500">uključuje dane doznake i vlaka</span>}
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
          {ucinakData.length === 0 && !busy && (
            <p className="text-sm text-gray-400 py-4">Nema podataka za {year}. godinu.</p>
          )}
          {ucinakData.length > 0 && <ProsjeciTraka z={zbir(ucinakData)} naslov={`Prosjek ${year}.`} />}
          {ucinakData.length > 0 && <UcinakTabela data={ucinakData} year={year} />}
        </div>
      )}

      {/* ── USPOREDBA ── */}
      {tab === "usporedba" && (
        <div className="space-y-4">
          <PeriodBar mjesec={upoMjesec} onMjesec={setUpoMjesec} />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sortiraj po</span>
            {([["ha", "Hektarima"], ["stabala", "Stablima"], ["km", "Km vlaka"], ["haDan", "ha / dan"], ["kmDan", "km / dan"]] as [SortKey, string][]).map(([k, lbl]) => (
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
          {uporedbaData.length > 0 && <ProsjeciTraka z={zbir(uporedbaData)} naslov="Prosjek tima" />}
          {uporedbaData.length > 0 && (
            <UporedbaTabela data={uporedbaData} sortKey={sortKey} year={year} mjesec={upoMjesec} />
          )}
        </div>
      )}

      {/* ── PO ODJELIMA ── */}
      {tab === "odjeli" && (
        <div className="space-y-4">
          <PeriodBar mjesec={odjeliMjesec} onMjesec={setOdjeliMjesec} />
          {odjeliData.length === 0 && !busy && (
            <p className="text-sm text-gray-400 py-4">Nema podataka za odabrani period.</p>
          )}
          {odjeliData.length > 0 && (
            <ProsjeciTraka z={{ ...zbir(odjeliData.map((o) => ({ ha: o.totalHa, stabala: o.totalStabala, km: o.totalKm, dozDana: 0, vlDana: 0 }))), ...odjeliDani }} naslov="Prosjek svih odjela" />
          )}
          {odjeliData.length > 0 && (
            <OdjeliTabela data={odjeliData} ukupnoDani={odjeliDani} year={year} mjesec={odjeliMjesec} sort={odjeliSort} onSort={setOdjeliSort} />
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
    <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
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
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 dark:bg-gray-800/60 border-t-2 border-gray-200 dark:border-gray-700">
            <td className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ukupno</td>
            {totalsPerMonth.map((n, i) => (
              <td key={i} className={`px-3 py-2.5 text-center tabular-nums text-sm font-bold ${n > 0 ? cfg.color : "text-gray-300 dark:text-gray-700"}`}>{n > 0 ? n : "·"}</td>
            ))}
            <td className={`px-4 py-2.5 text-center font-extrabold tabular-nums ${cfg.color}`}>
              {totalsPerMonth.reduce((a, b) => a + b, 0) || "·"}
            </td>
          </tr>
        </tfoot>
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
  const god = prosjeci(zbir(data));

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
            <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 min-w-[130px]">Mjesec</th>
            <th className="px-4 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-400 min-w-[90px]">Ha</th>
            <th className="px-4 py-3 text-right font-semibold text-green-700 dark:text-green-400 min-w-[90px]">Stabala</th>
            <th className="px-4 py-3 text-right font-semibold text-amber-700 dark:text-amber-400 min-w-[90px]">Km vlaka</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">ha / dan</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">st. / ha</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">km / dan</th>
            <th className="px-4 py-3 min-w-[140px]" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {data.map((m) => {
            const hasData = m.ha > 0 || m.stabala > 0 || m.km > 0;
            const pr = prosjeci(m);
            return (
              <tr key={m.mjesec} className={`transition-colors ${m.mjesec === currentMonth ? "bg-green-50/60 dark:bg-green-950/20" : "hover:bg-gray-50/60 dark:hover:bg-gray-800/30"}`}>
                <td className={`px-4 py-3 font-medium ${m.mjesec === currentMonth ? "text-green-700 dark:text-green-400 font-bold" : "text-gray-700 dark:text-gray-300"}`}>
                  {MJ_FULL[m.mjesec - 1]}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums font-mono text-sm ${m.ha > 0 ? "text-emerald-700 dark:text-emerald-300 font-semibold" : "text-gray-300 dark:text-gray-700"}`}>
                  {fmtHa(m.ha)}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums font-mono text-sm ${m.stabala > 0 ? "text-green-700 dark:text-green-300 font-semibold" : "text-gray-300 dark:text-gray-700"}`}>
                  {fmtSt(m.stabala)}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums font-mono text-sm ${m.km > 0 ? "text-amber-700 dark:text-amber-300 font-semibold" : "text-gray-300 dark:text-gray-700"}`}>
                  {fmtKm(m.km)}
                </td>
                <ProsjekTd v={fmtProsjek(pr.haDan)} />
                <ProsjekTd v={fmtProsjek(pr.stHa, 0)} />
                <ProsjekTd v={fmtProsjek(pr.kmDan)} />
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
            <td className="px-4 py-3 text-right tabular-nums font-extrabold text-emerald-700 dark:text-emerald-300 font-mono">{fmtHa(totalHa)}</td>
            <td className="px-4 py-3 text-right tabular-nums font-extrabold text-green-700 dark:text-green-300 font-mono">{fmtSt(totalStabala)}</td>
            <td className="px-4 py-3 text-right tabular-nums font-extrabold text-amber-700 dark:text-amber-300 font-mono">{fmtKm(totalKm)}</td>
            <ProsjekTd v={fmtProsjek(god.haDan)} jako />
            <ProsjekTd v={fmtProsjek(god.stHa, 0)} jako />
            <ProsjekTd v={fmtProsjek(god.kmDan)} jako />
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Usporedba tabela ─────────────────────────────────────────────────────────

function UporedbaTabela({ data, sortKey, year, mjesec }: {
  data: UporedbaRed[]; sortKey: SortKey; year: number; mjesec: number;
}) {
  const vr = (r: UporedbaRed) =>
    sortKey === "haDan" ? prosjeci(r).haDan : sortKey === "kmDan" ? prosjeci(r).kmDan : r[sortKey];
  const sorted   = [...data].sort((a, b) => vr(b) - vr(a));
  const tim      = prosjeci(zbir(data));
  const maxHa    = Math.max(...sorted.map((r) => r.ha), 0.01);
  const maxSt    = Math.max(...sorted.map((r) => r.stabala), 1);
  const maxKm    = Math.max(...sorted.map((r) => r.km), 0.01);
  const hasHa    = sorted.some((r) => r.ha > 0);
  const hasSt    = sorted.some((r) => r.stabala > 0);
  const hasKm    = sorted.some((r) => r.km > 0);
  const totalHa  = sorted.reduce((s, r) => s + r.ha, 0);
  const totalSt  = sorted.reduce((s, r) => s + r.stabala, 0);
  const totalKm  = sorted.reduce((s, r) => s + r.km, 0);
  const periodLabel = mjesec === 0 ? `${year}. godina` : `${MJ_FULL[mjesec - 1]} ${year}`;

  const medal = (idx: number, val: number) =>
    val <= 0 ? null : idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{periodLabel}</p>
      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
              <th className="px-3 py-3 text-center font-semibold text-gray-500 dark:text-gray-400 w-10">#</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 min-w-[150px]">Projektant</th>
              {hasHa && <th className="px-4 py-3 font-semibold text-emerald-700 dark:text-emerald-400 min-w-[160px]">Ha</th>}
              {hasSt && <th className="px-4 py-3 font-semibold text-green-700 dark:text-green-400 min-w-[160px]">Stabala</th>}
              {hasKm && <th className="px-4 py-3 font-semibold text-amber-700 dark:text-amber-400 min-w-[160px]">Km vlaka</th>}
              {hasHa && <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">ha / dan</th>}
              {hasSt && <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">st. / dan</th>}
              {hasKm && <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">km / dan</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {sorted.map((row, idx) => {
              const isEmpty = row.ha === 0 && row.stabala === 0 && row.km === 0;
              const m = medal(idx, vr(row));
              const pr = prosjeci(row);
              return (
                <tr key={row.radnikId} className={`transition-colors ${isEmpty ? "opacity-50" : "hover:bg-gray-50/60 dark:hover:bg-gray-800/30"}`}>
                  <td className="px-3 py-3 text-center text-sm font-bold tabular-nums text-gray-400 dark:text-gray-600">
                    {m ?? `${idx + 1}.`}
                  </td>
                  <td className={`px-4 py-3 font-semibold ${isEmpty ? "text-gray-400 dark:text-gray-600" : "text-gray-800 dark:text-gray-100"}`}>
                    {row.ime}
                  </td>
                  {hasHa && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-emerald-100 dark:bg-emerald-950 overflow-hidden min-w-[60px]">
                          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
                            style={{ width: `${maxHa > 0 ? (row.ha / maxHa) * 100 : 0}%` }} />
                        </div>
                        <span className="text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-300 w-14 text-right flex-shrink-0">
                          {fmtHa(row.ha)}
                        </span>
                      </div>
                    </td>
                  )}
                  {hasSt && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-green-100 dark:bg-green-950 overflow-hidden min-w-[60px]">
                          <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
                            style={{ width: `${maxSt > 0 ? (row.stabala / maxSt) * 100 : 0}%` }} />
                        </div>
                        <span className="text-xs font-mono tabular-nums text-green-700 dark:text-green-300 w-14 text-right flex-shrink-0">
                          {fmtSt(row.stabala)}
                        </span>
                      </div>
                    </td>
                  )}
                  {hasKm && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-amber-100 dark:bg-amber-950 overflow-hidden min-w-[60px]">
                          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-500"
                            style={{ width: `${maxKm > 0 ? (row.km / maxKm) * 100 : 0}%` }} />
                        </div>
                        <span className="text-xs font-mono tabular-nums text-amber-700 dark:text-amber-300 w-14 text-right flex-shrink-0">
                          {fmtKm(row.km)}
                        </span>
                      </div>
                    </td>
                  )}
                  {hasHa && <ProsjekTd v={fmtProsjek(pr.haDan)} iznad={pr.haDan > tim.haDan} />}
                  {hasSt && <ProsjekTd v={fmtProsjek(pr.stDan, 0)} iznad={pr.stDan > tim.stDan} />}
                  {hasKm && <ProsjekTd v={fmtProsjek(pr.kmDan)} iznad={pr.kmDan > tim.kmDan} />}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/60">
              <td className="px-3 py-2.5" />
              <td className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Ukupno · prosjek</td>
              {hasHa && (
                <td className="px-4 py-2.5">
                  <span className="text-xs font-extrabold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">{fmtHa(totalHa)}</span>
                </td>
              )}
              {hasSt && (
                <td className="px-4 py-2.5">
                  <span className="text-xs font-extrabold font-mono tabular-nums text-green-700 dark:text-green-300">{fmtSt(totalSt)}</span>
                </td>
              )}
              {hasKm && (
                <td className="px-4 py-2.5">
                  <span className="text-xs font-extrabold font-mono tabular-nums text-amber-700 dark:text-amber-300">{fmtKm(totalKm)}</span>
                </td>
              )}
              {hasHa && <ProsjekTd v={fmtProsjek(tim.haDan)} jako />}
              {hasSt && <ProsjekTd v={fmtProsjek(tim.stDan, 0)} jako />}
              {hasKm && <ProsjekTd v={fmtProsjek(tim.kmDan)} jako />}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Po odjelima tabela ───────────────────────────────────────────────────────

function sortOdjeli(data: OdjelStatistika[], key: OdjeliSort): OdjelStatistika[] {
  return [...data].sort((a, b) => {
    if (key === "gj") return `${a.gj}/${a.broj}`.localeCompare(`${b.gj}/${b.broj}`);
    if (key === "ha")      return b.totalHa - a.totalHa;
    if (key === "stabala") return b.totalStabala - a.totalStabala;
    return b.totalKm - a.totalKm;
  });
}

function SortTh({ label, col, active, onSort }: { label: string; col: OdjeliSort; active: boolean; onSort: (c: OdjeliSort) => void }) {
  return (
    <th onClick={() => onSort(col)} className={`px-3 py-3 text-right font-semibold cursor-pointer select-none transition-colors min-w-[80px] ${
      active ? "text-green-700 dark:text-green-400 underline underline-offset-2" : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
    }`}>
      {label}{active ? " ↓" : ""}
    </th>
  );
}

function OdjeliTabela({ data, ukupnoDani, year, mjesec, sort, onSort }: {
  data: OdjelStatistika[]; ukupnoDani: RadniDani; year: number; mjesec: number; sort: OdjeliSort; onSort: (s: OdjeliSort) => void;
}) {
  const sorted = sortOdjeli(data, sort);
  const totalHa = data.reduce((s, o) => s + o.totalHa, 0);
  const totalSt = data.reduce((s, o) => s + o.totalStabala, 0);
  const totalKm = data.reduce((s, o) => s + o.totalKm, 0);
  // dan rada u dva odjela je u ukupnom prosjeku jedan dan, zato ne zbir po odjelima
  const { dozDana: ukDozDana, vlDana: ukVlDana } = ukupnoDani;
  const hasHa = data.some((o) => o.totalHa > 0);
  const hasSt = data.some((o) => o.totalStabala > 0);
  const hasKm = data.some((o) => o.totalKm > 0);
  const periodLabel = mjesec === 0 ? `${year}. godina` : `${MJ_FULL[mjesec - 1]} ${year}`;

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{periodLabel} · {data.length} aktivnih odjela</p>
      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
              <th onClick={() => onSort("gj")} className={`text-left px-4 py-3 font-semibold cursor-pointer select-none min-w-[120px] transition-colors ${
                sort === "gj" ? "text-green-700 dark:text-green-400 underline underline-offset-2" : "text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
              }`}>
                GJ / Odj.{sort === "gj" ? " ↓" : ""}
              </th>
              {hasHa && <SortTh label="Ha" col="ha" active={sort === "ha"} onSort={onSort} />}
              {hasSt && <SortTh label="Stabala" col="stabala" active={sort === "stabala"} onSort={onSort} />}
              {hasKm && <SortTh label="Km vlaka" col="km" active={sort === "km"} onSort={onSort} />}
              {hasHa && <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">ha / dan</th>}
              {hasSt && <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">st. / ha</th>}
              {hasKm && <th className="px-3 py-3 text-right font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">km / dan</th>}
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 min-w-[160px]">Projektanti</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {sorted.map((o) => (
              <tr key={o.odjelId} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors group">
                <td className="px-4 py-2.5">
                  <Link href={`/odjel/?id=${encodeURIComponent(o.odjelId)}`}
                    className="font-semibold text-gray-800 dark:text-gray-100 group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors">
                    <span className="text-gray-500 dark:text-gray-400 font-normal text-xs">{o.gj}</span>
                    <span className="mx-1 text-gray-300 dark:text-gray-600">/</span>
                    <span>{o.broj}</span>
                  </Link>
                </td>
                {hasHa && (
                  <td className="px-3 py-2.5 text-right tabular-nums font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    {fmtHa(o.totalHa)}
                  </td>
                )}
                {hasSt && (
                  <td className="px-3 py-2.5 text-right tabular-nums font-mono text-xs font-semibold text-green-700 dark:text-green-300">
                    {fmtSt(o.totalStabala)}
                  </td>
                )}
                {hasKm && (
                  <td className="px-3 py-2.5 text-right tabular-nums font-mono text-xs font-semibold text-amber-700 dark:text-amber-300">
                    {fmtKm(o.totalKm)}
                  </td>
                )}
                {hasHa && <ProsjekTd v={fmtProsjek(podijeli(o.totalHa, o.dozDana))} />}
                {hasSt && <ProsjekTd v={fmtProsjek(podijeli(o.totalStabala, o.totalHa), 0)} />}
                {hasKm && <ProsjekTd v={fmtProsjek(podijeli(o.totalKm, o.vlDana))} />}
                <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                  {o.projektanti.map((p) => p.ime).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/60">
              <td className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Ukupno ({data.length})
              </td>
              {hasHa && (
                <td className="px-3 py-2.5 text-right tabular-nums font-extrabold font-mono text-emerald-700 dark:text-emerald-300">
                  {fmtHa(totalHa)}
                </td>
              )}
              {hasSt && (
                <td className="px-3 py-2.5 text-right tabular-nums font-extrabold font-mono text-green-700 dark:text-green-300">
                  {fmtSt(totalSt)}
                </td>
              )}
              {hasKm && (
                <td className="px-3 py-2.5 text-right tabular-nums font-extrabold font-mono text-amber-700 dark:text-amber-300">
                  {fmtKm(totalKm)}
                </td>
              )}
              {hasHa && <ProsjekTd v={fmtProsjek(podijeli(totalHa, ukDozDana))} jako />}
              {hasSt && <ProsjekTd v={fmtProsjek(podijeli(totalSt, totalHa), 0)} jako />}
              {hasKm && <ProsjekTd v={fmtProsjek(podijeli(totalKm, ukVlDana))} jako />}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ProsjekTd({ v, jako, iznad }: { v: string; jako?: boolean; iznad?: boolean }) {
  return (
    <td className={`px-3 py-2.5 text-right tabular-nums font-mono text-xs whitespace-nowrap ${
      jako ? "font-extrabold text-gray-800 dark:text-gray-100"
      : iznad ? "font-semibold text-green-700 dark:text-green-400"
      : v === "—" ? "text-gray-300 dark:text-gray-700" : "text-gray-600 dark:text-gray-300"
    }`} title={iznad ? "Iznad prosjeka tima" : undefined}>
      {v}
    </td>
  );
}

function MiniBar({ ratio, color, track }: { ratio: number; color: string; track: string }) {
  return (
    <div className={`h-1.5 rounded-full ${track} flex-1 max-w-[100px] overflow-hidden`}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}
