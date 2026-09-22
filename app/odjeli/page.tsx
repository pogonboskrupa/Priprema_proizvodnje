"use client";
import { useEffect, useState } from "react";
import { getOdjeli, createOdjel, updateOdjel, deleteOdjel } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { Odjel } from "@/lib/types";
import { ConfirmModal } from "@/components/ConfirmModal";

type BulkRow = { broj: string; povrsina: string };

export default function OdjeliPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const [odjeli, setOdjeli] = useState<Odjel[]>([]);

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
  const [confirmState, setConfirmState] = useState<{ msg: string; onOk: () => void } | null>(null);

  useEffect(() => {
    if (!authLoading && !session) router.replace("/login/");
    if (!authLoading && session?.role !== "admin") router.replace("/");
  }, [session, authLoading]);

  async function load() {
    setOdjeli(await getOdjeli());
  }

  useEffect(() => { load(); }, []);

  if (authLoading || !session) return null;

  // ── Pojedinačni submit ─────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (editId) {
        await updateOdjel(editId, {
          gj: form.gj,
          broj: form.broj,
          povrsina: parseFloat(form.povrsina),
        });
      } else {
        await createOdjel({
          gj: form.gj,
          broj: form.broj,
          povrsina: parseFloat(form.povrsina),
        });
      }
      setForm({ gj: "", broj: "", povrsina: "" });
      setEditId(null);
    } catch {
      // forma ostaje popunjena da korisnik može ponoviti
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
    setLoading(true);
    try {
      await Promise.all(
        valid.map((r) =>
          createOdjel({ gj: bulkGj.trim(), broj: r.broj.trim(), povrsina: parseFloat(r.povrsina) })
        )
      );
      setBulkGj("");
      setBulkRows([{ broj: "", povrsina: "" }, { broj: "", povrsina: "" }]);
    } catch {
      // redovi ostaju
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

  function switchMode(bulk: boolean) {
    setBulkMode(bulk);
    setEditId(null);
    setForm({ gj: "", broj: "", povrsina: "" });
  }

  function handleDelete(id: string) {
    setConfirmState({
      msg: "Obrisati ovaj odjel? Ova akcija je nepovratna.",
      onOk: async () => {
        setConfirmState(null);
        await deleteOdjel(id);
        load();
      },
    });
  }

  const validBulkCount = bulkRows.filter((r) => r.broj.trim() && r.povrsina.trim()).length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Odjeli</h1>

      {/* Mode toggle (samo kad nije edit) */}
      {!editId && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => switchMode(false)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !bulkMode ? "bg-green-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Pojedinačno
          </button>
          <button
            onClick={() => switchMode(true)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              bulkMode ? "bg-green-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
          className="bg-white rounded-xl border shadow-sm p-5 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3"
        >
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Gospodarska jedinica</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.gj}
              onChange={(e) => setForm({ ...form, gj: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Broj odjela</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.broj}
              onChange={(e) => setForm({ ...form, broj: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Površina (ha)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full border rounded-lg px-3 py-2 text-sm"
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
                className="border px-4 py-2 rounded-lg text-sm text-gray-600"
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
          className="bg-white rounded-xl border shadow-sm p-5 mb-6 space-y-4"
        >
          <div className="max-w-xs">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Gospodarska jedinica (zajednička za sve)
            </label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={bulkGj}
              onChange={(e) => setBulkGj(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_1fr_32px] gap-2 text-xs font-medium text-gray-500 px-1">
              <span>Broj odjela</span>
              <span>Površina (ha)</span>
              <span />
            </div>

            {bulkRows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_1fr_32px] gap-2 items-center">
                <input
                  className="border rounded-lg px-3 py-2 text-sm"
                  value={row.broj}
                  onChange={(e) => updateBulkRow(idx, "broj", e.target.value)}
                  placeholder=""
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="border rounded-lg px-3 py-2 text-sm"
                  value={row.povrsina}
                  onChange={(e) => updateBulkRow(idx, "povrsina", e.target.value)}
                  placeholder=""
                />
                <button
                  type="button"
                  onClick={() => removeBulkRow(idx)}
                  disabled={bulkRows.length <= 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors"
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
              className="flex items-center gap-1.5 text-sm text-green-700 hover:text-green-800 font-medium"
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

      {/* ── Tabela grupirana po GJ ──────────────────────────────────────── */}
      {odjeli.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm px-4 py-8 text-center text-gray-500 text-sm">
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
                const totalHa = items.reduce((s, i) => s + i.povrsina, 0);
                return (
                  <div key={gj} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                    <div className="bg-green-700 px-4 py-2.5 flex items-center justify-between">
                      <span className="text-white font-semibold text-sm">{gj}</span>
                      <span className="text-green-200 text-xs">
                        {items.length} {items.length === 1 ? "odjel" : "odjela"} · {totalHa.toFixed(2)} ha
                      </span>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-4 py-2 text-gray-600 font-medium text-xs">Odjel br.</th>
                          <th className="text-right px-4 py-2 text-gray-600 font-medium text-xs">Površina (ha)</th>
                          <th className="text-right px-4 py-2 text-gray-600 font-medium text-xs">Projektanti</th>
                          <th className="text-right px-4 py-2 text-gray-600 font-medium text-xs">Unosi</th>
                          <th className="px-4 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((o) => (
                          <tr key={o.id} className={`border-t hover:bg-gray-50 ${editId === o.id ? "bg-blue-50" : ""}`}>
                            <td className="px-4 py-2.5 font-mono font-medium">{o.broj}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{o.povrsina.toFixed(2)}</td>
                            <td className="px-4 py-2.5 text-right text-gray-500">{o._count?.inzinjeri ?? 0}</td>
                            <td className="px-4 py-2.5 text-right text-gray-500">{o._count?.unosi ?? 0}</td>
                            <td className="px-4 py-2.5 text-right">
                              <button onClick={() => startEdit(o)} className="text-blue-600 hover:underline mr-3 text-xs">
                                Uredi
                              </button>
                              <button onClick={() => handleDelete(o.id)} className="text-red-500 hover:underline text-xs">
                                Obriši
                              </button>
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

      {confirmState && (
        <ConfirmModal
          msg={confirmState.msg}
          onOk={confirmState.onOk}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}
