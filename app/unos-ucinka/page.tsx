"use client";
import { useEffect, useState } from "react";
import { getOdjeli, getInzinjeri, getKorisnici, getUnosiZaDan, createUnos, updateUnos, deleteUnos } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { Odjel, Inzinjer, UnosRada, VrstaRada, Korisnik } from "@/lib/types";
import { ConfirmModal } from "@/components/ConfirmModal";
import { fmtDate, fmtDateLong } from "@/lib/format";

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const RECENT_INZ_KEY = "ppnext_recent_inz";
const RECENT_ODJ_KEY = "ppnext_recent_odj";

function getRecentIds(key: string): string[] {
  try { return JSON.parse(localStorage.getItem(key) ?? "[]"); } catch { return []; }
}
function pushRecentId(key: string, id: string) {
  try {
    const arr = [id, ...getRecentIds(key).filter((r) => r !== id)].slice(0, 20);
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {}
}

const VRSTE: VrstaRada[] = ["DOZNAKA", "VLAKA", "TEREN", "GODISNJI", "KANCELARIJA", "BOLOVANJE"];
const VRSTA_LABEL: Record<string, string> = {
  DOZNAKA: "Doznaka", VLAKA: "Vlaka", TEREN: "Teren",
  GODISNJI: "Godišnji", KANCELARIJA: "Kancelarija", BOLOVANJE: "Bolovanje",
};
const VRSTA_COLOR: Record<string, string> = {
  DOZNAKA: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
  VLAKA: "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200",
  TEREN: "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200",
  GODISNJI: "bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200",
  KANCELARIJA: "bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200",
  BOLOVANJE: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
};

const emptyForm = () => ({
  inzinjerId: "", odjelId: "", vrsta: "DOZNAKA" as VrstaRada,
  brojStabala: "", hektari: "", kilometri: "", napomena: "",
});

const inputCls = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500";
const labelCls = "block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1";

function prevDay(d: string) {
  const dt = new Date(d + "T12:00:00");
  dt.setDate(dt.getDate() - 1);
  return dt.toISOString().split("T")[0];
}
function nextDay(d: string) {
  const dt = new Date(d + "T12:00:00");
  dt.setDate(dt.getDate() + 1);
  return dt.toISOString().split("T")[0];
}

export default function UnosUcinkaPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const canAccess = session?.role === "admin" || session?.operater === true;

  const [datum, setDatum] = useState(today());
  const [unosi, setUnosi] = useState<UnosRada[]>([]);
  const [odjeli, setOdjeli] = useState<Odjel[]>([]);
  const [inzinjeri, setInzinjeri] = useState<Inzinjer[]>([]);
  const [korisnici, setKorisnici] = useState<Korisnik[]>([]);
  const [fetching, setFetching] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm());
  const [confirmState, setConfirmState] = useState<{ msg: string; onOk: () => void } | null>(null);

  useEffect(() => {
    if (!authLoading && !session) { router.replace("/login/"); return; }
    if (!authLoading && session && !canAccess) router.replace("/");
  }, [session, authLoading]);

  useEffect(() => {
    Promise.all([getOdjeli(), getInzinjeri(), getKorisnici()]).then(([od, inz, kor]) => {
      setOdjeli(od);
      setInzinjeri(inz);
      setKorisnici(kor);
    });
  }, []);

  useEffect(() => {
    if (!session) return;
    setFetching(true);
    getUnosiZaDan(datum)
      .then(setUnosi)
      .finally(() => setFetching(false));
  }, [session, datum]);

  if (authLoading || !session) return null;

  function handleInzinjerChange(id: string, setter: (v: Partial<ReturnType<typeof emptyForm>>) => void) {
    const inz = inzinjeri.find((i) => i.id === id);
    setter({ inzinjerId: id, odjelId: inz?.odjelId ?? "" });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.inzinjerId) return;
    setSaving(true);
    try {
      await createUnos({
        datum,
        vrsta: addForm.vrsta,
        inzinjerId: addForm.inzinjerId,
        odjelId: addForm.odjelId,
        brojStabala: addForm.brojStabala ? Number(addForm.brojStabala) : undefined,
        hektari: addForm.hektari ? Number(addForm.hektari) : undefined,
        kilometri: addForm.kilometri ? Number(addForm.kilometri) : undefined,
        napomena: addForm.napomena || undefined,
      });
      setAddForm(emptyForm());
      setShowAdd(false);
      const fresh = await getUnosiZaDan(datum);
      setUnosi(fresh);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(u: UnosRada) {
    setEditId(u.id);
    setEditForm({
      inzinjerId: u.inzinjerId,
      odjelId: u.odjelId,
      vrsta: u.vrsta,
      brojStabala: u.brojStabala != null ? String(u.brojStabala) : "",
      hektari: u.hektari != null ? String(u.hektari) : "",
      kilometri: u.kilometri != null ? String(u.kilometri) : "",
      napomena: u.napomena ?? "",
    });
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setSaving(true);
    try {
      await updateUnos(editId, {
        vrsta: editForm.vrsta,
        inzinjerId: editForm.inzinjerId,
        odjelId: editForm.odjelId,
        brojStabala: editForm.vrsta === "DOZNAKA" && editForm.brojStabala ? Number(editForm.brojStabala) : null,
        hektari: editForm.vrsta === "DOZNAKA" && editForm.hektari ? Number(editForm.hektari) : null,
        kilometri: editForm.vrsta === "VLAKA" && editForm.kilometri ? Number(editForm.kilometri) : null,
        napomena: editForm.napomena || null,
      });
      setEditId(null);
      const fresh = await getUnosiZaDan(datum);
      setUnosi(fresh);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id: string) {
    setConfirmState({
      msg: "Obrisati ovaj unos?",
      onOk: async () => {
        setConfirmState(null);
        await deleteUnos(id);
        setUnosi((prev) => prev.filter((u) => u.id !== id));
      },
    });
  }

  return (
    <div className="py-6">
      {/* Header + navigacija datumom */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mr-auto">Unos učinka</h1>
        <button
          onClick={() => { setDatum(prevDay(datum)); setEditId(null); setShowAdd(false); }}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
        >‹</button>
        <input
          type="date"
          value={datum}
          onChange={(e) => { setDatum(e.target.value); setEditId(null); setShowAdd(false); }}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
        <button
          onClick={() => { setDatum(nextDay(datum)); setEditId(null); setShowAdd(false); }}
          disabled={datum >= today()}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-40"
        >›</button>
        <button
          onClick={() => { setShowAdd((v) => !v); setEditId(null); }}
          className="bg-green-700 text-white text-sm px-4 py-1.5 rounded-lg font-medium hover:bg-green-800"
        >
          + Dodaj unos
        </button>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 capitalize">{fmtDateLong(datum)}</p>

      {/* Forma za novi unos */}
      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="bg-white dark:bg-gray-900 rounded-xl border border-green-300 dark:border-green-700 shadow-sm p-5 mb-5 space-y-3"
        >
          <div className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">Novi unos</div>
          <EntryFields
            form={addForm}
            inzinjeri={inzinjeri}
            korisnici={korisnici}
            odjeli={odjeli}
            showInzinjer
            onChange={(patch) => setAddForm((f) => ({ ...f, ...patch }))}
            onInzinjerChange={(id) => handleInzinjerChange(id, (patch) => setAddForm((f) => ({ ...f, ...patch })))}
          />
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving || !addForm.inzinjerId} className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50">
              {saving ? "Snimam..." : "Sačuvaj"}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              Odustani
            </button>
          </div>
        </form>
      )}

      {/* Tabela unosa */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {fetching ? (
          <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">Učitavanje...</div>
        ) : unosi.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
            Nema unosa za {fmtDate(datum)}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Projektant</th>
                  <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Odjel</th>
                  <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Vrsta</th>
                  <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Detalji</th>
                  <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Napomena</th>
                  <th className="px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {unosi.map((u) =>
                  editId === u.id ? (
                    <tr key={u.id} className="border-t border-gray-100 dark:border-gray-800 bg-blue-50 dark:bg-blue-950/30">
                      <td colSpan={6} className="px-4 py-3">
                        <form onSubmit={handleSaveEdit} className="space-y-3">
                          <EntryFields
                            form={editForm}
                            inzinjeri={inzinjeri}
                            korisnici={korisnici}
                            odjeli={odjeli}
                            showInzinjer
                            onChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
                            onInzinjerChange={(id) => handleInzinjerChange(id, (patch) => setEditForm((f) => ({ ...f, ...patch })))}
                          />
                          <div className="flex gap-2">
                            <button type="submit" disabled={saving} className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50">
                              {saving ? "Snimam..." : "Ažuriraj"}
                            </button>
                            <button type="button" onClick={() => setEditId(null)} className="border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                              Odustani
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr key={u.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {u.inzinjer?.prezime} {u.inzinjer?.ime}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {u.odjel?.gj}/{u.odjel?.broj}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${VRSTA_COLOR[u.vrsta] ?? ""}`}>
                          {VRSTA_LABEL[u.vrsta]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 tabular-nums">
                        {u.vrsta === "DOZNAKA" && (
                          <>{u.brojStabala != null ? `${u.brojStabala} st` : ""}
                            {u.hektari != null ? ` · ${u.hektari.toFixed(2)} ha` : ""}</>
                        )}
                        {u.vrsta === "VLAKA" && u.kilometri != null && `${u.kilometri.toFixed(2)} km`}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 italic">{u.napomena ?? ""}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => startEdit(u)} className="text-blue-600 dark:text-blue-400 hover:underline text-xs mr-3">
                          Uredi
                        </button>
                        <button onClick={() => handleDelete(u.id)} className="text-red-500 dark:text-red-400 hover:underline text-xs">
                          Obriši
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
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

type FormPatch = Partial<ReturnType<typeof emptyForm>>;

function EntryFields({
  form, inzinjeri, korisnici, odjeli, showInzinjer, onChange, onInzinjerChange,
}: {
  form: ReturnType<typeof emptyForm>;
  inzinjeri: Inzinjer[];
  korisnici: Korisnik[];
  odjeli: Odjel[];
  showInzinjer: boolean;
  onChange: (patch: FormPatch) => void;
  onInzinjerChange: (id: string) => void;
}) {
  const recentInzIds = typeof window !== "undefined" ? getRecentIds(RECENT_INZ_KEY) : [];
  const recentOdjIds = typeof window !== "undefined" ? getRecentIds(RECENT_ODJ_KEY) : [];

  const workers = korisnici.filter((k) => k.role === "worker");
  const items = workers.map((k) => ({
    korisnik: k,
    inz: inzinjeri.find((i) => i.korisnikId === k.id) ?? null,
  }));
  items.sort((a, b) => {
    const ai = a.inz ? recentInzIds.indexOf(a.inz.id) : -1;
    const bi = b.inz ? recentInzIds.indexOf(b.inz.id) : -1;
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return (a.korisnik.fullName || a.korisnik.ime).localeCompare(b.korisnik.fullName || b.korisnik.ime);
  });

  const sortedOdjeli = [...odjeli].sort((a, b) => {
    const ai = recentOdjIds.indexOf(a.id);
    const bi = recentOdjIds.indexOf(b.id);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return String(a.gj + a.broj).localeCompare(String(b.gj + b.broj));
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {showInzinjer && (
        <div>
          <label className={labelCls}>Projektant</label>
          <select
            className={inputCls}
            value={form.inzinjerId}
            onChange={(e) => {
              if (e.target.value) pushRecentId(RECENT_INZ_KEY, e.target.value);
              onInzinjerChange(e.target.value);
            }}
            required
          >
            <option value="">Odaberi projektanta...</option>
            {items.map(({ korisnik, inz }) => (
              <option key={korisnik.id} value={inz?.id ?? ""} disabled={!inz}>
                {korisnik.fullName || korisnik.ime}
              </option>
            ))}
          </select>
        </div>
      )}
      {showInzinjer && (
        <div>
          <label className={labelCls}>Odjel</label>
          <select
            className={inputCls}
            value={form.odjelId}
            onChange={(e) => {
              if (e.target.value) pushRecentId(RECENT_ODJ_KEY, e.target.value);
              onChange({ odjelId: e.target.value });
            }}
            required
          >
            <option value="">Odaberi odjel...</option>
            {sortedOdjeli.map((o) => (
              <option key={o.id} value={o.id}>{o.gj} / {o.broj}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className={labelCls}>Vrsta</label>
        <select
          className={inputCls}
          value={form.vrsta}
          onChange={(e) => onChange({ vrsta: e.target.value as VrstaRada, brojStabala: "", hektari: "", kilometri: "" })}
        >
          {VRSTE.map((v) => (
            <option key={v} value={v}>{VRSTA_LABEL[v]}</option>
          ))}
        </select>
      </div>
      {form.vrsta === "DOZNAKA" && (
        <>
          <div>
            <label className={labelCls}>Broj stabala</label>
            <input type="number" min="1" className={inputCls} value={form.brojStabala}
              onChange={(e) => onChange({ brojStabala: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Hektari (ha)</label>
            <input type="number" step="0.01" min="0" className={inputCls} value={form.hektari}
              onChange={(e) => onChange({ hektari: e.target.value })} />
          </div>
        </>
      )}
      {form.vrsta === "VLAKA" && (
        <div>
          <label className={labelCls}>Kilometri (km)</label>
          <input type="number" step="0.01" min="0" className={inputCls} value={form.kilometri}
            onChange={(e) => onChange({ kilometri: e.target.value })} />
        </div>
      )}
      <div>
        <label className={labelCls}>Napomena</label>
        <input type="text" maxLength={200} className={inputCls} value={form.napomena}
          onChange={(e) => onChange({ napomena: e.target.value })} />
      </div>
    </div>
  );
}
