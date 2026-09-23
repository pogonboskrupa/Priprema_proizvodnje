"use client";
import { useEffect, useState } from "react";
import { getGodisnjePlanPoInzinjeru, updateInzinjer, getInzinjerByKorisnikId } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

type Row = {
  inzinjer: { id: string; ime: string; prezime: string; odjel?: { gj?: string; broj?: string } };
  planHa: number;
  odradjeno: number;
  odradjenoKm: number;
};

export default function PlanPoProjectantPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const isAdmin = session?.role === "admin";
  const isWorker = session?.role === "worker";

  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<Row[]>([]);
  const [fetching, setFetching] = useState(false);
  const [myInzinjerId, setMyInzinjerId] = useState<string | null>(null);
  const [myInzinjerLoaded, setMyInzinjerLoaded] = useState(!isWorker);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPlan, setEditPlan] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !session) router.replace("/login/");
  }, [session, loading]);

  useEffect(() => {
    if (!session || !isWorker) return;
    getInzinjerByKorisnikId(session.userId).then((inz) => {
      setMyInzinjerId(inz?.id ?? null);
      setMyInzinjerLoaded(true);
    });
  }, [session]);

  useEffect(() => {
    if (!session) return;
    setFetching(true);
    getGodisnjePlanPoInzinjeru(year)
      .then((data) => setRows(data as Row[]))
      .finally(() => setFetching(false));
  }, [session, year]);

  if (loading || !session || !myInzinjerLoaded) return null;

  const visibleRows = isWorker
    ? rows.filter((r) => r.inzinjer.id === myInzinjerId)
    : rows;

  const totalPlan = rows.reduce((s, r) => s + r.planHa, 0);
  const totalDone = rows.reduce((s, r) => s + r.odradjeno, 0);

  async function savePlan(id: string) {
    setSaving(true);
    await updateInzinjer(id, { planHa: Number(editPlan.replace(",", ".")) || 0 });
    setEditId(null);
    setSaving(false);
    const data = await getGodisnjePlanPoInzinjeru(year);
    setRows(data as Row[]);
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

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
                  <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Odjel</th>
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
                  const isEditing = editId === r.inzinjer.id;

                  return (
                    <tr key={r.inzinjer.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {r.inzinjer.prezime} {r.inzinjer.ime}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {r.inzinjer.odjel?.gj}/{r.inzinjer.odjel?.broj}
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
                            onKeyDown={(e) => { if (e.key === "Enter") savePlan(r.inzinjer.id); if (e.key === "Escape") setEditId(null); }}
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
                                onClick={() => savePlan(r.inzinjer.id)}
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
                              onClick={() => { setEditId(r.inzinjer.id); setEditPlan(String(r.planHa || "")); }}
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
          Kliknite "Uredi plan" da postavite godišnji cilj hektara po projektantu. Enter za potvrdu, Escape za odustajanje.
        </p>
      )}
    </div>
  );
}
