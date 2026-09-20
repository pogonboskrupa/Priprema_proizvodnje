"use client";
import { useEffect, useState } from "react";

type Odjel = {
  id: number;
  naziv: string;
  broj: string;
  povrsina: number;
  _count: { inzinjeri: number; unosi: number };
};

export default function OdjeliPage() {
  const [odjeli, setOdjeli] = useState<Odjel[]>([]);
  const [form, setForm] = useState({ naziv: "", broj: "", povrsina: "" });
  const [editId, setEditId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/odjeli");
    setOdjeli(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (editId) {
      await fetch(`/api/odjeli/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/odjeli", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setForm({ naziv: "", broj: "", povrsina: "" });
    setEditId(null);
    setLoading(false);
    load();
  }

  function startEdit(o: Odjel) {
    setEditId(o.id);
    setForm({ naziv: o.naziv, broj: o.broj, povrsina: String(o.povrsina) });
  }

  async function handleDelete(id: number) {
    if (!confirm("Obrisati odjel?")) return;
    await fetch(`/api/odjeli/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Šumski odjeli</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border p-5 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3"
      >
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Naziv odjela</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="npr. Šumski odjel 1"
            value={form.naziv}
            onChange={(e) => setForm({ ...form, naziv: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Broj odjela</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="npr. 001"
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
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="npr. 150.50"
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
            {editId ? "Ažuriraj" : "Dodaj odjel"}
          </button>
          {editId && (
            <button
              type="button"
              onClick={() => { setEditId(null); setForm({ naziv: "", broj: "", povrsina: "" }); }}
              className="border px-4 py-2 rounded-lg text-sm"
            >
              Odustani
            </button>
          )}
        </div>
      </form>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Broj</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Naziv</th>
              <th className="text-right px-4 py-3 text-gray-600 font-medium">Površina (ha)</th>
              <th className="text-right px-4 py-3 text-gray-600 font-medium">Inžinjeri</th>
              <th className="text-right px-4 py-3 text-gray-600 font-medium">Unosi</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {odjeli.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-400">
                  Nema odjela. Dodajte prvi odjel.
                </td>
              </tr>
            )}
            {odjeli.map((o) => (
              <tr key={o.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-mono">{o.broj}</td>
                <td className="px-4 py-3 font-medium">{o.naziv}</td>
                <td className="px-4 py-3 text-right">{o.povrsina.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-gray-500">{o._count.inzinjeri}</td>
                <td className="px-4 py-3 text-right text-gray-500">{o._count.unosi}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => startEdit(o)}
                    className="text-blue-600 hover:underline mr-3 text-xs"
                  >
                    Uredi
                  </button>
                  <button
                    onClick={() => handleDelete(o.id)}
                    className="text-red-500 hover:underline text-xs"
                  >
                    Obriši
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
