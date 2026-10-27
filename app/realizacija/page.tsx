"use client";
import { useEffect, useState } from "react";
import { getOdjeli, getUnosiOdjelPeriod, getGodisnjePlanPoProjektantu, setPlanHa } from "@/lib/db";
import type { OdjelPeriodRada, PlanProjektantRed } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { Odjel } from "@/lib/types";
import { VRSTA } from "@/lib/vrste";
import { godineEvidencije } from "@/lib/godine";
import { odjelZaGodinu, imaPodatke } from "@/lib/plan-sjece";
import type { OdjelGodina } from "@/lib/types";
import { parseDecimal, cmpOdjel } from "@/lib/format";
import { useUnosiRefresh } from "@/hooks/useUnosiRefresh";

type OdjelRed = Odjel & OdjelGodina;
type RFilt = "sve" | "plan" | "u_toku" | "zavrseno";
type Tab = "realizacija" | "plan";

function getStatus(o: OdjelRed): "plan" | "u_toku" | "zavrseno" {
  const plan = (o.plan_cet || 0) + (o.plan_lis || 0);
  const real = (o.real_cet || 0) + (o.real_lis || 0);
  if (real <= 0) return "plan";
  if (plan > 0 && real >= plan) return "zavrseno";
  return "u_toku";
}

const STATUS = {
  plan:     { label: "Plan",     dot: "bg-gray-400",   pill: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
  u_toku:   { label: "U toku",   dot: "bg-amber-500",  pill: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  zavrseno: { label: "Završeno", dot: "bg-green-600",  pill: "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300" },
} as const;

const fmtM3 = (n: number) => (n > 0 ? n.toLocaleString("bs-BA") : "–");

/** Tanka traka napretka; 100% je tamnozelena, ostalo mirno zeleno */
function Traka({ p, visina = "h-2", boja }: { p: number; visina?: string; boja?: string }) {
  return (
    <div className={`w-full ${visina} rounded-full bg-gray-200/80 dark:bg-gray-700/70 overflow-hidden`} role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all duration-500 ${boja ?? (p >= 100 ? "bg-green-700 dark:bg-green-500" : "bg-emerald-500 dark:bg-emerald-500/90")}`} style={{ width: `${p.toFixed(1)}%` }} />
    </div>
  );
}

function StatusPil({ st }: { st: keyof typeof STATUS }) {
  const c = STATUS[st];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full font-semibold ${c.pill}`}>
      <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function fmtPeriodDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

export default function RealizacijaPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("realizacija");

  useEffect(() => {
    if (!loading && !session) router.replace("/login/");
    if (!loading && session?.role !== "admin") router.replace("/");
  }, [session, loading, router]);

  if (loading || !session) return null;

  return (
    <div>
      <div className="flex items-center gap-1 mb-6 border-b border-gray-200 dark:border-gray-800" role="tablist">
        {(["realizacija", "plan"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-green-700 text-green-800 dark:border-green-400 dark:text-green-300"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            {t === "realizacija" ? "Realizacija" : "Plan / projektant"}
          </button>
        ))}
      </div>

      {tab === "realizacija" ? (
        <RealizacijaTab />
      ) : (
        <PlanProjektantTab session={session} />
      )}
    </div>
  );
}

// ─── Realizacija tab ────────────────────────────────────────────────────────

function RealizacijaTab() {
  const [sviOdjeli, setSviOdjeli] = useState<Odjel[]>([]);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [periodi, setperiodi] = useState<Record<string, OdjelPeriodRada>>({});
  const [filt, setFilt] = useState<RFilt>("sve");
  const [err, setErr] = useState("");

  useEffect(() => {
    getOdjeli({ ukljuciArhivirane: true }).then(setSviOdjeli).catch(() => setErr("Greška pri učitavanju odjela."));
  }, []);

  useEffect(() => {
    getUnosiOdjelPeriod(year).then((arr) => {
      const map: Record<string, OdjelPeriodRada> = {};
      arr.forEach((p) => { map[p.odjelId] = p; });
      setperiodi(map);
    }).catch(() => setErr("Greška pri učitavanju perioda rada."));
  }, [year]);

  const odjeli: OdjelRed[] = sviOdjeli
    .map((o) => ({ ...o, ...odjelZaGodinu(o, year) }))
    .filter((o) => !o.arhiviran || imaPodatke(o));

  const filtered = (filt === "sve" ? odjeli : odjeli.filter((o) => getStatus(o) === filt)).sort(cmpOdjel);

  const totPlan = odjeli.reduce((s, o) => s + (o.plan_cet || 0) + (o.plan_lis || 0), 0);
  const totReal = odjeli.reduce((s, o) => s + (o.real_cet || 0) + (o.real_lis || 0), 0);
  const pct = totPlan > 0 ? Math.min((totReal / totPlan) * 100, 100) : 0;
  const zavrseno = odjeli.filter((o) => getStatus(o) === "zavrseno").length;
  const brojPoStatusu = (f: RFilt) => (f === "sve" ? odjeli.length : odjeli.filter((o) => getStatus(o) === f).length);

  // grupe po GJ; filter već primijenjen, prazne GJ se ne prikazuju
  const grupe = new Map<string, OdjelRed[]>();
  for (const o of filtered) grupe.set(o.gj || "–", [...(grupe.get(o.gj || "–") ?? []), o]);

  return (
    <div className="space-y-6">
      <header className="flex items-end gap-3 flex-wrap">
        <div className="mr-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Realizacija {year}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{odjeli.length} odjela u {new Set(odjeli.map((o) => o.gj)).size} gospodarskih jedinica</p>
        </div>
        <div role="group" aria-label="Godina" className="inline-flex gap-0.5 p-1 rounded-xl bg-gray-100 dark:bg-gray-800">
          {godineEvidencije().map((y) => (
            <button
              key={y}
              aria-pressed={year === y}
              onClick={() => setYear(y)}
              className={`px-3.5 py-1 rounded-lg text-sm font-semibold transition-colors ${
                year === y ? "bg-green-700 text-white shadow-sm" : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </header>

      {err && (
        <div className="rounded-lg px-4 py-2.5 text-sm border bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          {err}
        </div>
      )}

      <section aria-label="Sažetak" className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm p-5 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] lg:items-center">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Napredak realizacije</div>
          <div className={`mt-1 text-4xl font-bold tabular-nums ${pct >= 100 ? "text-green-700 dark:text-green-400" : "text-gray-900 dark:text-gray-50"}`}>{pct.toFixed(1)}%</div>
          <div className="mt-2"><Traka p={pct} visina="h-2.5" /></div>
          <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Završeno <b className="text-gray-700 dark:text-gray-200">{zavrseno}</b> od {odjeli.length} odjela</div>
        </div>
        <Stat label="Ukupni plan" value={fmtM3(totPlan)} unit="m³" />
        <Stat label="Realizovano" value={fmtM3(totReal)} unit="m³" tone="text-green-700 dark:text-green-400" />
        <Stat label="Preostalo" value={fmtM3(Math.max(totPlan - totReal, 0))} unit="m³" />
      </section>

      <div role="group" aria-label="Status odjela" className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800">
        {(["sve", "plan", "u_toku", "zavrseno"] as RFilt[]).map((f) => (
          <button
            key={f}
            aria-pressed={filt === f}
            onClick={() => setFilt(f)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              filt === f ? "bg-white dark:bg-gray-900 text-green-800 dark:text-green-300 shadow-sm" : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            {f !== "sve" && <span aria-hidden className={`w-2 h-2 rounded-full ${STATUS[f].dot}`} />}
            {f === "sve" ? "Svi" : STATUS[f].label}
            <span className="text-xs tabular-nums opacity-60">{brojPoStatusu(f)}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-center py-12 text-gray-500 dark:text-gray-400 text-sm">Nema odjela u ovom prikazu.</div>
      )}

      {[...grupe.entries()].map(([gj, lista]) => {
        const gPlan = lista.reduce((s, o) => s + (o.plan_cet || 0) + (o.plan_lis || 0), 0);
        const gReal = lista.reduce((s, o) => s + (o.real_cet || 0) + (o.real_lis || 0), 0);
        const gPct = gPlan > 0 ? Math.min((gReal / gPlan) * 100, 100) : 0;
        return (
          <section key={gj} aria-label={`GJ ${gj}`} className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap border-b border-gray-200 dark:border-gray-800 pb-2">
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">GJ {gj}</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{lista.length} odjela</span>
              {gPlan > 0 && (
                <span className="ml-auto flex items-center gap-2 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                  {fmtM3(gReal)} / {fmtM3(gPlan)} m³
                  <span className="w-24"><Traka p={gPct} visina="h-1.5" /></span>
                  <b className="w-9 text-right text-gray-700 dark:text-gray-200">{gPct.toFixed(0)}%</b>
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {lista.map((o) => <OdjelKartica key={o.id} o={o} period={periodi[o.id]} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function VrstaRed({ label, plan, real, boja }: { label: string; plan: number; real: number; boja: string }) {
  const p = plan > 0 ? Math.min((real / plan) * 100, 100) : 0;
  const prazno = plan <= 0 && real <= 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-gray-600 dark:text-gray-300">{label}</span>
        {prazno
          ? <span className="text-gray-300 dark:text-gray-600">–</span>
          : <span className="tabular-nums text-gray-500 dark:text-gray-400"><b className="text-gray-900 dark:text-gray-100">{fmtM3(real)}</b> / {fmtM3(plan)} m³</span>}
      </div>
      {!prazno && <div className="mt-1"><Traka p={p} visina="h-1.5" boja={boja} /></div>}
    </div>
  );
}

function OdjelKartica({ o, period }: { o: OdjelRed; period?: OdjelPeriodRada }) {
  const plan = (o.plan_cet || 0) + (o.plan_lis || 0);
  const real = (o.real_cet || 0) + (o.real_lis || 0);
  const p = plan > 0 ? Math.min((real / plan) * 100, 100) : 0;
  const st = getStatus(o);
  return (
    <article className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden flex flex-col">
      <header className="flex items-start justify-between gap-2 px-4 pt-3.5">
        <div className="min-w-0">
          <div className="text-2xl font-extrabold font-mono tabular-nums leading-tight text-gray-900 dark:text-gray-50">{o.broj}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{(Number(o.povrsina) || 0).toFixed(2)} ha</div>
        </div>
        <StatusPil st={st} />
      </header>

      <div className="px-4 py-3 space-y-2.5">
        <VrstaRed label="Četinari" plan={o.plan_cet || 0} real={o.real_cet || 0} boja="bg-emerald-600" />
        <VrstaRed label="Lišćari" plan={o.plan_lis || 0} real={o.real_lis || 0} boja="bg-amber-700" />
      </div>

      <div className="mt-auto px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30">
        <div className="flex items-baseline justify-between text-xs mb-1.5">
          <span className="font-semibold text-gray-600 dark:text-gray-300">Ukupno</span>
          <span className="tabular-nums text-gray-500 dark:text-gray-400">
            <b className="text-gray-900 dark:text-gray-100">{fmtM3(real)}</b> / {fmtM3(plan)} m³ · <b className={p >= 100 ? "text-green-700 dark:text-green-400" : "text-gray-900 dark:text-gray-100"}>{p.toFixed(0)}%</b>
          </span>
        </div>
        <Traka p={p} />

        {(period?.doznaka || period?.vlaka) && (
          <dl className="mt-3 pt-2.5 border-t border-gray-200/70 dark:border-gray-700/70 space-y-1.5">
            {period.doznaka && (
              <div className="flex items-center gap-2 text-xs">
                <dt className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide ${VRSTA.DOZNAKA.badge}`}>DOZNAKA</dt>
                <dd className="font-mono tabular-nums text-gray-700 dark:text-gray-300">
                  {fmtPeriodDate(period.doznaka.od)}
                  {period.doznaka.od !== period.doznaka.do_ && <> – {fmtPeriodDate(period.doznaka.do_)}</>}
                </dd>
              </div>
            )}
            {period.vlaka && (
              <div className="flex items-center gap-2 text-xs">
                <dt className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide ${VRSTA.VLAKA.badge}`}>VLAKA</dt>
                <dd className="font-mono tabular-nums text-gray-700 dark:text-gray-300">
                  {fmtPeriodDate(period.vlaka.od)}
                  {period.vlaka.od !== period.vlaka.do_ && <> – {fmtPeriodDate(period.vlaka.do_)}</>}
                </dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </article>
  );
}

// ─── Plan/projektant tab ─────────────────────────────────────────────────────

function PlanProjektantTab({ session }: { session: { role: string; userId: string } }) {
  const isAdmin = session.role === "admin";
  const isWorker = session.role === "worker";

  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<PlanProjektantRed[]>([]);
  const [fetching, setFetching] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPlan, setEditPlan] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  useUnosiRefresh(() => setRefreshTick((t) => t + 1));

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    getGodisnjePlanPoProjektantu(year)
      .then((data) => { if (!cancelled) { setRows(data); setFetching(false); } })
      .catch(() => { if (!cancelled) { setErr("Greška pri učitavanju plana."); setFetching(false); } });
    return () => { cancelled = true; };
  }, [session, year, refreshTick]);

  const visibleRows = isWorker ? rows.filter((r) => r.korisnikId === session.userId) : rows;
  const totalPlan = rows.reduce((s, r) => s + r.planHa, 0);
  const totalDone = rows.reduce((s, r) => s + r.odradjeno, 0);

  async function savePlan(id: string) {
    const plan = parseDecimal(editPlan);
    if (plan !== null && Number.isNaN(plan)) { setErr("Neispravan plan (npr. 120,5)."); return; }
    setSaving(true);
    setErr("");
    try {
      await setPlanHa(id, year, plan ?? 0);
      setEditId(null);
      setRows(await getGodisnjePlanPoProjektantu(year));
    } catch {
      setErr("Greška pri snimanju plana.");
    } finally {
      setSaving(false);
    }
  }

  const years = godineEvidencije({ iSljedeca: true });
  const totalKm = rows.reduce((s, r) => s + r.odradjenoKm, 0);
  const totalPct = totalPlan > 0 ? (totalDone / totalPlan) * 100 : 0;
  const barColor = (pr: number) => (pr >= 100 ? "bg-green-700 dark:bg-green-500" : pr >= 75 ? "bg-emerald-500" : pr >= 50 ? "bg-amber-500" : "bg-orange-400");

  return (
    <div className="space-y-6">
      <header className="flex items-end gap-3 flex-wrap">
        <div className="mr-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Plan po projektantima</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Godišnji cilj u hektarima doznake i ostvareno</p>
        </div>
        <div role="group" aria-label="Godina" className="inline-flex gap-0.5 p-1 rounded-xl bg-gray-100 dark:bg-gray-800">
          {years.map((y) => (
            <button
              key={y}
              aria-pressed={year === y}
              onClick={() => { setYear(y); setFetching(true); setErr(""); }}
              className={`px-3.5 py-1 rounded-lg text-sm font-semibold transition-colors ${
                year === y ? "bg-green-700 text-white shadow-sm" : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </header>

      {err && (
        <div className="rounded-lg px-4 py-2.5 text-sm border bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          {err}
        </div>
      )}

      {isAdmin && !fetching && (
        <section aria-label="Sažetak" className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm p-5 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] lg:items-center">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Realizacija plana</div>
            <div className={`mt-1 text-4xl font-bold tabular-nums ${totalPct >= 100 ? "text-green-700 dark:text-green-400" : "text-gray-900 dark:text-gray-50"}`}>{totalPlan > 0 ? Math.round(totalPct) : 0}%</div>
            <div className="mt-2"><Traka p={Math.min(totalPct, 100)} visina="h-2.5" /></div>
          </div>
          <Stat label="Plan ukupno" value={totalPlan.toFixed(1)} unit="ha" />
          <Stat label="Odrađeno" value={totalDone.toFixed(2)} unit="ha" tone="text-green-700 dark:text-green-400" />
          <Stat label="Vlake" value={totalKm.toFixed(2)} unit="km" tone="text-amber-700 dark:text-amber-400" />
        </section>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {fetching ? (
          <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">Učitavanje...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/70 border-b border-gray-200 dark:border-gray-700">
                <tr className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="text-left px-4 py-3 font-bold">Projektant</th>
                  <th className="text-left px-4 py-3 font-bold">Odjeli ({year})</th>
                  <th className="text-right px-4 py-3 font-bold">Plan ha</th>
                  <th className="text-right px-4 py-3 font-bold">Odrađeno ha</th>
                  <th className="text-right px-4 py-3 font-bold">Vlake km</th>
                  <th className="px-4 py-3 font-bold text-left min-w-[170px]">Napredak</th>
                  {isAdmin && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400 dark:text-gray-500">
                      Nema podataka za {year}. godinu.
                    </td>
                  </tr>
                )}
                {visibleRows.map((r) => {
                  const postotakReal = r.planHa > 0 ? Math.round((r.odradjeno / r.planHa) * 100) : 0;
                  const isEditing = editId === r.korisnikId;

                  return (
                    <tr key={r.korisnikId} className="group border-t border-gray-100 dark:border-gray-800 hover:bg-green-50/40 dark:hover:bg-green-950/10 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {r.ime}
                        {r.arhiviran && <span className="ml-2 text-[10px] font-medium text-gray-400 dark:text-gray-500">(arhiviran)</span>}
                      </td>
                      <td className="px-4 py-3">
                        {r.odjeli.length ? (
                          <div className="flex flex-wrap gap-1">
                            {r.odjeli.map((od) => (
                              <span key={od} className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[11px] font-mono text-gray-600 dark:text-gray-300">{od}</span>
                            ))}
                          </div>
                        ) : <span className="text-gray-300 dark:text-gray-600">–</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            autoFocus
                            aria-label={`Plan ha za ${r.ime}`}
                            className="w-24 text-right border border-green-500 rounded-md px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500/40"
                            value={editPlan}
                            onChange={(e) => setEditPlan(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") savePlan(r.korisnikId); if (e.key === "Escape") setEditId(null); }}
                          />
                        ) : (
                          <span className={`tabular-nums ${r.planHa === 0 ? "text-gray-300 dark:text-gray-600" : "text-gray-800 dark:text-gray-200 font-medium"}`}>
                            {r.planHa === 0 ? "–" : r.planHa.toFixed(1)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-green-700 dark:text-green-400">
                        {r.odradjeno.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-700 dark:text-amber-400">
                        {r.odradjenoKm > 0 ? r.odradjenoKm.toFixed(2) : <span className="text-gray-300 dark:text-gray-600">–</span>}
                      </td>
                      <td className="px-4 py-3">
                        {r.planHa > 0 ? (
                          <div className="flex items-center gap-2.5">
                            <div className="flex-1 min-w-[70px]"><Traka p={Math.min(postotakReal, 100)} boja={barColor(postotakReal)} /></div>
                            <span className={`text-xs font-bold tabular-nums w-10 text-right ${postotakReal >= 100 ? "text-green-700 dark:text-green-400" : "text-gray-600 dark:text-gray-400"}`}>
                              {postotakReal}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">nema plana</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {isEditing ? (
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => savePlan(r.korisnikId)} disabled={saving} className="px-2.5 py-1 rounded-md bg-green-700 text-white text-xs font-semibold hover:bg-green-800 disabled:opacity-50">
                                {saving ? "..." : "Sačuvaj"}
                              </button>
                              <button onClick={() => setEditId(null)} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">
                                Otkaži
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditId(r.korisnikId); setEditPlan(String(r.planHa || "")); }}
                              className="text-xs font-medium text-green-700 dark:text-green-400 px-2 py-1 rounded-md border border-transparent hover:border-gray-200 dark:hover:border-gray-700 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                            >
                              Uredi plan
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              {isAdmin && visibleRows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/70 font-bold">
                    <td className="px-4 py-3 text-xs uppercase tracking-wider text-gray-600 dark:text-gray-300" colSpan={2}>Ukupno ({visibleRows.length})</td>
                    <td className="px-4 py-3 text-right tabular-nums">{totalPlan.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-700 dark:text-green-400">{totalDone.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-700 dark:text-amber-400">{totalKm.toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs tabular-nums text-gray-600 dark:text-gray-300">{totalPlan > 0 ? `${Math.round(totalPct)}% od plana` : "–"}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {isAdmin && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          „Uredi plan“ postavlja cilj hektara za {year}. godinu — svaka godina ima svoj plan. Enter potvrđuje, Escape odustaje.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, unit, tone = "text-gray-900 dark:text-gray-50" }: { label: string; value: string; unit?: string; tone?: string }) {
  return (
    <div className="lg:border-l lg:border-gray-200 lg:dark:border-gray-700 lg:pl-5">
      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-gray-400 dark:text-gray-500">{unit}</span>}
      </div>
    </div>
  );
}
