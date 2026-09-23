"use client";
import { useEffect, useState } from "react";
import { getOdjeli, updateOdjel } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { Odjel } from "@/lib/types";

export default function PlanPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [odjeli, setOdjeli] = useState<Odjel[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ plan_cet: "", plan_lis: "", real_cet: "", real_lis: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !session) router.replace("/login/");
    if (!loading && session?.role !== "admin") router.replace("/");
  }, [session, loading]);

  useEffect(() => { loadOdjeli(); }, []);

  async function loadOdjeli() {
    setOdjeli(await getOdjeli());
  }

  function startEdit(o: Odjel) {
    setEditId(o.id);
    setForm({
      plan_cet: String(o.plan_cet || ""),
      plan_lis: String(o.plan_lis || ""),
      real_cet: String(o.real_cet || ""),
      real_lis: String(o.real_lis || ""),
    });
  }

  async function saveEdit() {
    if (!editId) return;
    setSaving(true);
    await updateOdjel(editId, {
      plan_cet: Number(form.plan_cet.replace(",", ".")) || 0,
      plan_lis: Number(form.plan_lis.replace(",", ".")) || 0,
      real_cet: Number(form.real_cet.replace(",", ".")) || 0,
      real_lis: Number(form.real_lis.replace(",", ".")) || 0,
    });
    setEditId(null);
    setSaving(false);
    loadOdjeli();
  }

  const totPlanCet = odjeli.reduce((s, o) => s + (o.plan_cet || 0), 0);
  const totPlanLis = odjeli.reduce((s, o) => s + (o.plan_lis || 0), 0);
  const totRealCet = odjeli.reduce((s, o) => s + (o.real_cet || 0), 0);
  const totRealLis = odjeli.reduce((s, o) => s + (o.real_lis || 0), 0);
  const totPlan = totPlanCet + totPlanLis;
  const totReal = totRealCet + totRealLis;
  const pct = totPlan > 0 ? Math.min((totReal / totPlan) * 100, 100) : 0;

  const fmt = (n: number) => n > 0 ? n.toLocaleString("bs-BA") : "–";

  if (loading || !session) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Plan sječe 2026</h1>

      {/* Godišnji summary */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 mb-6">
        <div className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">Ukupni plan doznake 2026</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatBox label="Plan m³ četinara" value={`${fmt(totPlanCet)} m³`} color="blue" />
          <StatBox label="Real. m³ četinara" value={`${fmt(totRealCet)} m³`} color="green" />
          <StatBox label="Plan m³ lišćara" value={`${fmt(totPlanLis)} m³`} color="blue" />
          <StatBox label="Real. m³ lišćara" value={`${fmt(totRealLis)} m³`} color="green" />
        </div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>Godišnji napredak (m³ ukupno)</span>
          <span className="font-mono font-semibold">{pct.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${pct >= 100 ? "bg-green-500" : pct >= 60 ? "bg-amber-500" : "bg-blue-500"}`}
            style={{ width: `${pct.toFixed(1)}%` }}
          />
        </div>
      </div>

      {/* Tabela odjela */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-200">
          Plan po odjelima
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Br.</th>
                <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">GJ</th>
                <th className="text-right px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Ha</th>
                <th className="text-right px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Plan m³ čet.</th>
                <th className="text-right px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Plan m³ liš.</th>
                <th className="text-right px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Real. m³ čet.</th>
                <th className="text-right px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Real. m³ liš.</th>
                <th className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Napredak</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {odjeli.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-gray-500 dark:text-gray-400">Nema odjela.</td></tr>
              )}
              {odjeli.map((o) => {
                const plan = (o.plan_cet || 0) + (o.plan_lis || 0);
                const real = (o.real_cet || 0) + (o.real_lis || 0);
                const p = plan > 0 ? Math.min((real / plan) * 100, 100) : 0;
                const isEditing = editId === o.id;

                return (
                  <tr key={o.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 font-mono font-semibold">{o.broj}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{o.gj}</td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{o.povrsina?.toFixed(2)}</td>

                    {isEditing ? (
                      <>
                        {(["plan_cet","plan_lis","real_cet","real_lis"] as const).map((f) => (
                          <td key={f} className="px-2 py-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              className="w-24 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-right text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                              value={form[f]}
                              onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                            />
                          </td>
                        ))}
                        <td className="px-4 py-3">–</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={saveEdit} disabled={saving} className="text-green-700 dark:text-green-400 text-xs font-medium hover:underline mr-2">
                            {saving ? "..." : "Sačuvaj"}
                          </button>
                          <button onClick={() => setEditId(null)} className="text-gray-500 dark:text-gray-400 text-xs hover:underline">Odustani</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-right">{fmt(o.plan_cet || 0)}</td>
                        <td className="px-4 py-3 text-right">{fmt(o.plan_lis || 0)}</td>
                        <td className="px-4 py-3 text-right text-green-700 dark:text-green-400 font-semibold">{fmt(o.real_cet || 0)}</td>
                        <td className="px-4 py-3 text-right text-green-700 dark:text-green-400 font-semibold">{fmt(o.real_lis || 0)}</td>
                        <td className="px-4 py-3 min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${p >= 100 ? "bg-green-500" : p >= 60 ? "bg-amber-500" : "bg-blue-500"}`}
                                style={{ width: `${p.toFixed(1)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right">{p.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => startEdit(o)} className="text-blue-600 dark:text-blue-400 hover:underline text-xs">Uredi</button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: "blue" | "green" }) {
  const styles = color === "green"
    ? { card: "bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-800", label: "text-green-800 dark:text-green-200", value: "text-green-900 dark:text-green-100" }
    : { card: "bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-800",  label: "text-blue-800 dark:text-blue-200",  value: "text-blue-900 dark:text-blue-100" };
  return (
    <div className={`rounded-lg border p-3 ${styles.card}`}>
      <div className={`text-xs font-semibold mb-1 ${styles.label}`}>{label}</div>
      <div className={`text-lg font-bold ${styles.value}`}>{value}</div>
    </div>
  );
}
