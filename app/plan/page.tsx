"use client";
import { useEffect, useState } from "react";
import { getOdjeli, updateOdjel } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { Odjel } from "@/lib/types";

// Forest palette — one accent per GJ group (cycling)
const GJ_PALETTE = [
  { accent: "#2d6a4f", bg: "rgba(45,106,79,0.07)",  border: "rgba(45,106,79,0.25)",  header: "rgba(45,106,79,0.13)" },
  { accent: "#7b4f2e", bg: "rgba(123,79,46,0.07)",  border: "rgba(123,79,46,0.25)", header: "rgba(123,79,46,0.13)" },
  { accent: "#1b4332", bg: "rgba(27,67,50,0.08)",   border: "rgba(27,67,50,0.25)",  header: "rgba(27,67,50,0.13)"  },
  { accent: "#606c38", bg: "rgba(96,108,56,0.08)",  border: "rgba(96,108,56,0.25)", header: "rgba(96,108,56,0.13)" },
  { accent: "#52796f", bg: "rgba(82,121,111,0.08)", border: "rgba(82,121,111,0.25)",header: "rgba(82,121,111,0.13)"},
  { accent: "#9b6a2f", bg: "rgba(155,106,47,0.07)", border: "rgba(155,106,47,0.25)",header: "rgba(155,106,47,0.13)"},
];

type FormFields = { povrsina: string; plan_cet: string; plan_lis: string; real_cet: string; real_lis: string };
type GjGroup = { gj: string; odjeli: Odjel[]; color: typeof GJ_PALETTE[number] };

function groupByGj(odjeli: Odjel[]): GjGroup[] {
  const map = new Map<string, Odjel[]>();
  for (const o of odjeli) {
    const k = o.gj || "–";
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(o);
  }
  let idx = 0;
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([gj, odjeli]) => ({ gj, odjeli, color: GJ_PALETTE[idx++ % GJ_PALETTE.length] }));
}

function Progress({ value, color }: { value: number; color: string }) {
  const w = Math.min(value, 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 100 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--track)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${w}%`, borderRadius: 3, background: color, transition: "width .4s ease" }} />
      </div>
      <span style={{ fontSize: 11, color: "var(--muted)", width: 34, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{value.toFixed(0)}%</span>
    </div>
  );
}

export default function PlanPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [odjeli, setOdjeli] = useState<Odjel[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormFields>({ povrsina: "", plan_cet: "", plan_lis: "", real_cet: "", real_lis: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !session) router.replace("/login/");
    if (!loading && session?.role !== "admin") router.replace("/");
  }, [session, loading]);

  useEffect(() => { loadOdjeli(); }, []);

  async function loadOdjeli() { setOdjeli(await getOdjeli()); }

  function startEdit(o: Odjel) {
    setEditId(o.id);
    setForm({ povrsina: String(o.povrsina || ""), plan_cet: String(o.plan_cet || ""), plan_lis: String(o.plan_lis || ""), real_cet: String(o.real_cet || ""), real_lis: String(o.real_lis || "") });
  }

  async function saveEdit() {
    if (!editId) return;
    setSaving(true);
    await updateOdjel(editId, {
      povrsina: parseFloat(form.povrsina.replace(",", ".")) || 0,
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
  const groups = groupByGj(odjeli);

  const fmt = (n: number) => n > 0 ? n.toLocaleString("bs-BA") : "–";
  const fmtN = (n: number) => n.toLocaleString("bs-BA");

  if (loading || !session) return null;

  return (
    <>
      <style>{`
        .plan-wrap {
          font-family: 'Inter', system-ui, sans-serif;
        }
        .plan-wrap .baskerville {
          font-family: var(--font-baskerville, 'Libre Baskerville', Georgia, serif);
        }
        :root {
          --surface: #ffffff;
          --ground: #f0f4ee;
          --border: #dce5d8;
          --track: #dde5d9;
          --text: #1a2b1c;
          --muted: #5a6b5c;
          --input-bg: #ffffff;
          --input-border: #b8c9b2;
          --th-bg: #e8efe4;
          --th-text: #3a4e3c;
          --row-hover: rgba(45,106,79,0.04);
        }
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) {
            --surface: #111c12;
            --ground: #0c1509;
            --border: #253127;
            --track: #1e2e1f;
            --text: #daecd3;
            --muted: #7fa882;
            --input-bg: #182119;
            --input-border: #354d37;
            --th-bg: #162018;
            --th-text: #99bb9a;
            --row-hover: rgba(45,106,79,0.08);
          }
        }
        :root[data-theme="dark"] {
          --surface: #111c12;
          --ground: #0c1509;
          --border: #253127;
          --track: #1e2e1f;
          --text: #daecd3;
          --muted: #7fa882;
          --input-bg: #182119;
          --input-border: #354d37;
          --th-bg: #162018;
          --th-text: #99bb9a;
          --row-hover: rgba(45,106,79,0.08);
        }
        .plan-wrap table { width: 100%; border-collapse: collapse; }
        .plan-wrap th { background: var(--th-bg); color: var(--th-text); font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; padding: 10px 14px; white-space: nowrap; }
        .plan-wrap th:first-child { border-radius: 0; }
        .plan-wrap td { padding: 9px 14px; font-size: 13px; color: var(--text); border-bottom: 1px solid var(--border); vertical-align: middle; }
        .plan-wrap tr:last-child td { border-bottom: none; }
        .plan-wrap tr.data-row:hover td { background: var(--row-hover); }
        .plan-wrap .gj-header td { border-bottom: none; padding: 12px 14px 10px; }
        .plan-wrap input[type="text"] {
          border: 1px solid var(--input-border);
          background: var(--input-bg);
          color: var(--text);
          border-radius: 5px;
          padding: 4px 8px;
          font-size: 13px;
          text-align: right;
          width: 80px;
          outline: none;
        }
        .plan-wrap input[type="text"]:focus { border-color: #2d6a4f; box-shadow: 0 0 0 2px rgba(45,106,79,.18); }
        .btn-save { background: #2d6a4f; color: #fff; border: none; border-radius: 5px; padding: 4px 12px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .btn-save:hover { background: #245940; }
        .btn-cancel { background: none; border: none; color: var(--muted); font-size: 12px; cursor: pointer; padding: 4px 8px; }
        .btn-cancel:hover { color: var(--text); }
        .btn-edit { background: none; border: none; color: var(--muted); font-size: 12px; cursor: pointer; padding: 4px 0; opacity: 0; transition: opacity .15s; }
        tr.data-row:hover .btn-edit { opacity: 1; }
        .btn-edit:hover { color: #2d6a4f; }
        .chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; letter-spacing: .03em; white-space: nowrap; }
      `}</style>

      <div className="plan-wrap" style={{ color: "var(--text)" }}>

        {/* Header */}
        <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="baskerville" style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", lineHeight: 1.15, textWrap: "balance" }}>
              Plan sječe 2026
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>
              {groups.length} gospodarska jedinica · {odjeli.length} odjela
            </div>
          </div>
        </div>

        {/* Summary strip */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, marginBottom: 16 }}>
            <SummaryTile label="Plan četinari" value={`${fmtN(totPlanCet)} m³`} sub="plan" color="#2d6a4f" />
            <SummaryTile label="Real. četinari" value={`${fmtN(totRealCet)} m³`} sub="realizacija" color="#2d6a4f" real />
            <SummaryTile label="Plan lišćari" value={`${fmtN(totPlanLis)} m³`} sub="plan" color="#7b4f2e" />
            <SummaryTile label="Real. lišćari" value={`${fmtN(totRealLis)} m³`} sub="realizacija" color="#7b4f2e" real />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
            <span style={{ color: "var(--muted)", fontWeight: 500 }}>Godišnji napredak — ukupno m³</span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "var(--text)", fontSize: 13 }}>{fmt(totReal)} / {fmt(totPlan)}</span>
          </div>
          <div style={{ background: "var(--track)", borderRadius: 4, height: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct.toFixed(1)}%`, background: pct >= 100 ? "#2d6a4f" : pct >= 60 ? "#9b6a2f" : "#52796f", borderRadius: 4, transition: "width .6s ease" }} />
          </div>
          <div style={{ marginTop: 5, fontSize: 12, color: "var(--muted)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{pct.toFixed(1)}%</div>
        </div>

        {/* Grouped table */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", width: 52 }}>Br.</th>
                  <th style={{ textAlign: "right" }}>Ha</th>
                  <th style={{ textAlign: "right" }}>Plan čet. m³</th>
                  <th style={{ textAlign: "right" }}>Plan liš. m³</th>
                  <th style={{ textAlign: "right" }}>Real. čet. m³</th>
                  <th style={{ textAlign: "right" }}>Real. liš. m³</th>
                  <th style={{ textAlign: "left", minWidth: 140 }}>Napredak</th>
                  <th style={{ width: 90 }}></th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)" }}>Nema odjela.</td></tr>
                )}
                {groups.map(({ gj, odjeli: gjOdjeli, color }) => {
                  const gjPlanCet = gjOdjeli.reduce((s, o) => s + (o.plan_cet || 0), 0);
                  const gjPlanLis = gjOdjeli.reduce((s, o) => s + (o.plan_lis || 0), 0);
                  const gjRealCet = gjOdjeli.reduce((s, o) => s + (o.real_cet || 0), 0);
                  const gjRealLis = gjOdjeli.reduce((s, o) => s + (o.real_lis || 0), 0);
                  const gjPlan = gjPlanCet + gjPlanLis;
                  const gjReal = gjRealCet + gjRealLis;
                  const gjPct = gjPlan > 0 ? Math.min((gjReal / gjPlan) * 100, 100) : 0;

                  return [
                    // GJ header row
                    <tr key={`gj-${gj}`} className="gj-header" style={{ background: color.header }}>
                      <td colSpan={8} style={{ borderLeft: `4px solid ${color.accent}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                          <div className="baskerville" style={{ fontWeight: 700, fontSize: 14, color: color.accent, letterSpacing: ".01em" }}>
                            GJ {gj}
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <span className="chip" style={{ background: "rgba(0,0,0,.06)", color: "var(--muted)" }}>
                              {gjOdjeli.length} odjela
                            </span>
                            {gjPlan > 0 && (
                              <span className="chip" style={{ background: "rgba(0,0,0,.06)", color: "var(--muted)" }}>
                                {fmt(gjReal)} / {fmt(gjPlan)} m³
                              </span>
                            )}
                            {gjPlan > 0 && (
                              <span className="chip" style={{ background: color.header, color: color.accent, outline: `1px solid ${color.border}` }}>
                                {gjPct.toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>,
                    // Odjel rows
                    ...gjOdjeli.map((o) => {
                      const plan = (o.plan_cet || 0) + (o.plan_lis || 0);
                      const real = (o.real_cet || 0) + (o.real_lis || 0);
                      const p = plan > 0 ? Math.min((real / plan) * 100, 100) : 0;
                      const isEditing = editId === o.id;

                      return (
                        <tr key={o.id} className="data-row" style={{ borderLeft: `3px solid ${color.border}` }}>
                          <td>
                            <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{o.broj}</span>
                          </td>
                          {isEditing ? (
                            <>
                              <td><input type="text" inputMode="decimal" value={form.povrsina} onChange={(e) => setForm({ ...form, povrsina: e.target.value })} style={{ width: 72 }} /></td>
                              <td><input type="text" inputMode="decimal" value={form.plan_cet} onChange={(e) => setForm({ ...form, plan_cet: e.target.value })} /></td>
                              <td><input type="text" inputMode="decimal" value={form.plan_lis} onChange={(e) => setForm({ ...form, plan_lis: e.target.value })} /></td>
                              <td><input type="text" inputMode="decimal" value={form.real_cet} onChange={(e) => setForm({ ...form, real_cet: e.target.value })} /></td>
                              <td><input type="text" inputMode="decimal" value={form.real_lis} onChange={(e) => setForm({ ...form, real_lis: e.target.value })} /></td>
                              <td style={{ color: "var(--muted)" }}>–</td>
                              <td>
                                <div style={{ display: "flex", gap: 4 }}>
                                  <button className="btn-save" onClick={saveEdit} disabled={saving}>{saving ? "..." : "Sačuvaj"}</button>
                                  <button className="btn-cancel" onClick={() => setEditId(null)}>Odustani</button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ textAlign: "right", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{o.povrsina?.toFixed(2) ?? "–"}</td>
                              <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(o.plan_cet || 0)}</td>
                              <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(o.plan_lis || 0)}</td>
                              <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: color.accent }}>{fmt(o.real_cet || 0)}</td>
                              <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: color.accent }}>{fmt(o.real_lis || 0)}</td>
                              <td><Progress value={p} color={color.accent} /></td>
                              <td style={{ textAlign: "right" }}>
                                <button className="btn-edit" onClick={() => startEdit(o)}>Uredi</button>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    }),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function SummaryTile({ label, value, color, real }: { label: string; value: string; sub: string; color: string; real?: boolean }) {
  return (
    <div style={{ padding: "10px 0" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: real ? color : "var(--text)", fontFamily: "var(--font-baskerville, 'Libre Baskerville', Georgia, serif)" }}>{value}</div>
    </div>
  );
}
