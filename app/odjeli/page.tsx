"use client";
import { useEffect, useState } from "react";
import { getOdjeli, createOdjel, updateOdjel, arhivirajOdjel } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { Odjel } from "@/lib/types";
import { ConfirmModal } from "@/components/ConfirmModal";
import { parseDecimal, cmpOdjel } from "@/lib/format";

type BulkRow = { broj: string; povrsina: string };

function StatusToggle({
  active, spinning, activeClass, inactiveClass, onClick,
}: {
  active: boolean;
  spinning: boolean;
  activeClass: string;
  inactiveClass: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={spinning}
      title={active ? "Označeno — klikni za uklanjanje" : "Nije urađeno — klikni za označavanje"}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full border transition-colors disabled:opacity-60 ${active ? activeClass : inactiveClass}`}
    >
      {spinning ? (
        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      ) : active ? (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      )}
    </button>
  );
}

export default function OdjeliPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const [sviOdjeli, setSviOdjeli] = useState<Odjel[]>([]);
  const [showArhiva, setShowArhiva] = useState(false);

  // Pojedinačni unos / edit
  const [form, setForm] = useState({ gj: "", broj: "", povrsina: "" });
  const [editId, setEditId] = useState<string | null>(null);

  // Grupni unos
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkGj, setBulkGj] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([
    { broj: "", povrsina: "" },
    { broj: "", povrsina: "" },
  ]);

  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null); // "<odjelId>-doz" | "<odjelId>-vlak"
  const [confirmState, setConfirmState] = useState<{ msg: string; okLabel?: string; okColor?: "red" | "amber"; onOk: () => void } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!authLoading && !session) router.replace("/login/");
    if (!authLoading && session?.role !== "admin") router.replace("/");
  }, [session, authLoading]);

  async function load() {
    setSviOdjeli(await getOdjeli({ ukljuciArhivirane: true, saBrojem: true }));
  }

  useEffect(() => { load(); }, []);

  if (authLoading || !session) return null;

  const odjeli = sviOdjeli.filter((o) => !o.arhiviran);
  const arhivirani = sviOdjeli.filter((o) => o.arhiviran);

  // isti odjel dva puta bi raspolovio unose i izvještaje; arhiva se računa (može se vratiti)
  const kljuc = (gj: string, broj: string) => `${gj.trim().toUpperCase()}|${broj.trim().toUpperCase()}`;
  function duplikatPoruka(gj: string, broj: string, exceptId?: string | null): string | null {
    const d = sviOdjeli.find((o) => o.id !== exceptId && kljuc(o.gj, o.broj) === kljuc(gj, broj));
    return d ? `Odjel ${d.gj} / ${d.broj} već postoji${d.arhiviran ? " (u arhivi — vrati ga iz arhive)" : ""}.` : null;
  }

  function validPovrsina(raw: string): number | null {
    const n = parseDecimal(raw);
    if (n === null || Number.isNaN(n)) { setErr("Neispravna površina (npr. 12,5)."); return null; }
    setErr("");
    return n;
  }

  // ── Pojedinačni submit ─────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const povrsina = validPovrsina(form.povrsina);
    if (povrsina === null) return;
    const dup = duplikatPoruka(form.gj, form.broj, editId);
    if (dup) { setErr(dup); return; }
    setLoading(true);
    try {
      const data = { gj: form.gj.trim(), broj: form.broj.trim(), povrsina };
      if (editId) await updateOdjel(editId, data);
      else await createOdjel(data);
      setForm({ gj: "", broj: "", povrsina: "" });
      setEditId(null);
    } catch {
      setErr("Greška pri snimanju odjela. Pokušaj ponovo.");
    } finally {
      setLoading(false);
      load();
    }
  }

  // ── Grupni submit ──────────────────────────────────────────────────────────
  async function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bulkGj.trim()) return;
    const valid = bulkRows.filter((r) => r.broj.trim() && r.povrsina.trim());
    if (!valid.length) return;
    const parsed = valid.map((r) => ({ broj: r.broj.trim(), povrsina: parseDecimal(r.povrsina) }));
    const bad = parsed.find((r) => r.povrsina === null || Number.isNaN(r.povrsina));
    if (bad) { setErr(`Neispravna površina za odjel ${bad.broj}.`); return; }
    const uListi = new Set<string>();
    for (const r of parsed) {
      const k = kljuc(bulkGj, r.broj);
      if (uListi.has(k)) { setErr(`Odjel ${r.broj} je dva puta u listi.`); return; }
      uListi.add(k);
      const dup = duplikatPoruka(bulkGj, r.broj);
      if (dup) { setErr(dup); return; }
    }
    setErr("");
    setLoading(true);
    try {
      await Promise.all(
        parsed.map((r) => createOdjel({ gj: bulkGj.trim(), broj: r.broj, povrsina: r.povrsina as number }))
      );
      setBulkGj("");
      setBulkRows([{ broj: "", povrsina: "" }, { broj: "", povrsina: "" }]);
    } catch {
      setErr("Greška pri snimanju — provjeri listu, dio odjela možda nije sačuvan.");
    } finally {
      setLoading(false);
      load();
    }
  }

  function updateBulkRow(idx: number, field: keyof BulkRow, val: string) {
    setBulkRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));
  }

  function addBulkRow() {
    setBulkRows((prev) => [...prev, { broj: "", povrsina: "" }]);
  }

  function removeBulkRow(idx: number) {
    setBulkRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function startEdit(o: Odjel) {
    setBulkMode(false);
    setEditId(o.id);
    setForm({ gj: o.gj, broj: o.broj, povrsina: String(o.povrsina) });
  }

  function cancelEdit() {
    setEditId(null);
    setForm({ gj: "", broj: "", povrsina: "" });
  }

  async function saveInlineEdit() {
    if (!editId) return;
    const povrsina = validPovrsina(form.povrsina);
    if (povrsina === null) return;
    const dup = duplikatPoruka(form.gj, form.broj, editId);
    if (dup) { setErr(dup); return; }
    setLoading(true);
    try {
      await updateOdjel(editId, { gj: form.gj.trim(), broj: form.broj.trim(), povrsina });
      setEditId(null);
      setForm({ gj: "", broj: "", povrsina: "" });
    } catch {
      setErr("Greška pri snimanju odjela. Pokušaj ponovo.");
    } finally {
      setLoading(false);
      load();
    }
  }

  function switchMode(bulk: boolean) {
    setBulkMode(bulk);
    setEditId(null);
    setForm({ gj: "", broj: "", povrsina: "" });
  }

  async function toggleStatus(o: Odjel, field: "doznaceno" | "vlakeProjektovane") {
    const key = `${o.id}-${field === "doznaceno" ? "doz" : "vlak"}`;
    if (toggling === key) return;
    const newVal = !o[field];
    // optimistični update
    setSviOdjeli((prev) => prev.map((x) => x.id === o.id ? { ...x, [field]: newVal } : x));
    setToggling(key);
    try {
      await updateOdjel(o.id, { [field]: newVal });
    } catch {
      // rollback
      setSviOdjeli((prev) => prev.map((x) => x.id === o.id ? { ...x, [field]: !newVal } : x));
    } finally {
      setToggling(null);
    }
  }

  function handleArhiviraj(o: Odjel) {
    setConfirmState({
      msg: `Arhivirati odjel ${o.gj} / ${o.broj}? Više se neće nuditi u unosima, a unosi i izvještaji ostaju sačuvani. Odjel možeš vratiti iz arhive.`,
      okLabel: "Arhiviraj",
      okColor: "amber",
      onOk: async () => {
        setConfirmState(null);
        try { await arhivirajOdjel(o.id, true); } catch { setErr("Greška pri arhiviranju odjela."); }
        load();
      },
    });
  }

  async function vratiIzArhive(o: Odjel) {
    try { await arhivirajOdjel(o.id, false); } catch { setErr("Greška pri vraćanju odjela."); }
    load();
  }

  const validBulkCount = bulkRows.filter((r) => r.broj.trim() && r.povrsina.trim()).length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Odjeli</h1>

      {err && (
        <div className="mb-4 rounded-lg px-4 py-2.5 text-sm border bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          {err}
        </div>
      )}

      {/* Mode toggle (samo kad nije edit) */}
      {!editId && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => switchMode(false)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !bulkMode ? "bg-green-700 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            Pojedinačno
          </button>
          <button
            onClick={() => switchMode(true)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              bulkMode ? "bg-green-700 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            Grupni unos (više odjela)
          </button>
        </div>
      )}

      {/* ── Pojedinačna forma ─────────────────────────────────────────────── */}
      {!bulkMode && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3"
        >
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Gospodarska jedinica</label>
            <input
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              value={form.gj}
              onChange={(e) => setForm({ ...form, gj: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Broj odjela</label>
            <input
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              value={form.broj}
              onChange={(e) => setForm({ ...form, broj: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Površina (ha)</label>
            <input
              type="text"
              inputMode="decimal"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              value={form.povrsina}
              onChange={(e) => setForm({ ...form, povrsina: e.target.value })}
              required
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50"
            >
              {editId ? "Ažuriraj" : "Dodaj"}
            </button>
            {editId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300"
              >
                Odustani
              </button>
            )}
          </div>
        </form>
      )}

      {/* ── Grupna forma ──────────────────────────────────────────────────── */}
      {bulkMode && (
        <form
          onSubmit={handleBulkSubmit}
          className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 mb-6 space-y-4"
        >
          <div className="max-w-xs">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Gospodarska jedinica (zajednička za sve)
            </label>
            <input
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              value={bulkGj}
              onChange={(e) => setBulkGj(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_1fr_32px] gap-2 text-xs font-medium text-gray-600 dark:text-gray-400 px-1">
              <span>Broj odjela</span>
              <span>Površina (ha)</span>
              <span />
            </div>

            {bulkRows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_1fr_32px] gap-2 items-center">
                <input
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  value={row.broj}
                  onChange={(e) => updateBulkRow(idx, "broj", e.target.value)}
                  placeholder=""
                />
                <input
                  type="text"
                  inputMode="decimal"
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  value={row.povrsina}
                  onChange={(e) => updateBulkRow(idx, "povrsina", e.target.value)}
                  placeholder=""
                />
                <button
                  type="button"
                  onClick={() => removeBulkRow(idx)}
                  disabled={bulkRows.length <= 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-30 transition-colors"
                  title="Ukloni red"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={addBulkRow}
              className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 font-medium"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
              Dodaj red
            </button>

            <button
              type="submit"
              disabled={loading || !bulkGj.trim() || validBulkCount === 0}
              className="bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50 ml-auto"
            >
              {loading
                ? "Snimam..."
                : `Sačuvaj ${validBulkCount > 0 ? `(${validBulkCount})` : ""}`}
            </button>
          </div>
        </form>
      )}

      {/* ── Status summary ────────────────────────────────────────────── */}
      {odjeli.length > 0 && (() => {
        const total = odjeli.length;
        const dozDone = odjeli.filter(o => o.doznaceno).length;
        const vlakDone = odjeli.filter(o => o.vlakeProjektovane).length;
        const bothDone = odjeli.filter(o => o.doznaceno && o.vlakeProjektovane).length;
        return (
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800">
              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              Doznaka: {dozDone}/{total}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              Vlake: {vlakDone}/{total}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              Oboje: {bothDone}/{total}
            </span>
          </div>
        );
      })()}

      {/* ── Tabela grupirana po GJ ──────────────────────────────────────── */}
      {odjeli.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm px-4 py-8 text-center text-gray-600 dark:text-gray-400 text-sm">
          Nema odjela. Dodajte prvi odjel.
        </div>
      ) : (
        (() => {
          const gjMap = new Map<string, Odjel[]>();
          for (const o of odjeli) {
            if (!gjMap.has(o.gj)) gjMap.set(o.gj, []);
            gjMap.get(o.gj)!.push(o);
          }
          const sorted = Array.from(gjMap.entries()).sort(([a], [b]) => a.localeCompare(b));
          return (
            <div className="space-y-4">
              {sorted.map(([gj, items]) => {
                const totalHa = items.reduce((s, i) => s + (Number(i.povrsina) || 0), 0);
                return (
                  <div key={gj} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="bg-green-700 px-4 py-2.5 flex items-center justify-between">
                      <span className="text-white font-semibold text-sm">{gj}</span>
                      <span className="text-green-200 text-xs">
                        {items.length} {items.length === 1 ? "odjel" : "odjela"} · {totalHa.toFixed(2)} ha
                      </span>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <tr>
                          <th className="text-left px-3 py-2 text-gray-700 dark:text-gray-300 font-medium text-xs">Odjel br.</th>
                          <th className="text-right px-3 py-2 text-gray-700 dark:text-gray-300 font-medium text-xs">Površina (ha)</th>
                          <th className="text-center px-2 py-2 text-green-700 dark:text-green-400 font-medium text-xs">Doznaka</th>
                          <th className="text-center px-2 py-2 text-amber-600 dark:text-amber-400 font-medium text-xs">Vlake</th>
                          <th className="text-right px-3 py-2 text-gray-700 dark:text-gray-300 font-medium text-xs hidden sm:table-cell">Proj.</th>
                          <th className="text-right px-3 py-2 text-gray-700 dark:text-gray-300 font-medium text-xs hidden sm:table-cell">Unosi</th>
                          <th className="px-3 py-2 w-20"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((o) => (
                          <tr key={o.id} className={`border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${editId === o.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}>
                            <td className="px-3 py-2.5 font-mono font-semibold text-gray-900 dark:text-gray-100">
                              {editId === o.id ? (
                                <input
                                  type="text"
                                  value={form.broj}
                                  onChange={(e) => setForm((f) => ({ ...f, broj: e.target.value }))}
                                  className="w-full border border-blue-400 rounded px-1.5 py-0.5 text-sm font-mono bg-white dark:bg-gray-800 dark:text-gray-100 outline-none"
                                />
                              ) : o.broj}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-gray-800 dark:text-gray-200">
                              {editId === o.id ? (
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={form.povrsina}
                                  onChange={(e) => setForm((f) => ({ ...f, povrsina: e.target.value }))}
                                  onKeyDown={(e) => { if (e.key === "Enter") saveInlineEdit(); if (e.key === "Escape") cancelEdit(); }}
                                  className="w-full border border-blue-400 rounded px-1.5 py-0.5 text-sm text-right bg-white dark:bg-gray-800 dark:text-gray-100 outline-none"
                                />
                              ) : (Number(o.povrsina) || 0).toFixed(2)}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <StatusToggle
                                active={!!o.doznaceno}
                                spinning={toggling === `${o.id}-doz`}
                                activeClass="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-green-300 dark:border-green-700"
                                inactiveClass="bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600 border-gray-300 dark:border-gray-600"
                                onClick={() => toggleStatus(o, "doznaceno")}
                              />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <StatusToggle
                                active={!!o.vlakeProjektovane}
                                spinning={toggling === `${o.id}-vlak`}
                                activeClass="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                                inactiveClass="bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600 border-gray-300 dark:border-gray-600"
                                onClick={() => toggleStatus(o, "vlakeProjektovane")}
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-400 hidden sm:table-cell">{o._count?.inzinjeri ?? 0}</td>
                            <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-400 hidden sm:table-cell">{o._count?.unosi ?? 0}</td>
                            <td className="px-3 py-2.5 text-right w-20">
                              {editId === o.id ? (
                                <div className="flex flex-col items-end gap-0.5">
                                  <button onClick={saveInlineEdit} disabled={loading} className="text-green-600 dark:text-green-400 hover:underline text-xs font-semibold">
                                    Sačuvaj
                                  </button>
                                  <button onClick={cancelEdit} className="text-gray-500 dark:text-gray-400 hover:underline text-xs">
                                    Odustani
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col items-end gap-0.5">
                                  <button onClick={() => startEdit(o)} className="text-blue-600 dark:text-blue-400 hover:underline text-xs">
                                    Uredi
                                  </button>
                                  <button onClick={() => handleArhiviraj(o)} className="text-amber-600 dark:text-amber-400 hover:underline text-xs">
                                    Arhiviraj
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          );
        })()
      )}

      {arhivirani.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowArhiva((v) => !v)}
            className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:underline"
          >
            {showArhiva ? "▾" : "▸"} Arhiva ({arhivirani.length})
          </button>
          {showArhiva && (
            <div className="mt-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
              {arhivirani
                .sort(cmpOdjel)
                .map((o) => (
                  <div key={o.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                    <span className="font-mono text-gray-500 dark:text-gray-400">{o.gj} / {o.broj}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{(Number(o.povrsina) || 0).toFixed(2)} ha</span>
                    <button onClick={() => vratiIzArhive(o)} className="ml-auto text-xs text-green-700 dark:text-green-400 hover:underline">
                      Vrati
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {confirmState && (
        <ConfirmModal
          msg={confirmState.msg}
          okLabel={confirmState.okLabel}
          okColor={confirmState.okColor}
          onOk={confirmState.onOk}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}
