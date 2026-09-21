"use client";
import { useEffect, useState } from "react";
import { getInzinjeri, getOdjeli, createInzinjer, updateInzinjer, deleteInzinjer } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { Inzinjer, Odjel } from "@/lib/types";
import { ConfirmModal } from "@/components/ConfirmModal";

export default function InzinjeriPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const [inzinjeri, setInzinjeri] = useState<Inzinjer[]>([]);
  const [odjeli, setOdjeli] = useState<Odjel[]>([]);
  const [form, setForm] = useState({ ime: "", prezime: "", email: "", odjelId: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmState, setConfirmState] = useState<{ msg: string; onOk: () => void } | null>(null);

  useEffect(() => {
    if (!authLoading && !session) router.replace("/login/");
    if (!authLoading && session?.role !== "admin") router.replace("/");
  }, [session, authLoading]);

  async function load() {
    const [inz, od] = await Promise.all([getInzinjeri(), getOdjeli()]);
    setInzinjeri(inz);
    setOdjeli(od);
  }

  useEffect(() => { load(); }, []);

  if (authLoading || !session) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (editId) {
      await updateInzinjer(editId, form);
    } else {
      await createInzinjer(form);
    }
    setForm({ ime: "", prezime: "", email: "", odjelId: "" });
    setEditId(null);
    setLoading(false);
    load();
  }

  function startEdit(i: Inzinjer) {
    setEditId(i.id);
    setForm({ ime: i.ime, prezime: i.prezime, email: i.email || "", odjelId: i.odjelId });
  }

  function handleDelete(id: string) {
    setConfirmState({
      msg: "Obrisati ovog inžinjera? Ova akcija je nepovratna.",
      onOk: async () => {
        setConfirmState(null);
        await deleteInzinjer(id);
        load();
      },
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Inžinjeri</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border p-5 mb-6 grid grid-cols-1 sm:grid-cols-5 gap-3"
      >
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Ime</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.ime}
            onChange={(e) => setForm({ ...form, ime: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Prezime</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.prezime}
            onChange={(e) => setForm({ ...form, prezime: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">E-mail (opciono)</label>
          <input
            type="email"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Odjel</label>
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.odjelId}
            onChange={(e) => setForm({ ...form, odjelId: e.target.value })}
            required
          >
            <option value="">Odaberi odjel...</option>
            {odjeli.map((o) => (
              <option key={o.id} value={o.id}>
                {o.broj} – {o.naziv}
              </option>
            ))}
          </select>
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
              onClick={() => { setEditId(null); setForm({ ime: "", prezime: "", email: "", odjelId: "" }); }}
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
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Ime i prezime</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">E-mail</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Odjel</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {inzinjeri.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-gray-500">
                  Nema inžinjera. Dodajte prvog inžinjera.
                </td>
              </tr>
            )}
            {inzinjeri.map((i) => (
              <tr key={i.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{i.prezime} {i.ime}</td>
                <td className="px-4 py-3 text-gray-500">{i.email || "–"}</td>
                <td className="px-4 py-3">
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                    {i.odjel?.broj} – {i.odjel?.naziv}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => startEdit(i)} className="text-blue-600 hover:underline mr-3 text-xs">Uredi</button>
                  <button onClick={() => handleDelete(i.id)} className="text-red-500 hover:underline text-xs">Obriši</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
