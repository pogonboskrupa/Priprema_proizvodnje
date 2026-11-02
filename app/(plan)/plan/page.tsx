"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { getOdjeli, updateOdjelGodina } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { Odjel } from "@/lib/types";
import { parseDecimal } from "@/lib/format";
import { godineEvidencije } from "@/lib/godine";
import { odjelZaGodinu, imaPodatke } from "@/lib/plan-sjece";

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

type Zbir = { ha: number; planCet: number; planLis: number; realCet: number; realLis: number };

function zbir(os: readonly Odjel[]): Zbir {
  const z: Zbir = { ha: 0, planCet: 0, planLis: 0, realCet: 0, realLis: 0 };
  for (const o of os) {
    z.ha += Number(o.povrsina) || 0;
    z.planCet += o.plan_cet || 0;
    z.planLis += o.plan_lis || 0;
    z.realCet += o.real_cet || 0;
    z.realLis += o.real_lis || 0;
  }
  return z;
}

const fmtM3 = (n: number) => (n > 0 ? n.toLocaleString("bs-BA") : "–");

/** Akcent GJ je tamna boja pa je u tamnoj temi nečitljiv kao tekst — miješa se s bojom teksta teme */
const citljivo = (accent: string) => `color-mix(in srgb, ${accent} 38%, var(--text))`;

/** Boja trake napretka: mirna, a samo završen odjel/GJ dobija tamnozelenu */
const bojaNapretka = (p: number) => (p >= 100 ? "var(--done)" : "var(--bar)");

/** Red sa zbirom po svim kolonama: za jednu GJ ili (glavni) za cijelu šumariju */
function UkupnoRed({ z, naslov, podnaslov, boja, glavni = false }: {
  z: Zbir; naslov: string; podnaslov?: string; boja?: typeof GJ_PALETTE[number]; glavni?: boolean;
}) {
  const plan = z.planCet + z.planLis;
  const real = z.realCet + z.realLis;
  const p = plan > 0 ? Math.min((real / plan) * 100, 100) : 0;
  const num: CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums" };
  const akcent = glavni ? "var(--th-text)" : citljivo(boja!.accent);
  const linija = glavni ? "var(--th-text)" : boja!.accent;
  return (
    <tr
      className={glavni ? "grand-total" : "gj-total"}
      style={glavni ? undefined : { background: boja!.header, borderLeft: `3px solid ${boja!.accent}` }}
    >
      <td className="col-odjel" style={{ borderRight: `2px solid ${linija}`, whiteSpace: "normal", lineHeight: 1.2 }}>
        <div style={{ textTransform: "uppercase", letterSpacing: ".05em", fontSize: glavni ? 13 : 12, color: akcent }}>Ukupno</div>
        {podnaslov && <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".03em" }}>{podnaslov}</div>}
      </td>
      <td style={num}>{z.ha.toFixed(2)}</td>
      <td className="grp-start" style={num}>{fmtM3(z.planCet)}</td>
      <td style={{ ...num, color: "var(--cet)" }}>{fmtM3(z.realCet)}</td>
      <td className="grp-start" style={num}>{fmtM3(z.planLis)}</td>
      <td style={{ ...num, color: "var(--lis)" }}>{fmtM3(z.realLis)}</td>
      <td className="grp-start"><Progress value={p} color={bojaNapretka(p)} /></td>
      <td aria-label={naslov} />
    </tr>
  );
}

function Progress({ value, color }: { value: number; color: string }) {
  const w = Math.min(value, 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--track)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${w}%`, borderRadius: 4, background: color, transition: "width .4s ease" }} />
      </div>
      <span style={{ fontSize: 12, color: value >= 100 ? "var(--done)" : "var(--muted)", minWidth: 52, whiteSpace: "nowrap", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
        {value >= 100 ? "✓ 100%" : `${value.toFixed(0)}%`}
      </span>
    </div>
  );
}

export default function PlanPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [sviOdjeli, setSviOdjeli] = useState<Odjel[]>([]);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormFields>({ povrsina: "", plan_cet: "", plan_lis: "", real_cet: "", real_lis: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!loading && !session) router.replace("/login/");
    if (!loading && session?.role !== "admin") router.replace("/");
  }, [session, loading]);

  useEffect(() => { loadOdjeli(); }, []);

  async function loadOdjeli() {
    try { setSviOdjeli(await getOdjeli({ ukljuciArhivirane: true })); } catch { setErr("Greška pri učitavanju odjela."); }
  }

  function startEdit(o: Odjel) {
    setEditId(o.id);
    setForm({ povrsina: String(o.povrsina || ""), plan_cet: String(o.plan_cet || ""), plan_lis: String(o.plan_lis || ""), real_cet: String(o.real_cet || ""), real_lis: String(o.real_lis || "") });
  }

  async function saveEdit() {
    if (!editId) return;
    const values = {
      povrsina: parseDecimal(form.povrsina),
      plan_cet: parseDecimal(form.plan_cet),
      plan_lis: parseDecimal(form.plan_lis),
      real_cet: parseDecimal(form.real_cet),
      real_lis: parseDecimal(form.real_lis),
    };
    if (Object.values(values).some((v) => Number.isNaN(v))) {
      setErr("Neispravan broj — koristi npr. 1234 ili 12,5.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await updateOdjelGodina(editId, year, values.povrsina ?? 0, {
        plan_cet: values.plan_cet ?? 0,
        plan_lis: values.plan_lis ?? 0,
        real_cet: values.real_cet ?? 0,
        real_lis: values.real_lis ?? 0,
      });
      setEditId(null);
      loadOdjeli();
    } catch {
      setErr("Greška pri snimanju. Pokušaj ponovo.");
    } finally {
      setSaving(false);
    }
  }

  // vrijednosti odabrane godine; arhivirani odjel ostaje vidljiv u godinama u kojima ima plan
  const odjeli = sviOdjeli
    .map((o) => ({ ...o, ...odjelZaGodinu(o, year) }))
    .filter((o) => !o.arhiviran || imaPodatke(o));

  const zUkupno = zbir(odjeli);
  const totPlan = zUkupno.planCet + zUkupno.planLis;
  const totReal = zUkupno.realCet + zUkupno.realLis;
  const pct = totPlan > 0 ? Math.min((totReal / totPlan) * 100, 100) : 0;
  const groups = groupByGj(odjeli);

  const fmt = (n: number) => n > 0 ? n.toLocaleString("bs-BA") : "–";
  const fmtN = (n: number) => n.toLocaleString("bs-BA");

  if (loading || !session) return null;

  return (
    <>
      <style>{`
        .plan-wrap { font-family: 'Inter', system-ui, sans-serif; }
        .plan-wrap .baskerville { font-family: var(--font-baskerville, 'Libre Baskerville', Georgia, serif); }
        .plan-wrap {
          --surface: #ffffff;
          --ground: #f0f4ee;
          --border: #dce5d8;
          --track: #e3eadf;
          --text: #1a2b1c;
          --muted: #5a6b5c;
          --input-bg: #ffffff;
          --input-border: #b8c9b2;
          --th-bg: #e8efe4;
          --th-text: #3a4e3c;
          --row-hover: rgba(45,106,79,0.05);
          --cet: #2d6a4f;
          --lis: #8a5a2b;
          --bar: #52796f;
          --done: #1f5c3f;
        }
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) .plan-wrap {
            --surface: #111c12; --ground: #0c1509; --border: #253127; --track: #1e2e1f;
            --text: #daecd3; --muted: #7fa882; --input-bg: #182119; --input-border: #354d37;
            --th-bg: #162018; --th-text: #99bb9a; --row-hover: rgba(111,195,151,0.07);
            --cet: #6fc397; --lis: #d4a373; --bar: #7fb3a4; --done: #6fc397;
          }
        }
        :root[data-theme="dark"] .plan-wrap {
          --surface: #111c12; --ground: #0c1509; --border: #253127; --track: #1e2e1f;
          --text: #daecd3; --muted: #7fa882; --input-bg: #182119; --input-border: #354d37;
          --th-bg: #162018; --th-text: #99bb9a; --row-hover: rgba(111,195,151,0.07);
          --cet: #6fc397; --lis: #d4a373; --bar: #7fb3a4; --done: #6fc397;
        }
        .plan-wrap table { width: 100%; border-collapse: collapse; }
        .plan-wrap thead th { background: var(--th-bg); color: var(--th-text); font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; padding: 10px 14px; white-space: nowrap; }
        .plan-wrap thead tr.sub th { font-size: 10px; font-weight: 600; padding: 6px 14px 8px; opacity: .85; border-top: 0; }
        .plan-wrap thead th.vrsta-cet { color: var(--cet); border-bottom: 2px solid var(--cet); text-align: center; }
        .plan-wrap thead th.vrsta-lis { color: var(--lis); border-bottom: 2px solid var(--lis); text-align: center; }
        .plan-wrap td { padding: 10px 14px; font-size: 13px; color: var(--text); border-bottom: 1px solid var(--border); vertical-align: middle; }
        .plan-wrap .grp-start { border-left: 1px solid var(--border); }
        .plan-wrap thead .grp-start { border-left: 1px solid var(--border); }
        .plan-wrap tr:last-child td { border-bottom: none; }
        .plan-wrap tr.data-row:hover td { background: var(--row-hover); }
        .plan-wrap .gj-header td { border-bottom: none; padding: 14px 14px 10px; }
        .plan-wrap .gj-total td { border-top: 1px solid var(--border); border-bottom: none; padding: 10px 14px; font-weight: 700; font-size: 13px; }
        .plan-wrap .grand-total td { background: var(--th-bg); border-top: 2px solid var(--th-text); border-bottom: none; padding: 14px 14px; font-weight: 800; font-size: 14px; }
        .plan-wrap .col-odjel { min-width: 92px; }
        .plan-wrap input[type="text"] {
          border: 1px solid var(--input-border); background: var(--input-bg); color: var(--text);
          border-radius: 6px; padding: 5px 8px; font-size: 13px; text-align: right; width: 84px; outline: none;
        }
        .plan-wrap input[type="text"]:focus { border-color: var(--cet); box-shadow: 0 0 0 3px rgba(45,106,79,.18); }
        .btn-save { background: #2d6a4f; color: #fff; border: none; border-radius: 6px; padding: 5px 12px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .btn-save:hover { background: #245940; }
        .btn-save:disabled { opacity: .6; cursor: default; }
        .btn-cancel { background: none; border: none; color: var(--muted); font-size: 12px; cursor: pointer; padding: 5px 8px; }
        .btn-cancel:hover { color: var(--text); }
        .btn-edit { background: none; border: 1px solid transparent; color: var(--muted); font-size: 12px; cursor: pointer; padding: 3px 10px; border-radius: 6px; transition: opacity .15s, border-color .15s, color .15s; }
        .btn-edit:hover { color: var(--cet); border-color: var(--border); }
        @media (hover: hover) {
          .btn-edit { opacity: 0; }
          tr.data-row:hover .btn-edit, .btn-edit:focus-visible { opacity: 1; }
        }
        .chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 20px; font-size: 10.5px; font-weight: 700; letter-spacing: .03em; white-space: nowrap; }
        .plan-wrap .kartica { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px 20px; }
        .plan-wrap .kartica-naslov { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; color: var(--muted); letter-spacing: .06em; text-transform: uppercase; }
        .plan-wrap .godina { padding: 5px 13px; border-radius: 7px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; background: transparent; color: var(--muted); transition: background .15s, color .15s; }
        .plan-wrap .godina:hover { color: var(--text); }
        .plan-wrap .godina[aria-pressed="true"] { background: #2d6a4f; color: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.18); }
      `}</style>

      <div className="plan-wrap" style={{ color: "var(--text)" }}>

        {/* Header */}
        <div style={{ marginBottom: 22, display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="baskerville" style={{ fontSize: 28, fontWeight: 700, color: "var(--text)", lineHeight: 1.15, textWrap: "balance" }}>
              Plan sječe {year}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
              {groups.length} {groups.length === 1 ? "gospodarska jedinica" : "gospodarskih jedinica"} · {odjeli.length} odjela · {zUkupno.ha.toFixed(2)} ha
            </div>
          </div>
          <div role="group" aria-label="Godina" style={{ marginLeft: "auto", display: "inline-flex", gap: 2, padding: 3, borderRadius: 10, background: "var(--th-bg)" }}>
            {godineEvidencije({ iSljedeca: true }).map((y) => (
              <button key={y} className="godina" aria-pressed={y === year} onClick={() => { setYear(y); setEditId(null); }}>
                {y}
              </button>
            ))}
          </div>
        </div>

        {err && (
          <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, border: "1px solid #fca5a5", background: "rgba(239,68,68,.08)", color: "#b91c1c", fontSize: 13 }}>
            {err}
          </div>
        )}

        {/* Sažetak: ukupni napredak + četinari + lišćari */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 22 }}>
          <div className="kartica" style={{ gridColumn: "span 1" }}>
            <div className="kartica-naslov">Godišnji napredak</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
              <span className="baskerville" style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: bojaNapretka(pct) }}>
                {pct.toFixed(1)}%
              </span>
            </div>
            <div style={{ background: "var(--track)", borderRadius: 5, height: 10, overflow: "hidden", margin: "12px 0 8px" }}>
              <div style={{ height: "100%", width: `${pct.toFixed(1)}%`, background: bojaNapretka(pct), borderRadius: 5, transition: "width .6s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
              <span><b style={{ color: "var(--text)" }}>{fmt(totReal)}</b> od {fmt(totPlan)} m³</span>
              {totPlan > totReal && <span>preostalo {fmtN(totPlan - totReal)} m³</span>}
            </div>
          </div>
          <VrstaKartica naslov="Četinari" boja="var(--cet)" plan={zUkupno.planCet} real={zUkupno.realCet} />
          <VrstaKartica naslov="Lišćari" boja="var(--lis)" plan={zUkupno.planLis} real={zUkupno.realLis} />
        </div>

        {/* Tabela grupirana po GJ */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th rowSpan={2} className="col-odjel" style={{ textAlign: "left", borderRight: "2px solid var(--th-text)" }}>Odjel</th>
                  <th rowSpan={2} style={{ textAlign: "right" }}>Ha</th>
                  <th colSpan={2} className="vrsta-cet grp-start">Četinari m³</th>
                  <th colSpan={2} className="vrsta-lis grp-start">Lišćari m³</th>
                  <th rowSpan={2} className="grp-start" style={{ textAlign: "left", minWidth: 150 }}>Napredak</th>
                  <th rowSpan={2} style={{ width: 90 }}></th>
                </tr>
                <tr className="sub">
                  <th className="grp-start" style={{ textAlign: "right" }}>Plan</th>
                  <th style={{ textAlign: "right" }}>Real.</th>
                  <th className="grp-start" style={{ textAlign: "right" }}>Plan</th>
                  <th style={{ textAlign: "right" }}>Real.</th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: "44px 0", color: "var(--muted)" }}>Nema odjela za {year}. godinu.</td></tr>
                )}
                {groups.map(({ gj, odjeli: gjOdjeli, color }) => {
                  const zg = zbir(gjOdjeli);
                  const gjPlan = zg.planCet + zg.planLis;
                  const gjReal = zg.realCet + zg.realLis;
                  const gjPct = gjPlan > 0 ? Math.min((gjReal / gjPlan) * 100, 100) : 0;

                  return [
                    <tr key={`gj-${gj}`} className="gj-header" style={{ background: color.header }}>
                      <td colSpan={8} style={{ borderLeft: `4px solid ${color.accent}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                          <div className="baskerville" style={{ fontWeight: 700, fontSize: 15, color: citljivo(color.accent), letterSpacing: ".01em" }}>
                            GJ {gj}
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <span className="chip" style={{ background: "rgba(0,0,0,.06)", color: "var(--muted)" }}>
                              {gjOdjeli.length} odjela
                            </span>
                            <span className="chip" style={{ background: "rgba(0,0,0,.06)", color: "var(--muted)" }}>
                              {zg.ha.toFixed(2)} ha
                            </span>
                            {gjPlan > 0 && (
                              <span className="chip" style={{ background: "rgba(0,0,0,.06)", color: "var(--muted)" }}>
                                {fmt(gjReal)} / {fmt(gjPlan)} m³
                              </span>
                            )}
                            {gjPlan > 0 && (
                              <span className="chip" style={{ background: color.header, color: citljivo(color.accent), outline: `1px solid ${color.border}` }}>
                                {gjPct.toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>,
                    ...gjOdjeli.map((o) => {
                      const plan = (o.plan_cet || 0) + (o.plan_lis || 0);
                      const real = (o.real_cet || 0) + (o.real_lis || 0);
                      const p = plan > 0 ? Math.min((real / plan) * 100, 100) : 0;
                      const isEditing = editId === o.id;

                      return (
                        <tr key={o.id} className="data-row" style={{ borderLeft: `3px solid ${color.border}` }}>
                          <td className="col-odjel" style={{ borderRight: `2px solid ${color.accent}` }}>
                            <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 17, color: "var(--text)" }}>{o.broj}</span>
                          </td>
                          {isEditing ? (
                            <>
                              <td><input type="text" inputMode="decimal" aria-label="Površina ha" value={form.povrsina} onChange={(e) => setForm({ ...form, povrsina: e.target.value })} style={{ width: 72 }} /></td>
                              <td className="grp-start"><input type="text" inputMode="decimal" aria-label="Plan četinari" value={form.plan_cet} onChange={(e) => setForm({ ...form, plan_cet: e.target.value })} /></td>
                              <td><input type="text" inputMode="decimal" aria-label="Realizacija četinari" value={form.real_cet} onChange={(e) => setForm({ ...form, real_cet: e.target.value })} /></td>
                              <td className="grp-start"><input type="text" inputMode="decimal" aria-label="Plan lišćari" value={form.plan_lis} onChange={(e) => setForm({ ...form, plan_lis: e.target.value })} /></td>
                              <td><input type="text" inputMode="decimal" aria-label="Realizacija lišćari" value={form.real_lis} onChange={(e) => setForm({ ...form, real_lis: e.target.value })} /></td>
                              <td className="grp-start" style={{ color: "var(--muted)" }}>–</td>
                              <td>
                                <div style={{ display: "flex", gap: 4 }}>
                                  <button className="btn-save" onClick={saveEdit} disabled={saving}>{saving ? "..." : "Sačuvaj"}</button>
                                  <button className="btn-cancel" onClick={() => setEditId(null)}>Odustani</button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ textAlign: "right", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{(Number(o.povrsina) || 0).toFixed(2)}</td>
                              <td className="grp-start" style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: o.plan_cet ? "var(--text)" : "var(--muted)" }}>{fmt(o.plan_cet || 0)}</td>
                              <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: o.real_cet ? "var(--cet)" : "var(--muted)" }}>{fmt(o.real_cet || 0)}</td>
                              <td className="grp-start" style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: o.plan_lis ? "var(--text)" : "var(--muted)" }}>{fmt(o.plan_lis || 0)}</td>
                              <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: o.real_lis ? "var(--lis)" : "var(--muted)" }}>{fmt(o.real_lis || 0)}</td>
                              <td className="grp-start"><Progress value={p} color={bojaNapretka(p)} /></td>
                              <td style={{ textAlign: "right" }}>
                                <button className="btn-edit" onClick={() => startEdit(o)}>Uredi</button>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    }),
                    <UkupnoRed key={`ukupno-${gj}`} z={zg} naslov={`Ukupno GJ ${gj}`} podnaslov={`GJ ${gj}`} boja={color} />,
                  ];
                })}
              </tbody>
              {groups.length > 0 && (
                <tfoot>
                  <UkupnoRed z={zUkupno} naslov="Ukupno šumarija" podnaslov="šumarija" glavni />
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function VrstaKartica({ naslov, boja, plan, real }: { naslov: string; boja: string; plan: number; real: number }) {
  const p = plan > 0 ? Math.min((real / plan) * 100, 100) : 0;
  const n = (v: number) => v.toLocaleString("bs-BA");
  return (
    <div className="kartica">
      <div className="kartica-naslov">
        <span aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", background: boja }} />
        {naslov}
      </div>
      <div style={{ display: "flex", gap: 28, marginTop: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Plan</div>
          <div className="baskerville" style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {n(plan)}<span style={{ fontSize: 12, fontWeight: 400, color: "var(--muted)" }}> m³</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Realizacija</div>
          <div className="baskerville" style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: boja }}>
            {n(real)}<span style={{ fontSize: 12, fontWeight: 400, color: "var(--muted)" }}> m³</span>
          </div>
        </div>
      </div>
      <div style={{ background: "var(--track)", borderRadius: 4, height: 6, overflow: "hidden", margin: "14px 0 6px" }}>
        <div style={{ height: "100%", width: `${p.toFixed(1)}%`, background: boja, borderRadius: 4, transition: "width .6s ease" }} />
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{plan > 0 ? `${p.toFixed(1)}%` : "nema plana"}</div>
    </div>
  );
}
