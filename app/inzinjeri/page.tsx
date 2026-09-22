"use client";
import { useEffect, useState } from "react";
import { getInzinjeri, getOdjeli, getKorisnici, createInzinjer, updateInzinjer, deleteInzinjer } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { Inzinjer, Odjel, Korisnik } from "@/lib/types";
import { ConfirmModal } from "@/components/ConfirmModal";

export default function InzinjeriPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const [inzinjeri, setInzinjeri] = useState<Inzinjer[]>([]);
  const [odjeli, setOdjeli] = useState<Odjel[]>([]);
  const [korisnici, setKorisnici] = useState<Korisnik[]>([]);
  const [form, setForm] = useState({ ime: "", prezime: "", email: "", odjelId: "", korisnikId: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmState, setConfirmState] = useState<{ msg: string; onOk: () => void } | null>(null);

  useEffect(() => {
    if (!authLoading && !session) router.replace("/login/");
    if (!authLoading && session?.role !== "admin") router.replace("/");
  }, [session, authLoading]);

  async function load() {
    const [inz, od, kor] = await Promise.all([getInzinjeri(), getOdjeli(), getKorisnici()]);
    setInzinjeri(inz);
    setOdjeli(od);
    setKorisnici(kor);
  }

  useEffect(() => { load(); }, []);

  if (authLoading || !session) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, korisnikId: form.korisnikId || null };
      if (editId) {
        await updateInzinjer(editId, payload);
      } else {
        await createInzinjer(payload);
      }
      setForm({ ime: "", prezime: "", email: "", odjelId: "", korisnikId: "" });
      setEditId(null);
    } catch {
      // forma ostaje popunjena da korisnik može ponoviti
    } finally {
      setLoading(false);
      load();
    }
  }

  function startEdit(i: Inzinjer) {
    setEditId(i.id);
    setForm({ ime: i.ime, prezime: i.prezime, email: i.email || "", odjelId: i.odjelId, korisnikId: i.korisnikId || "" });
  }

  function handleDelete(id: string) {
    setConfirmState({
      msg: "Obrisati ovog projektanta? Ova akcija je nepovratna.",
      onOk: async () => {
        setConfirmState(null);
        await deleteInzinjer(id);
        load();
      },
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Projektanti</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Ime</label>
          <input
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            value={form.ime}
            onChange={(e) => setForm({ ...form, ime: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Prezime</label>
          <input
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            value={form.prezime}
            onChange={(e) => setForm({ ...form, prezime: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">E-mail (opciono)</label>
          <input
            type="email"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Odjel</label>
          <select
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            value={form.odjelId}
            onChange={(e) => setForm({ ...form, odjelId: e.target.value })}
            required
          >
            <option value="">Odaberi odjel...</option>
            {odjeli.map((o) => (
              <option key={o.id} value={o.id}>
                {o.gj} / {o.broj}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Korisnički nalog (opciono)</label>
          <select
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            value={form.korisnikId}
            onChange={(e) => setForm({ ...form, korisnikId: e.target.value })}
          >
            <option value="">— Bez naloga —</option>
            {korisnici.map((k) => (
              <option key={k.id} value={k.id}>
                {k.fullName} ({k.ime})
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
              onClick={() => { setEditId(null); setForm({ ime: "", prezime: "", email: "", odjelId: "", korisnikId: "" }); }}
              className="border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Odustani
            </button>
          )}
        </div>
      </form>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Ime i prezime</th>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">E-mail</th>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Odjel</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {inzinjeri.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Nema projektanata. Dodajte prvog projektanta.
                </td>
              </tr>
            )}
            {inzinjeri.map((i) => (
              <tr key={i.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{i.prezime} {i.ime}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{i.email || "–"}</td>
                <td className="px-4 py-3">
                  <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs px-2 py-0.5 rounded-full">
                    {i.odjel?.gj} / {i.odjel?.broj}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => startEdit(i)} className="text-blue-600 dark:text-blue-400 hover:underline mr-3 text-xs">Uredi</button>
                  <button onClick={() => handleDelete(i.id)} className="text-red-500 dark:text-red-400 hover:underline text-xs">Obriši</button>
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
