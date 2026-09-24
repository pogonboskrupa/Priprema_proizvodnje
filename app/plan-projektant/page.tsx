"use client";
import { useEffect, useState } from "react";
import { getGodisnjePlanPoProjektantu, setPlanHa, type PlanProjektantRed } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { parseDecimal } from "@/lib/format";
import { godineEvidencije } from "@/lib/godine";

export default function PlanPoProjectantPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const isAdmin = session?.role === "admin";
  const isWorker = session?.role === "worker";

  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<PlanProjektantRed[]>([]);
  const [fetching, setFetching] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPlan, setEditPlan] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!loading && !session) router.replace("/login/");
  }, [session, loading]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setFetching(true);
    setErr("");
    getGodisnjePlanPoProjektantu(year)
      .then((data) => { if (!cancelled) setRows(data); })
      .catch(() => { if (!cancelled) setErr("Greška pri učitavanju plana."); })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, [session, year]);

  if (loading || !session) return null;

  const visibleRows = isWorker
    ? rows.filter((r) => r.korisnikId === session.userId)
    : rows;

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
    <div className="py-6">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mr-auto">Plan po projektantima</h1>
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
                              <div
                                className={`h-2 rounded-full transition-all ${barColor}`}
                                style={{ width: `${postotak}%` }}
                              />
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
                              <button
                                onClick={() => savePlan(r.korisnikId)}
                                disabled={saving}
                                className="text-xs text-green-600 dark:text-green-400 hover:underline disabled:opacity-50"
                              >
                                Sačuvaj
                              </button>
                              <button
                                onClick={() => setEditId(null)}
                                className="text-xs text-gray-400 hover:underline ml-1"
                              >
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
