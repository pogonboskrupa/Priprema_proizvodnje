"use client";
import { useEffect, useState } from "react";
import { getOdjeli } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { Odjel } from "@/lib/types";

type RFilt = "sve" | "plan" | "u_toku" | "zavrseno";

function getStatus(o: Odjel): "plan" | "u_toku" | "zavrseno" {
  const plan = (o.plan_cet || 0) + (o.plan_lis || 0);
  const real = (o.real_cet || 0) + (o.real_lis || 0);
  if (real <= 0) return "plan";
  if (plan > 0 && real >= plan) return "zavrseno";
  return "u_toku";
}

export default function RealizacijaPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [odjeli, setOdjeli] = useState<Odjel[]>([]);
  const [filt, setFilt] = useState<RFilt>("sve");

  useEffect(() => {
    if (!loading && !session) router.replace("/login/");
    if (!loading && session?.role !== "admin") router.replace("/");
  }, [session, loading]);

  useEffect(() => { getOdjeli().then(setOdjeli); }, []);

  const filtered = filt === "sve" ? odjeli : odjeli.filter((o) => getStatus(o) === filt);

  const totPlan = odjeli.reduce((s, o) => s + (o.plan_cet || 0) + (o.plan_lis || 0), 0);
  const totReal = odjeli.reduce((s, o) => s + (o.real_cet || 0) + (o.real_lis || 0), 0);
  const pct = totPlan > 0 ? Math.min((totReal / totPlan) * 100, 100) : 0;

  const fmt = (n: number) => n > 0 ? n.toLocaleString("bs-BA") : "–";

  if (loading || !session) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Realizacija</h1>

      {/* Stat kartice */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Ukupni plan (m³)" value={fmt(totPlan)} color="blue" />
        <StatCard label="Realizovano (m³)" value={fmt(totReal)} color="green" />
        <StatCard label="Napredak" value={`${pct.toFixed(1)}%`} color={pct >= 80 ? "green" : "amber"} />
        <StatCard label="Završenih odjela" value={String(odjeli.filter(o => getStatus(o) === "zavrseno").length)} color="emerald" />
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(["sve", "plan", "u_toku", "zavrseno"] as RFilt[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilt(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filt === f ? "bg-green-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            }`}
          >
            {f === "sve" ? "Sve" : f === "plan" ? "📋 Plan" : f === "u_toku" ? "🔵 U toku" : "✅ Završeno"}
          </button>
        ))}
      </div>

      {/* Kartice po odjelu */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-12 text-gray-500">Nema rezultata.</div>
        )}
        {filtered.map((o) => {
          const plan = (o.plan_cet || 0) + (o.plan_lis || 0);
          const real = (o.real_cet || 0) + (o.real_lis || 0);
          const p = plan > 0 ? Math.min((real / plan) * 100, 100) : 0;
          const st = getStatus(o);

          return (
            <div key={o.id} className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-gray-800">{o.broj}</div>
                  <div className="text-xs text-gray-500">{o.gj}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  st === "zavrseno" ? "bg-green-100 text-green-700" :
                  st === "u_toku" ? "bg-blue-100 text-blue-700" :
                  "bg-gray-100 text-gray-500"
                }`}>
                  {st === "zavrseno" ? "✅ Završeno" : st === "u_toku" ? "🔵 U toku" : "📋 Plan"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 rounded p-2">
                  <div className="text-gray-500 mb-0.5">Plan m³ čet.</div>
                  <div className="font-semibold">{fmt(o.plan_cet || 0)}</div>
                </div>
                <div className="bg-green-50 rounded p-2">
                  <div className="text-gray-500 mb-0.5">Real. m³ čet.</div>
                  <div className="font-semibold text-green-700">{fmt(o.real_cet || 0)}</div>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <div className="text-gray-500 mb-0.5">Plan m³ liš.</div>
                  <div className="font-semibold">{fmt(o.plan_lis || 0)}</div>
                </div>
                <div className="bg-green-50 rounded p-2">
                  <div className="text-gray-500 mb-0.5">Real. m³ liš.</div>
                  <div className="font-semibold text-green-700">{fmt(o.real_lis || 0)}</div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Ukupni napredak</span>
                  <span className="font-mono">{p.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${p >= 100 ? "bg-green-500" : p >= 60 ? "bg-amber-500" : "bg-blue-500"}`}
                    style={{ width: `${p.toFixed(1)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: "blue" | "green" | "amber" | "emerald" }) {
  const cls = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
  }[color];
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="text-xs opacity-70 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
