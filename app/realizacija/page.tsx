"use client";
import { useEffect, useState } from "react";
import { getOdjeli, getUnosiOdjelPeriod } from "@/lib/db";
import type { OdjelPeriodRada } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { Odjel } from "@/lib/types";
import { VRSTA } from "@/lib/vrste";

type RFilt = "sve" | "plan" | "u_toku" | "zavrseno";

function getStatus(o: Odjel): "plan" | "u_toku" | "zavrseno" {
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
  const [odjeli, setOdjeli] = useState<Odjel[]>([]);
  const [periodi, setperiodi] = useState<Record<string, OdjelPeriodRada>>({});
  const [filt, setFilt] = useState<RFilt>("sve");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!loading && !session) router.replace("/login/");
    if (!loading && session?.role !== "admin") router.replace("/");
  }, [session, loading]);

  useEffect(() => {
    getOdjeli().then(setOdjeli).catch(() => setErr("Greška pri učitavanju odjela."));
    getUnosiOdjelPeriod().then((arr) => {
      const map: Record<string, OdjelPeriodRada> = {};
      arr.forEach((p) => { map[p.odjelId] = p; });
      setperiodi(map);
    }).catch(() => setErr("Greška pri učitavanju perioda rada."));
  }, []);

  const filtered = filt === "sve" ? odjeli : odjeli.filter((o) => getStatus(o) === filt);

  const totPlan = odjeli.reduce((s, o) => s + (o.plan_cet || 0) + (o.plan_lis || 0), 0);
  const totReal = odjeli.reduce((s, o) => s + (o.real_cet || 0) + (o.real_lis || 0), 0);
  const pct = totPlan > 0 ? Math.min((totReal / totPlan) * 100, 100) : 0;

  const fmt = (n: number) => n > 0 ? n.toLocaleString("bs-BA") : "–";

  if (loading || !session) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Realizacija</h1>

      {err && (
        <div className="mb-4 rounded-lg px-4 py-2.5 text-sm border bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          {err}
        </div>
      )}

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
              filt === f ? "bg-green-700 text-white" : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
            }`}
          >
            {f === "sve" ? "Sve" : f === "plan" ? "📋 Plan" : f === "u_toku" ? "🔵 U toku" : "✅ Završeno"}
          </button>
        ))}
      </div>

      {/* Kartice po odjelu */}
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

              {/* Period rada u odjelu */}
              {(period?.doznaka || period?.vlaka) && (
                <div className="border-t border-gray-100 dark:border-gray-800 pt-2.5 space-y-1.5">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Period rada u odjelu</div>
                  {period.doznaka && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${VRSTA.DOZNAKA.badge}`}>DOZNAKA</span>
                      <span className="text-gray-700 dark:text-gray-300 font-mono">
                        {fmtPeriodDate(period.doznaka.od)}
                        {period.doznaka.od !== period.doznaka.do_ && (
                          <> — {fmtPeriodDate(period.doznaka.do_)}</>
                        )}
                      </span>
                    </div>
                  )}
                  {period.vlaka && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${VRSTA.VLAKA.badge}`}>VLAKA</span>
                      <span className="text-gray-700 dark:text-gray-300 font-mono">
                        {fmtPeriodDate(period.vlaka.od)}
                        {period.vlaka.od !== period.vlaka.do_ && (
                          <> — {fmtPeriodDate(period.vlaka.do_)}</>
                        )}
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
