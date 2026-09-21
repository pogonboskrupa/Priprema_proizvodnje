"use client";
import { useEffect, useState } from "react";
import { getOdjeli, getInzinjeri, getUnosi, createUnos, deleteUnos } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { Odjel, Inzinjer, UnosRada, VrstaRada } from "@/lib/types";
import { ConfirmModal } from "@/components/ConfirmModal";
import { exportXlsx } from "@/lib/export";

const today = () => new Date().toISOString().split("T")[0];
const currentMonth = () => new Date().toISOString().slice(0, 7);

function getMonthOptions() {
  const opts: { val: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("bs-BA", { month: "long", year: "numeric" });
    opts.push({ val, label });
  }
  return opts;
}

export default function UnosPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const [odjeli, setOdjeli] = useState<Odjel[]>([]);
  const [inzinjeri, setInzinjeri] = useState<Inzinjer[]>([]);
  const [unosi, setUnosi] = useState<UnosRada[]>([]);
  const [filterMjesec, setFilterMjesec] = useState(currentMonth);
  const [confirmState, setConfirmState] = useState<{ msg: string; onOk: () => void } | null>(null);
  const [form, setForm] = useState({
    datum: today(),
    vrsta: "DOZNAKA" as VrstaRada,
    inzinjerId: "",
    odjelId: "",
    brojStabala: "",
    hektari: "",
    kilometri: "",
    napomena: "",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!authLoading && !session) router.replace("/login/");
  }, [session, authLoading]);

  async function load() {
    const [od, inz, un] = await Promise.all([getOdjeli(), getInzinjeri(), getUnosi()]);
    setOdjeli(od);
    setInzinjeri(inz);
    setUnosi(un);
  }

  useEffect(() => { load(); }, []);

  if (authLoading || !session) return null;

  function handleInzinjerChange(id: string) {
    const inz = inzinjeri.find((i) => i.id === id);
    setForm((f) => ({
      ...f,
      inzinjerId: id,
      odjelId: inz ? inz.odjelId : f.odjelId,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      await createUnos({
        datum: form.datum,
        vrsta: form.vrsta,
        inzinjerId: form.inzinjerId,
        odjelId: form.odjelId,
        brojStabala: form.brojStabala ? Number(form.brojStabala) : undefined,
        hektari: form.hektari ? Number(form.hektari) : undefined,
        kilometri: form.kilometri ? Number(form.kilometri) : undefined,
        napomena: form.napomena || undefined,
      });
      setMsg("Unos je sačuvan!");
      setForm({
        datum: today(),
        vrsta: form.vrsta,
        inzinjerId: form.inzinjerId,
        odjelId: form.odjelId,
        brojStabala: "",
        hektari: "",
        kilometri: "",
        napomena: "",
      });
      load();
    } catch {
      setMsg("Greška pri unosu.");
    }
    setLoading(false);
    setTimeout(() => setMsg(""), 3000);
  }

  function handleDelete(id: string) {
    setConfirmState({
      msg: "Obrisati ovaj unos?",
      onOk: async () => {
        setConfirmState(null);
        await deleteUnos(id);
        load();
      },
    });
  }

  const filteredUnosi = filterMjesec
    ? unosi.filter((u) => u.datum.slice(0, 7) === filterMjesec)
    : unosi;

  function handleExport() {
    const rows = filteredUnosi.map((u) => ({
      Datum: new Date(u.datum).toLocaleDateString("bs-BA"),
      Inžinjer: `${u.inzinjer?.prezime ?? ""} ${u.inzinjer?.ime ?? ""}`.trim(),
      Odjel: u.odjel?.broj ?? "",
      Vrsta: u.vrsta,
      "Hektari (ha)": u.hektari ?? "",
      Stabala: u.brojStabala ?? "",
      "Vlake (km)": u.kilometri ?? "",
      Napomena: u.napomena ?? "",
    }));
    exportXlsx(rows, `unosi-${filterMjesec}`);
  }

  const filteredInzinjeri = form.odjelId
    ? inzinjeri.filter((i) => i.odjelId === form.odjelId)
    : inzinjeri;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Unos rada</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-5 space-y-4">
            <h2 className="font-semibold text-gray-700">Novi unos</h2>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Datum</label>
              <input
                type="date"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.datum}
                onChange={(e) => setForm({ ...form, datum: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vrsta rada</label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                {(["DOZNAKA", "VLAKA"] as VrstaRada[]).map((v) => (
                  <label
                    key={v}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg border-2 cursor-pointer text-sm font-medium transition-colors ${
                      form.vrsta === v
                        ? "border-green-600 bg-green-50 text-green-700"
                        : "border-gray-300 text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    <input type="radio" className="hidden" value={v} checked={form.vrsta === v} onChange={() => setForm({ ...form, vrsta: v })} />
                    {v === "DOZNAKA" ? "🌳 Doznaka" : "🛤️ Vlake"}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["GODISNJI", "KANCELARIJA", "BOLOVANJE"] as VrstaRada[]).map((v) => (
                  <label
                    key={v}
                    className={`flex items-center justify-center gap-1 py-2 rounded-lg border-2 cursor-pointer text-xs font-medium transition-colors text-center ${
                      form.vrsta === v
                        ? "border-amber-500 bg-amber-50 text-amber-700"
                        : "border-gray-300 text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    <input type="radio" className="hidden" value={v} checked={form.vrsta === v} onChange={() => setForm({ ...form, vrsta: v })} />
                    {v === "GODISNJI" ? "🏖️ God. odmor" : v === "KANCELARIJA" ? "🏢 Kancelarija" : "🏥 Bolovanje"}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Odjel</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.odjelId}
                onChange={(e) => setForm({ ...form, odjelId: e.target.value, inzinjerId: "" })}
              >
                <option value="">Svi odjeli</option>
                {odjeli.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.broj} – {o.naziv}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Inžinjer</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.inzinjerId}
                onChange={(e) => handleInzinjerChange(e.target.value)}
                required
              >
                <option value="">Odaberi inžinjera...</option>
                {filteredInzinjeri.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.prezime} {i.ime} ({i.odjel?.broj})
                  </option>
                ))}
              </select>
            </div>

            {form.vrsta === "DOZNAKA" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Broj stabala</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.brojStabala}
                    onChange={(e) => setForm({ ...form, brojStabala: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Hektari (ha)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.hektari}
                    onChange={(e) => setForm({ ...form, hektari: e.target.value })}
                    required
                  />
                </div>
              </div>
            )}
            {form.vrsta === "VLAKA" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Kilometri vlaka (km)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.kilometri}
                  onChange={(e) => setForm({ ...form, kilometri: e.target.value })}
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Napomena (opciono)</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                rows={2}
                value={form.napomena}
                onChange={(e) => setForm({ ...form, napomena: e.target.value })}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-700 text-white py-2.5 rounded-lg font-medium hover:bg-green-800 disabled:opacity-50 transition-colors"
            >
              {loading ? "Čuvanje..." : "Sačuvaj unos"}
            </button>

            {msg && (
              <div className={`text-sm text-center py-2 rounded-lg ${msg.includes("Greška") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                {msg}
              </div>
            )}
          </form>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50 flex flex-wrap items-center gap-3">
              <h2 className="font-semibold text-gray-700 mr-auto">Unosi</h2>
              <select
                className="border rounded-lg px-2 py-1.5 text-xs"
                value={filterMjesec}
                onChange={(e) => setFilterMjesec(e.target.value)}
              >
                {getMonthOptions().map((o) => (
                  <option key={o.val} value={o.val}>{o.label}</option>
                ))}
              </select>
              <button
                onClick={handleExport}
                disabled={filteredUnosi.length === 0}
                className="bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-800 disabled:opacity-40"
              >
                Export XLSX
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Datum</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Inžinjer</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Odjel</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Vrsta</th>
                    <th className="text-right px-4 py-2 text-gray-600 font-medium">Količina</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUnosi.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-gray-500">
                        {unosi.length === 0 ? "Nema unosa. Dodajte prvi unos." : "Nema unosa za odabrani mjesec."}
                      </td>
                    </tr>
                  )}
                  {filteredUnosi.map((u) => (
                    <tr key={u.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-xs">
                        {new Date(u.datum).toLocaleDateString("bs-BA")}
                      </td>
                      <td className="px-4 py-2">
                        {u.inzinjer?.prezime} {u.inzinjer?.ime}
                      </td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{u.odjel?.broj}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${vrstaBadgeClass(u.vrsta)}`}>
                          {vrstaLabel(u.vrsta)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-gray-600">
                        {u.vrsta === "DOZNAKA" ? (
                          <span>
                            <span className="font-semibold text-gray-800">{u.brojStabala}</span> st /{" "}
                            <span className="font-semibold text-gray-800">{u.hektari?.toFixed(2)}</span> ha
                          </span>
                        ) : u.vrsta === "VLAKA" ? (
                          <span>
                            <span className="font-semibold text-gray-800">{u.kilometri?.toFixed(2)}</span> km
                          </span>
                        ) : (
                          <span className="text-gray-400">–</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="text-red-500 hover:text-red-700 text-xs"
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
        </div>
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

function vrstaLabel(vrsta: string): string {
  const map: Record<string, string> = {
    DOZNAKA: "🌳 Doznaka",
    VLAKA: "🛤️ Vlake",
    GODISNJI: "🏖️ God. odmor",
    KANCELARIJA: "🏢 Kancelarija",
    BOLOVANJE: "🏥 Bolovanje",
  };
  return map[vrsta] ?? vrsta;
}

function vrstaBadgeClass(vrsta: string): string {
  const map: Record<string, string> = {
    DOZNAKA: "bg-green-100 text-green-800",
    VLAKA: "bg-amber-100 text-amber-800",
    GODISNJI: "bg-sky-100 text-sky-800",
    KANCELARIJA: "bg-violet-100 text-violet-800",
    BOLOVANJE: "bg-red-100 text-red-800",
  };
  return map[vrsta] ?? "bg-gray-100 text-gray-700";
}
