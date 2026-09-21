"use client";
import { useEffect, useState } from "react";
import { getOdjeli, createOdjel, updateOdjel, deleteOdjel } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { Odjel } from "@/lib/types";

export default function OdjeliPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const [odjeli, setOdjeli] = useState<Odjel[]>([]);
  const [form, setForm] = useState({ naziv: "", broj: "", povrsina: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !session) router.replace("/login/");
    if (!authLoading && session?.role !== "admin") router.replace("/");
  }, [session, authLoading]);

  async function load() {
    setOdjeli(await getOdjeli());
  }

  useEffect(() => { load(); }, []);

  if (authLoading || !session) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (editId) {
      await updateOdjel(editId, {
        naziv: form.naziv,
        broj: form.broj,
        povrsina: parseFloat(form.povrsina),
      });
    } else {
      await createOdjel({
        naziv: form.naziv,
        broj: form.broj,
        povrsina: parseFloat(form.povrsina),
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

  async function handleDelete(id: string) {
    if (!confirm("Obrisati odjel?")) return;
    await deleteOdjel(id);
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
                <td className="px-4 py-3 text-right text-gray-500">{o._count?.inzinjeri ?? 0}</td>
                <td className="px-4 py-3 text-right text-gray-500">{o._count?.unosi ?? 0}</td>
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
