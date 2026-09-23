"use client";
import { useEffect, useState, useMemo } from "react";
import { getOdjeli, getKorisnici, getUnosiZaDan, createUnos, updateUnos, deleteUnos } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { Odjel, UnosRada, VrstaRada, Korisnik } from "@/lib/types";
import { ConfirmModal } from "@/components/ConfirmModal";
import { fmtDate, fmtDateLong } from "@/lib/format";

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const RECENT_KOR_KEY = "ppnext_recent_kor";
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

type BatchRow = {
  rowId: string;
  inzinjerId: string;
  odjelId: string;
  vrsta: VrstaRada;
  brojStabala: string;
  hektari: string;
  kilometri: string;
  napomena: string;
};

const newRow = (): BatchRow => ({
  rowId: Math.random().toString(36).slice(2),
  inzinjerId: "", odjelId: "", vrsta: "DOZNAKA",
  brojStabala: "", hektari: "", kilometri: "", napomena: "",
});

const emptyEditForm = () => ({
  inzinjerId: "", odjelId: "", vrsta: "DOZNAKA" as VrstaRada,
  brojStabala: "", hektari: "", kilometri: "", napomena: "",
});

const inputCls = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500";
const inputSmCls = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-green-500";
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

function displayName(u: UnosRada): string {
  if (u.korisnik) return u.korisnik.fullName || u.korisnik.ime;
  if (u.inzinjer) return `${u.inzinjer.prezime} ${u.inzinjer.ime}`.trim();
  return "–";
}

// ── BatchRowItem ───────────────────────────────────────────────────────────────

function BatchRowItem({
  row, idx, korisnici, odjeli, isDuplicate, onChange, onRemove,
}: {
  row: BatchRow;
  idx: number;
  korisnici: Korisnik[];
  odjeli: Odjel[];
  isDuplicate: boolean;
  onChange: (patch: Partial<BatchRow>) => void;
  onRemove: () => void;
}) {
  const selectedKor = korisnici.find((k) => k.id === row.inzinjerId);
  const availOdjeli = selectedKor?.odjeliIds?.length
    ? odjeli.filter((o) => selectedKor.odjeliIds.includes(o.id))
    : odjeli;
  const sortedOdjeli = [...availOdjeli].sort((a, b) =>
    String(a.gj + a.broj).localeCompare(String(b.gj + b.broj))
  );
  const sortedKor = [...korisnici].sort((a, b) =>
    (a.fullName || a.ime).localeCompare(b.fullName || b.ime)
  );

  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        isDuplicate
          ? "border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/20"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
      }`}
    >
      {isDuplicate && (
        <p className="text-xs text-red-600 dark:text-red-400 mb-2 flex items-center gap-1.5 font-medium">
          <span className="text-base leading-none">⚠</span>
          Ovaj projektant već ima unos za ovaj dan — red će biti preskočen
        </p>
      )}

      {/* Row number */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5 tabular-nums">
          {String(idx + 1).padStart(2, "0")}
        </span>
        <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 text-lg leading-none px-1 transition-colors"
          title="Ukloni red"
        >
          ×
        </button>
      </div>

      {/* Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {/* Projektant */}
        <div>
          <label className={labelCls}>Projektant</label>
          <select
            className={inputSmCls}
            value={row.inzinjerId}
            onChange={(e) => {
              const kor = korisnici.find((k) => k.id === e.target.value);
              const ids = kor?.odjeliIds ?? [];
              if (e.target.value) pushRecentId(RECENT_KOR_KEY, e.target.value);
              onChange({ inzinjerId: e.target.value, odjelId: ids.length === 1 ? ids[0] : "" });
            }}
          >
            <option value="">Odaberi projektanta...</option>
            {sortedKor.map((k) => (
              <option key={k.id} value={k.id}>{k.fullName || k.ime}</option>
            ))}
          </select>
        </div>

        {/* Odjel */}
        <div>
          <label className={labelCls}>Odjel</label>
          <select
            className={inputSmCls}
            value={row.odjelId}
            onChange={(e) => {
              if (e.target.value) pushRecentId(RECENT_ODJ_KEY, e.target.value);
              onChange({ odjelId: e.target.value });
            }}
          >
            <option value="">Odaberi odjel...</option>
            {sortedOdjeli.map((o) => (
              <option key={o.id} value={o.id}>{o.gj} / {o.broj}</option>
            ))}
          </select>
        </div>

        {/* Vrsta */}
        <div>
          <label className={labelCls}>Vrsta</label>
          <select
            className={inputSmCls}
            value={row.vrsta}
            onChange={(e) =>
              onChange({ vrsta: e.target.value as VrstaRada, brojStabala: "", hektari: "", kilometri: "" })
            }
          >
            {VRSTE.map((v) => (
              <option key={v} value={v}>{VRSTA_LABEL[v]}</option>
            ))}
          </select>
        </div>

        {/* Metric fields */}
        {row.vrsta === "DOZNAKA" && (
          <>
            <div>
              <label className={labelCls}>Broj stabala</label>
              <input
                type="number" min="1" className={inputSmCls} value={row.brojStabala}
                placeholder="0"
                onChange={(e) => onChange({ brojStabala: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Hektari (ha)</label>
              <input
                type="number" step="0.01" min="0" className={inputSmCls} value={row.hektari}
                placeholder="0.00"
                onChange={(e) => onChange({ hektari: e.target.value })}
              />
            </div>
          </>
        )}
        {row.vrsta === "VLAKA" && (
          <div>
            <label className={labelCls}>Kilometri (km)</label>
            <input
              type="number" step="0.01" min="0" className={inputSmCls} value={row.kilometri}
              placeholder="0.00"
              onChange={(e) => onChange({ kilometri: e.target.value })}
            />
          </div>
        )}

        {/* Napomena */}
        <div className={row.vrsta === "DOZNAKA" ? "" : "lg:col-span-2"}>
          <label className={labelCls}>Napomena</label>
          <input
            type="text" maxLength={200} className={inputSmCls} value={row.napomena}
            placeholder="(opcionalno)"
            onChange={(e) => onChange({ napomena: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ── EntryFields (edit mode) ────────────────────────────────────────────────────

type FormPatch = Partial<ReturnType<typeof emptyEditForm>>;

function EntryFields({
  form, korisnici, odjeli, showProjektant, onChange, onKorisnikChange,
}: {
  form: ReturnType<typeof emptyEditForm>;
  korisnici: Korisnik[];
  odjeli: Odjel[];
  showProjektant: boolean;
  onChange: (patch: FormPatch) => void;
  onKorisnikChange: (id: string) => void;
}) {
  const recentKorIds = typeof window !== "undefined" ? getRecentIds(RECENT_KOR_KEY) : [];
  const recentOdjIds = typeof window !== "undefined" ? getRecentIds(RECENT_ODJ_KEY) : [];

  const sortedKorisnici = [...korisnici].sort((a, b) => {
    const ai = recentKorIds.indexOf(a.id);
    const bi = recentKorIds.indexOf(b.id);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return (a.fullName || a.ime).localeCompare(b.fullName || b.ime);
  });

  const selectedKorisnik = korisnici.find((k) => k.id === form.inzinjerId);
  const availableOdjeliIds = selectedKorisnik?.odjeliIds ?? [];
  const availableOdjeli = availableOdjeliIds.length > 0
    ? odjeli.filter((o) => availableOdjeliIds.includes(o.id))
    : odjeli;

  const sortedOdjeli = [...availableOdjeli].sort((a, b) => {
    const ai = recentOdjIds.indexOf(a.id);
    const bi = recentOdjIds.indexOf(b.id);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return String(a.gj + a.broj).localeCompare(String(b.gj + b.broj));
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {showProjektant && (
        <div>
          <label className={labelCls}>Projektant</label>
          <select className={inputCls} value={form.inzinjerId}
            onChange={(e) => { if (e.target.value) pushRecentId(RECENT_KOR_KEY, e.target.value); onKorisnikChange(e.target.value); }} required>
            <option value="">Odaberi projektanta...</option>
            {sortedKorisnici.map((k) => (
              <option key={k.id} value={k.id}>{k.fullName || k.ime}</option>
            ))}
          </select>
        </div>
      )}
      {showProjektant && (
        <div>
          <label className={labelCls}>Odjel</label>
          <select className={inputCls} value={form.odjelId}
            onChange={(e) => { if (e.target.value) pushRecentId(RECENT_ODJ_KEY, e.target.value); onChange({ odjelId: e.target.value }); }} required>
            <option value="">Odaberi odjel...</option>
            {sortedOdjeli.map((o) => (
              <option key={o.id} value={o.id}>{o.gj} / {o.broj}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className={labelCls}>Vrsta</label>
        <select className={inputCls} value={form.vrsta}
          onChange={(e) => onChange({ vrsta: e.target.value as VrstaRada, brojStabala: "", hektari: "", kilometri: "" })}>
          {VRSTE.map((v) => <option key={v} value={v}>{VRSTA_LABEL[v]}</option>)}
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UnosUcinkaPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const canAccess = session?.role === "admin" || session?.operater === true;

  const [datum, setDatum] = useState(today());
  const [unosi, setUnosi] = useState<UnosRada[]>([]);
  const [odjeli, setOdjeli] = useState<Odjel[]>([]);
  const [korisnici, setKorisnici] = useState<Korisnik[]>([]);
  const [fetching, setFetching] = useState(false);

  // Batch add
  const [showBatch, setShowBatch] = useState(false);
  const [batchRows, setBatchRows] = useState<BatchRow[]>([newRow()]);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchMsg, setBatchMsg] = useState("");

  // Edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm());
  const [editSaving, setEditSaving] = useState(false);

  const [confirmState, setConfirmState] = useState<{ msg: string; onOk: () => void } | null>(null);

  useEffect(() => {
    if (!authLoading && !session) { router.replace("/login/"); return; }
    if (!authLoading && session && !canAccess) router.replace("/");
  }, [session, authLoading]);

  useEffect(() => {
    Promise.all([getOdjeli(), getKorisnici()]).then(([od, kor]) => {
      setOdjeli(od);
      setKorisnici(kor.filter((k) => k.role === "worker"));
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

  // Workers that already have an entry for this day
  const existingWorkerIds = useMemo(
    () => new Set(unosi.map((u) => u.inzinjerId)),
    [unosi]
  );

  function isRowDuplicate(row: BatchRow, rowIdx: number): boolean {
    if (!row.inzinjerId) return false;
    if (existingWorkerIds.has(row.inzinjerId)) return true;
    return batchRows.some((r, i) => i < rowIdx && r.inzinjerId === row.inzinjerId);
  }

  const validRows = batchRows.filter((r, i) => r.inzinjerId && r.odjelId && !isRowDuplicate(r, i));
  const duplicateRows = batchRows.filter((r, i) => r.inzinjerId && isRowDuplicate(r, i));

  function updateBatchRow(idx: number, patch: Partial<BatchRow>) {
    setBatchRows((rows) => rows.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }

  function removeBatchRow(idx: number) {
    setBatchRows((rows) => rows.filter((_, i) => i !== idx));
  }

  function openBatch() {
    setBatchRows([newRow()]);
    setBatchMsg("");
    setShowBatch(true);
    setEditId(null);
  }

  function closeBatch() {
    setShowBatch(false);
    setBatchRows([newRow()]);
    setBatchMsg("");
  }

  async function saveBatch() {
    if (validRows.length === 0) return;
    setBatchSaving(true);
    try {
      await Promise.all(
        validRows.map((r) =>
          createUnos({
            datum,
            vrsta: r.vrsta,
            inzinjerId: r.inzinjerId,
            odjelId: r.odjelId,
            brojStabala: r.vrsta === "DOZNAKA" && r.brojStabala ? Number(r.brojStabala) : undefined,
            hektari: r.vrsta === "DOZNAKA" && r.hektari ? Number(r.hektari) : undefined,
            kilometri: r.vrsta === "VLAKA" && r.kilometri ? Number(r.kilometri) : undefined,
            napomena: r.napomena || undefined,
            createdById: session!.userId,
            createdByRole: session!.role,
          })
        )
      );
      const fresh = await getUnosiZaDan(datum);
      setUnosi(fresh);
      const skipped = duplicateRows.length;
      setBatchMsg(
        `Sačuvano ${validRows.length} unos${validRows.length !== 1 ? "a" : ""}${skipped > 0 ? ` · ${skipped} preskočen${skipped > 1 ? "ih" : ""}` : ""} ✓`
      );
      setBatchRows([newRow()]);
      setTimeout(() => setBatchMsg(""), 4000);
    } finally {
      setBatchSaving(false);
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
    setShowBatch(false);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setEditSaving(true);
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
      setEditSaving(false);
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

  function handleKorisnikChange(korisnikId: string, setter: (v: Partial<ReturnType<typeof emptyEditForm>>) => void) {
    const kor = korisnici.find((k) => k.id === korisnikId);
    const odjeliIds = kor?.odjeliIds ?? [];
    const odjelId = odjeliIds.length === 1 ? odjeliIds[0] : "";
    setter({ inzinjerId: korisnikId, odjelId });
  }

  const batchLabel =
    validRows.length > 0
      ? `Sačuvaj ${validRows.length} unos${validRows.length === 1 ? "" : "a"}`
      : "Sačuvaj";

  return (
    <div className="py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mr-auto">Unos učinka</h1>
        <button
          onClick={() => { setDatum(prevDay(datum)); setEditId(null); closeBatch(); }}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
        >‹</button>
        <input
          type="date"
          value={datum}
          onChange={(e) => { setDatum(e.target.value); setEditId(null); closeBatch(); }}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
        <button
          onClick={() => { setDatum(nextDay(datum)); setEditId(null); closeBatch(); }}
          disabled={datum >= today()}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-40"
        >›</button>
        <button
          onClick={showBatch ? closeBatch : openBatch}
          className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors ${
            showBatch
              ? "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
              : "bg-green-700 text-white hover:bg-green-800"
          }`}
        >
          {showBatch ? "Zatvori" : "+ Dodaj unose"}
        </button>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 capitalize">{fmtDateLong(datum)}</p>

      {/* Batch success message */}
      {batchMsg && (
        <div className="mb-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-lg px-4 py-2.5 text-sm">
          {batchMsg}
        </div>
      )}

      {/* Batch add panel */}
      {showBatch && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-green-300 dark:border-green-700 shadow-sm mb-5 overflow-hidden">
          {/* Panel header */}
          <div className="px-5 py-3.5 border-b border-green-200 dark:border-green-700 bg-green-50/60 dark:bg-green-950/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold text-green-800 dark:text-green-200">Grupni unos</span>
              <span className="text-xs text-green-600 dark:text-green-500">{fmtDate(datum)}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-500 dark:text-gray-400">
                {batchRows.length} red{batchRows.length !== 1 ? "a" : ""}
              </span>
              {duplicateRows.length > 0 && (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  {duplicateRows.length} duplikat{duplicateRows.length > 1 ? "a" : ""}
                </span>
              )}
            </div>
          </div>

          {/* Rows */}
          <div className="p-4 space-y-2.5">
            {batchRows.map((row, idx) => (
              <BatchRowItem
                key={row.rowId}
                row={row}
                idx={idx}
                korisnici={korisnici}
                odjeli={odjeli}
                isDuplicate={isRowDuplicate(row, idx)}
                onChange={(patch) => updateBatchRow(idx, patch)}
                onRemove={() => removeBatchRow(idx)}
              />
            ))}

            {/* Add row button */}
            <button
              type="button"
              onClick={() => setBatchRows((rows) => [...rows, newRow()])}
              className="w-full py-2.5 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:border-green-500 hover:text-green-700 dark:hover:border-green-500 dark:hover:text-green-400 transition-colors"
            >
              + Dodaj red
            </button>
          </div>

          {/* Footer actions */}
          <div className="px-4 pb-4 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={saveBatch}
              disabled={batchSaving || validRows.length === 0}
              className="bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50 transition-colors"
            >
              {batchSaving ? "Snimam..." : batchLabel}
            </button>
            <button
              type="button"
              onClick={closeBatch}
              className="border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Odustani
            </button>
            {duplicateRows.length > 0 && (
              <span className="text-xs text-amber-600 dark:text-amber-400 ml-1">
                {duplicateRows.length} red{duplicateRows.length > 1 ? "a" : ""} će biti preskočen{duplicateRows.length > 1 ? "i" : ""}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Entries table */}
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
                  <th className="px-4 py-3 w-24" />
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
                            korisnici={korisnici}
                            odjeli={odjeli}
                            showProjektant
                            onChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
                            onKorisnikChange={(id) =>
                              handleKorisnikChange(id, (patch) => setEditForm((f) => ({ ...f, ...patch })))
                            }
                          />
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={editSaving}
                              className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50"
                            >
                              {editSaving ? "Snimam..." : "Ažuriraj"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditId(null)}
                              className="border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              Odustani
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={u.id}
                      className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {displayName(u)}
                          {u.createdById && u.createdById === u.inzinjerId && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                              ↑ sam/a
                            </span>
                          )}
                        </div>
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
                          <>
                            {u.brojStabala != null ? `${u.brojStabala} st` : ""}
                            {u.hektari != null ? ` · ${u.hektari.toFixed(2)} ha` : ""}
                          </>
                        )}
                        {u.vrsta === "VLAKA" && u.kilometri != null && `${u.kilometri.toFixed(2)} km`}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 italic">
                        {u.napomena ?? ""}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => startEdit(u)}
                          className="text-blue-600 dark:text-blue-400 hover:underline text-xs mr-3"
                        >
                          Uredi
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="text-red-500 dark:text-red-400 hover:underline text-xs"
                        >
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
