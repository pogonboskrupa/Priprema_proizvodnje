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
import { parseDecimal } from "@/lib/format";
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
  }, [session, loading]);

  if (loading || !session) return null;

  return (
    <div>
      {/* Tab header */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-200 dark:border-gray-800">
        {(["realizacija", "plan"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-green-600 text-green-700 dark:text-green-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {t === "realizacija" ? "Realizacija" : "Plan / projektant"}
          </button>
        ))}
      </div>

      {tab === "realizacija" ? (
        <RealizacijaTab session={session} />
      ) : (
        <PlanProjektantTab session={session} />
      )}
    </div>
  );
}

// ─── Realizacija tab ────────────────────────────────────────────────────────

function RealizacijaTab({ session }: { session: { role: string } }) {
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

  const filtered = filt === "sve" ? odjeli : odjeli.filter((o) => getStatus(o) === filt);

  const totPlan = odjeli.reduce((s, o) => s + (o.plan_cet || 0) + (o.plan_lis || 0), 0);
  const totReal = odjeli.reduce((s, o) => s + (o.real_cet || 0) + (o.real_lis || 0), 0);
  const pct = totPlan > 0 ? Math.min((totReal / totPlan) * 100, 100) : 0;

  const fmt = (n: number) => n > 0 ? n.toLocaleString("bs-BA") : "–";

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mr-auto">Realizacija {year}</h2>
        <div className="flex gap-1">
          {godineEvidencije().map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                year === y ? "bg-green-700 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-lg px-4 py-2.5 text-sm border bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          {err}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Ukupni plan (m³)" value={fmt(totPlan)} color="blue" />
        <StatCard label="Realizovano (m³)" value={fmt(totReal)} color="green" />
        <StatCard label="Napredak" value={`${pct.toFixed(1)}%`} color={pct >= 80 ? "green" : "amber"} />
        <StatCard label="Završenih odjela" value={String(odjeli.filter(o => getStatus(o) === "zavrseno").length)} color="emerald" />
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {(["sve", "plan", "u_toku", "zavrseno"] as RFilt[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilt(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filt === f ? "bg-green-700 text-white" : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
            }`}
          >
            {f === "sve" ? "Sve" : f === "plan" ? "📋 Plan" : f === "u_toku" ? "🔵 U toku" : "✅ Završeno"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-12 text-gray-500 dark:text-gray-400">Nema rezultata.</div>
        )}
        {filtered.map((o) => {
          const plan = (o.plan_cet || 0) + (o.plan_lis || 0);
          const real = (o.real_cet || 0) + (o.real_lis || 0);
          const p = plan > 0 ? Math.min((real / plan) * 100, 100) : 0;
          const st = getStatus(o);
          const period = periodi[o.id];

          return (
            <div key={o.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-gray-800 dark:text-gray-100">{o.gj} / {o.broj}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Površina: {fmt(o.povrsina || 0)} ha</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  st === "zavrseno" ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300" :
                  st === "u_toku" ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300" :
                  "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                }`}>
                  {st === "zavrseno" ? "✅ Završeno" : st === "u_toku" ? "🔵 U toku" : "📋 Plan"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 dark:bg-gray-800 rounded p-2">
                  <div className="text-gray-500 dark:text-gray-400 mb-0.5">Plan m³ čet.</div>
                  <div className="font-semibold">{fmt(o.plan_cet || 0)}</div>
                </div>
                <div className="bg-green-50 dark:bg-green-950 rounded p-2">
                  <div className="text-gray-500 dark:text-gray-400 mb-0.5">Real. m³ čet.</div>
                  <div className="font-semibold text-green-700 dark:text-green-400">{fmt(o.real_cet || 0)}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded p-2">
                  <div className="text-gray-500 dark:text-gray-400 mb-0.5">Plan m³ liš.</div>
                  <div className="font-semibold">{fmt(o.plan_lis || 0)}</div>
                </div>
                <div className="bg-green-50 dark:bg-green-950 rounded p-2">
                  <div className="text-gray-500 dark:text-gray-400 mb-0.5">Real. m³ liš.</div>
                  <div className="font-semibold text-green-700 dark:text-green-400">{fmt(o.real_lis || 0)}</div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>Ukupni napredak</span>
                  <span className="font-mono">{p.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${p >= 100 ? "bg-green-500" : p >= 60 ? "bg-amber-500" : "bg-blue-500"}`}
                    style={{ width: `${p.toFixed(1)}%` }}
                  />
                </div>
              </div>

              {(period?.doznaka || period?.vlaka) && (
                <div className="border-t border-gray-100 dark:border-gray-800 pt-2.5 space-y-1.5">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Period rada u odjelu</div>
                  {period.doznaka && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${VRSTA.DOZNAKA.badge}`}>DOZNAKA</span>
                      <span className="text-gray-700 dark:text-gray-300 font-mono">
                        {fmtPeriodDate(period.doznaka.od)}
                        {period.doznaka.od !== period.doznaka.do_ && <> — {fmtPeriodDate(period.doznaka.do_)}</>}
                      </span>
                    </div>
                  )}
                  {period.vlaka && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${VRSTA.VLAKA.badge}`}>VLAKA</span>
                      <span className="text-gray-700 dark:text-gray-300 font-mono">
                        {fmtPeriodDate(period.vlaka.od)}
                        {period.vlaka.od !== period.vlaka.do_ && <> — {fmtPeriodDate(period.vlaka.do_)}</>}
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

// ─── Plan/projektant tab ─────────────────────────────────────────────────────

function PlanProjektantTab({ session }: { session: { role: string; userId: string } }) {
  const isAdmin = session.role === "admin";
  const isWorker = session.role === "worker";

  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<PlanProjektantRed[]>([]);
  const [fetching, setFetching] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPlan, setEditPlan] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  useUnosiRefresh(() => setRefreshTick((t) => t + 1));

  useEffect(() => { setFetching(true); setErr(""); }, [year]);

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

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mr-auto">Plan po projektantima</h2>
        <select
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {err && (
        <div className="mb-4 rounded-lg px-4 py-2.5 text-sm border bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          {err}
        </div>
      )}

      {isAdmin && !fetching && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-green-50 dark:bg-green-950 border border-green-300 dark:border-green-800 rounded-xl p-4">
            <div className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">Plan ukupno</div>
            <div className="text-2xl font-bold tabular-nums text-green-900 dark:text-green-100">{totalPlan.toFixed(1)}</div>
            <div className="text-xs text-green-700 dark:text-green-300">ha</div>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800 rounded-xl p-4">
            <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-1">Odrađeno</div>
            <div className="text-2xl font-bold tabular-nums text-emerald-900 dark:text-emerald-100">{totalDone.toFixed(2)}</div>
            <div className="text-xs text-emerald-700 dark:text-emerald-300">ha</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-300 dark:border-blue-800 rounded-xl p-4">
            <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">Realizacija</div>
            <div className="text-2xl font-bold tabular-nums text-blue-900 dark:text-blue-100">
              {totalPlan > 0 ? Math.round((totalDone / totalPlan) * 100) : 0}%
            </div>
            <div className="text-xs text-blue-700 dark:text-blue-300">od plana</div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {fetching ? (
          <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">Učitavanje...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Projektant</th>
                  <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Odjeli ({year})</th>
                  <th className="text-right px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Plan (ha)</th>
                  <th className="text-right px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Odrađeno (ha)</th>
                  <th className="text-right px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Vlake (km)</th>
                  <th className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium text-left">Napredak</th>
                  {isAdmin && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-gray-400 dark:text-gray-500">
                      Nema podataka za {year}. godinu.
                    </td>
                  </tr>
                )}
                {visibleRows.map((r) => {
                  const postotak = r.planHa > 0 ? Math.min(Math.round((r.odradjeno / r.planHa) * 100), 100) : 0;
                  const postotakReal = r.planHa > 0 ? Math.round((r.odradjeno / r.planHa) * 100) : 0;
                  const barColor = postotakReal >= 100 ? "bg-green-500" : postotakReal >= 75 ? "bg-emerald-500" : postotakReal >= 50 ? "bg-amber-500" : "bg-red-400";
                  const isEditing = editId === r.korisnikId;

                  return (
                    <tr key={r.korisnikId} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {r.ime}
                        {r.arhiviran && <span className="ml-2 text-[10px] text-gray-400 dark:text-gray-500">(arhiviran)</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {r.odjeli.length ? r.odjeli.join(", ") : "–"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            autoFocus
                            className="w-20 text-right border border-green-400 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            value={editPlan}
                            onChange={(e) => setEditPlan(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") savePlan(r.korisnikId); if (e.key === "Escape") setEditId(null); }}
                          />
                        ) : (
                          <span className={`tabular-nums ${r.planHa === 0 ? "text-gray-400 dark:text-gray-500 italic" : "text-gray-800 dark:text-gray-200 font-medium"}`}>
                            {r.planHa === 0 ? "–" : r.planHa.toFixed(1)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-800 dark:text-gray-100">
                        {r.odradjeno.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">
                        {r.odradjenoKm > 0 ? r.odradjenoKm.toFixed(2) : "–"}
                      </td>
                      <td className="px-4 py-3">
                        {r.planHa > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 min-w-[60px]">
                              <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${postotak}%` }} />
                            </div>
                            <span className={`text-xs font-medium tabular-nums w-9 text-right ${postotakReal >= 100 ? "text-green-600 dark:text-green-400" : "text-gray-600 dark:text-gray-400"}`}>
                              {postotakReal}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">nema plana</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex gap-1">
                              <button onClick={() => savePlan(r.korisnikId)} disabled={saving} className="text-xs text-green-600 dark:text-green-400 hover:underline disabled:opacity-50">
                                Sačuvaj
                              </button>
                              <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:underline ml-1">
                                Otkaži
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditId(r.korisnikId); setEditPlan(String(r.planHa || "")); }}
                              className="text-xs text-blue-500 dark:text-blue-400 hover:underline"
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
            </table>
          </div>
        )}
      </div>

      {isAdmin && (
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          Kliknite &quot;Uredi plan&quot; da postavite cilj hektara za {year}. godinu — svaka godina ima svoj plan. Enter za potvrdu, Escape za odustajanje.
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: "blue" | "green" | "amber" | "emerald" }) {
  const styles = {
    blue:    { card: "bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-800",       label: "text-blue-800 dark:text-blue-200",    value: "text-blue-900 dark:text-blue-100" },
    green:   { card: "bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-800",   label: "text-green-800 dark:text-green-200",   value: "text-green-900 dark:text-green-100" },
    amber:   { card: "bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800",   label: "text-amber-900 dark:text-amber-200",   value: "text-amber-950 dark:text-amber-100" },
    emerald: { card: "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800", label: "text-emerald-800 dark:text-emerald-200", value: "text-emerald-900 dark:text-emerald-100" },
  }[color];
  return (
    <div className={`rounded-xl border p-4 ${styles.card}`}>
      <div className={`text-xs font-semibold mb-1 ${styles.label}`}>{label}</div>
      <div className={`text-2xl font-bold ${styles.value}`}>{value}</div>
    </div>
  );
}
