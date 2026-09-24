"use client";
import { useEffect, useState, useMemo } from "react";
import { getOdjeli, getKorisnici, getUnosiZaDan, getUnosi, createUnos, updateUnos, deleteUnos } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { Odjel, UnosRada, VrstaRada, Korisnik } from "@/lib/types";
import { ConfirmModal } from "@/components/ConfirmModal";
import { fmtDate, fmtDateLong } from "@/lib/format";
import { recentOdjelIdsByInzinjer, splitOdjeliByRecent } from "@/lib/recent";

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const VRSTE: VrstaRada[] = ["DOZNAKA", "VLAKA", "TEREN", "GODISNJI", "KANCELARIJA", "BOLOVANJE"];
const NO_ODJEL_VRSTE = new Set<VrstaRada>(["TEREN", "GODISNJI", "KANCELARIJA", "BOLOVANJE"]);
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
const VRSTA_BTN_ACTIVE: Record<string, string> = {
  DOZNAKA: "bg-green-600 text-white border-green-600",
  VLAKA: "bg-amber-500 text-white border-amber-500",
  TEREN: "bg-orange-500 text-white border-orange-500",
  GODISNJI: "bg-sky-500 text-white border-sky-500",
  KANCELARIJA: "bg-indigo-500 text-white border-indigo-500",
  BOLOVANJE: "bg-red-500 text-white border-red-500",
};

type PendingRow = {
  odjelId: string;
  vrsta: VrstaRada | "";
  brojStabala: string;
  hektari: string;
  kilometri: string;
  napomena: string;
};

function emptyPending(): PendingRow {
  return { odjelId: "", vrsta: "", brojStabala: "", hektari: "", kilometri: "", napomena: "" };
}

const emptyEditForm = () => ({
  odjelId: "", vrsta: "DOZNAKA" as VrstaRada,
  brojStabala: "", hektari: "", kilometri: "", napomena: "",
});

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

function displayKorisnik(k: Korisnik) {
  return k.fullName || k.ime;
}

const inputSmCls = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-green-500";
const labelCls = "block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5";

// ── RosterNewRow ──────────────────────────────────────────────────────────────

function RosterNewRow({
  korisnik, pending, odjeli, recentOdjelIds, onUpdate, onSave, saving,
}: {
  korisnik: Korisnik;
  pending: PendingRow;
  odjeli: Odjel[];
  recentOdjelIds: string[];
  onUpdate: (patch: Partial<PendingRow>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const availOdjeli = korisnik.odjeliIds?.length
    ? odjeli.filter((o) => korisnik.odjeliIds.includes(o.id))
    : odjeli;
  const { recent: recentOdjeli, rest: sortedOdjeli } = splitOdjeliByRecent(availOdjeli, recentOdjelIds);

  const noOdjelNeeded = pending.vrsta ? NO_ODJEL_VRSTE.has(pending.vrsta) : false;
  const isReady = !!(pending.vrsta && (noOdjelNeeded || pending.odjelId));

  return (
    <div className="px-3 py-3 space-y-2">
      {/* Name + save button */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 leading-tight">
          {displayKorisnik(korisnik)}
        </span>
        {isReady && (
          <button
            onClick={onSave}
            disabled={saving}
            className="shrink-0 text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold transition-colors"
          >
            {saving ? "..." : "Sačuvaj"}
          </button>
        )}
      </div>

      {/* Odjel + Vrsta chips row */}
      <div className="flex flex-wrap items-start gap-2">
        {!noOdjelNeeded && (
          <div className="shrink-0" style={{ minWidth: 200 }}>
            <select
              className={inputSmCls}
              value={pending.odjelId}
              onChange={(e) => onUpdate({ odjelId: e.target.value })}
            >
              <option value="">Odjel...</option>
              {recentOdjeli.length > 0 && (
                <optgroup label="Nedavno rađeni">
                  {recentOdjeli.map((o) => (
                    <option key={o.id} value={o.id}>{o.gj} / {o.broj}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label={recentOdjeli.length > 0 ? "Ostali odjeli" : "Odjeli"}>
                {sortedOdjeli.map((o) => (
                  <option key={o.id} value={o.id}>{o.gj} / {o.broj}</option>
                ))}
              </optgroup>
            </select>
          </div>
        )}

        <div className="flex flex-wrap gap-1">
          {VRSTE.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onUpdate({
                vrsta: pending.vrsta === v ? "" : v,
                brojStabala: "", hektari: "", kilometri: "",
              })}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                pending.vrsta === v
                  ? VRSTA_BTN_ACTIVE[v]
                  : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-900"
              }`}
            >
              {VRSTA_LABEL[v]}
            </button>
          ))}
        </div>
      </div>

      {/* Metric inputs (DOZNAKA / VLAKA only) */}
      {pending.vrsta === "DOZNAKA" && (
        <div className="flex gap-2 flex-wrap pl-0.5">
          <div className="w-24">
            <label className={labelCls}>Stabala</label>
            <input type="text" inputMode="decimal" className={inputSmCls}
              value={pending.brojStabala} placeholder="0"
              onChange={(e) => onUpdate({ brojStabala: e.target.value })} />
          </div>
          <div className="w-28">
            <label className={labelCls}>Hektari (ha)</label>
            <input type="text" inputMode="decimal" className={inputSmCls}
              value={pending.hektari} placeholder="0.00"
              onChange={(e) => onUpdate({ hektari: e.target.value })} />
          </div>
          <div className="flex-1 min-w-[130px]">
            <label className={labelCls}>Napomena</label>
            <input type="text" maxLength={200} className={inputSmCls}
              value={pending.napomena} placeholder="(opcionalno)"
              onChange={(e) => onUpdate({ napomena: e.target.value })} />
          </div>
        </div>
      )}
      {pending.vrsta === "VLAKA" && (
        <div className="flex gap-2 flex-wrap pl-0.5">
          <div className="w-28">
            <label className={labelCls}>Kilometri (km)</label>
            <input type="text" inputMode="decimal" className={inputSmCls}
              value={pending.kilometri} placeholder="0.00"
              onChange={(e) => onUpdate({ kilometri: e.target.value })} />
          </div>
          <div className="flex-1 min-w-[130px]">
            <label className={labelCls}>Napomena</label>
            <input type="text" maxLength={200} className={inputSmCls}
              value={pending.napomena} placeholder="(opcionalno)"
              onChange={(e) => onUpdate({ napomena: e.target.value })} />
          </div>
        </div>
      )}
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

  const [allUnosi, setAllUnosi] = useState<UnosRada[]>([]);
  const [pendingRows, setPendingRows] = useState<Record<string, PendingRow>>({});
  const [savingRow, setSavingRow] = useState<string | null>(null);
  const [batchSaving, setBatchSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm());
  const [editSaving, setEditSaving] = useState(false);

  const [confirmState, setConfirmState] = useState<{ msg: string; onOk: () => void } | null>(null);

  useEffect(() => {
    if (!authLoading && !session) { router.replace("/login/"); return; }
    if (!authLoading && session && !canAccess) router.replace("/");
  }, [session, authLoading]);

  useEffect(() => {
    Promise.all([getOdjeli(), getKorisnici(), getUnosi()]).then(([od, kor, allUn]) => {
      setAllUnosi(allUn);
      const workers = kor
        .filter((k) => k.role === "worker")
        .sort((a, b) => displayKorisnik(a).localeCompare(displayKorisnik(b)));
      setOdjeli(od);
      setKorisnici(workers);
      // Pre-populate odjel for workers assigned to exactly one department
      const auto: Record<string, PendingRow> = {};
      workers.forEach((k) => {
        if (k.odjeliIds?.length === 1) {
          auto[k.id] = { ...emptyPending(), odjelId: k.odjeliIds[0] };
        }
      });
      setPendingRows(auto);
    });
  }, []);

  useEffect(() => {
    if (!session) return;
    setFetching(true);
    getUnosiZaDan(datum)
      .then(setUnosi)
      .finally(() => setFetching(false));
    setEditId(null);
  }, [session, datum]);

  const recentOdjeliPerKorisnik = useMemo(() => recentOdjelIdsByInzinjer(allUnosi), [allUnosi]);

  if (authLoading || !session) return null;

  const existingMap = new Map(unosi.map((u) => [u.inzinjerId, u]));

  function getPending(korisnikId: string): PendingRow {
    return pendingRows[korisnikId] ?? emptyPending();
  }

  function updatePending(korisnikId: string, patch: Partial<PendingRow>) {
    setPendingRows((prev) => ({
      ...prev,
      [korisnikId]: { ...(prev[korisnikId] ?? emptyPending()), ...patch },
    }));
  }

  function isPendingReady(p: PendingRow | undefined) {
    if (!p?.vrsta) return false;
    return NO_ODJEL_VRSTE.has(p.vrsta) || !!p.odjelId;
  }

  const readyCount = korisnici.filter((k) =>
    !existingMap.has(k.id) && isPendingReady(pendingRows[k.id])
  ).length;

  async function savePendingRow(korisnikId: string) {
    const p = pendingRows[korisnikId];
    if (!isPendingReady(p)) return;
    setSavingRow(korisnikId);
    try {
      await createUnos({
        datum, vrsta: p.vrsta as VrstaRada,
        inzinjerId: korisnikId, odjelId: p.odjelId,
        brojStabala: p.vrsta === "DOZNAKA" && p.brojStabala ? Number(p.brojStabala.replace(",", ".")) : undefined,
        hektari: p.vrsta === "DOZNAKA" && p.hektari ? Number(p.hektari.replace(",", ".")) : undefined,
        kilometri: p.vrsta === "VLAKA" && p.kilometri ? Number(p.kilometri.replace(",", ".")) : undefined,
        napomena: p.napomena || undefined,
        createdById: session!.userId, createdByRole: session!.role,
      });
      const fresh = await getUnosiZaDan(datum);
      setUnosi(fresh);
      setPendingRows((prev) => {
        const next = { ...prev };
        // Reset to auto-populate if single odjel
        const k = korisnici.find((k) => k.id === korisnikId);
        next[korisnikId] = k?.odjeliIds?.length === 1
          ? { ...emptyPending(), odjelId: k.odjeliIds[0] }
          : emptyPending();
        return next;
      });
    } finally {
      setSavingRow(null);
    }
  }

  async function saveAllReady() {
    const ready = korisnici.filter((k) =>
      !existingMap.has(k.id) && isPendingReady(pendingRows[k.id])
    );
    if (!ready.length) return;
    setBatchSaving(true);
    try {
      await Promise.all(ready.map((k) => {
        const p = pendingRows[k.id];
        return createUnos({
          datum, vrsta: p.vrsta as VrstaRada,
          inzinjerId: k.id, odjelId: p.odjelId,
          brojStabala: p.vrsta === "DOZNAKA" && p.brojStabala ? Number(p.brojStabala.replace(",", ".")) : undefined,
          hektari: p.vrsta === "DOZNAKA" && p.hektari ? Number(p.hektari.replace(",", ".")) : undefined,
          kilometri: p.vrsta === "VLAKA" && p.kilometri ? Number(p.kilometri.replace(",", ".")) : undefined,
          napomena: p.napomena || undefined,
          createdById: session!.userId, createdByRole: session!.role,
        });
      }));
      const fresh = await getUnosiZaDan(datum);
      setUnosi(fresh);
      // Reset saved rows to auto-populate
      setPendingRows(() => {
        const auto: Record<string, PendingRow> = {};
        korisnici.forEach((k) => {
          if (k.odjeliIds?.length === 1) {
            auto[k.id] = { ...emptyPending(), odjelId: k.odjeliIds[0] };
          }
        });
        return auto;
      });
      setMsg(`Sačuvano ${ready.length} unos${ready.length === 1 ? "" : "a"} ✓`);
      setTimeout(() => setMsg(""), 4000);
    } finally {
      setBatchSaving(false);
    }
  }

  function startEdit(u: UnosRada) {
    setEditId(u.id);
    setEditForm({
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
    setEditSaving(true);
    try {
      const u = unosi.find((x) => x.id === editId)!;
      await updateUnos(editId, {
        vrsta: editForm.vrsta,
        inzinjerId: u.inzinjerId,
        odjelId: editForm.odjelId || undefined,
        brojStabala: editForm.vrsta === "DOZNAKA" && editForm.brojStabala ? Number(editForm.brojStabala.replace(",", ".")) : null,
        hektari: editForm.vrsta === "DOZNAKA" && editForm.hektari ? Number(editForm.hektari.replace(",", ".")) : null,
        kilometri: editForm.vrsta === "VLAKA" && editForm.kilometri ? Number(editForm.kilometri.replace(",", ".")) : null,
        napomena: editForm.napomena || null,
        updatedById: session!.userId,
        updatedByRole: session!.role,
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

  const allSortedOdjeli = [...odjeli].sort((a, b) => (a.gj + a.broj).localeCompare(b.gj + b.broj));

  return (
    <div className="py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mr-auto">Unos učinka</h1>
        <button
          onClick={() => setDatum(prevDay(datum))}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
        >‹</button>
        <input
          type="date" value={datum}
          onChange={(e) => setDatum(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
        <button
          onClick={() => setDatum(nextDay(datum))}
          disabled={datum >= today()}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-40"
        >›</button>
        {readyCount > 0 && (
          <button
            onClick={saveAllReady}
            disabled={batchSaving}
            className="bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50 transition-colors"
          >
            {batchSaving ? "Snimam..." : `Sačuvaj sve (${readyCount})`}
          </button>
        )}
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 capitalize">{fmtDateLong(datum)}</p>

      {msg && (
        <div className="mb-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-lg px-4 py-2.5 text-sm">
          {msg}
        </div>
      )}

      {/* Roster */}
      {fetching ? (
        <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">Učitavanje...</div>
      ) : korisnici.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">Nema projektanata.</div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm divide-y divide-gray-100 dark:divide-gray-800">
          {korisnici.map((k) => {
            const existing = existingMap.get(k.id);

            // ── Edit mode ─────────────────────────────────────────────────────
            if (existing && editId === existing.id) {
              return (
                <div key={k.id} className="px-3 py-3 bg-blue-50 dark:bg-blue-950/30 space-y-3">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {displayKorisnik(k)}
                  </div>
                  <form onSubmit={handleSaveEdit} className="space-y-2">
                    {/* Odjel + Vrsta */}
                    <div className="flex flex-wrap items-start gap-2">
                      {!NO_ODJEL_VRSTE.has(editForm.vrsta) && (
                        <div className="shrink-0" style={{ minWidth: 200 }}>
                          <select className={inputSmCls} value={editForm.odjelId}
                            onChange={(e) => setEditForm((f) => ({ ...f, odjelId: e.target.value }))}>
                            <option value="">Odjel...</option>
                            {allSortedOdjeli.map((o) => (
                              <option key={o.id} value={o.id}>{o.gj} / {o.broj}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {/* Vrsta chips */}
                      <div className="flex flex-wrap gap-1">
                        {VRSTE.map((v) => (
                          <button key={v} type="button"
                            onClick={() => setEditForm((f) => ({ ...f, vrsta: v, brojStabala: "", hektari: "", kilometri: "" }))}
                            className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                              editForm.vrsta === v ? VRSTA_BTN_ACTIVE[v] : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900"
                            }`}>
                            {VRSTA_LABEL[v]}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Metrics */}
                    {editForm.vrsta === "DOZNAKA" && (
                      <div className="flex gap-2 flex-wrap">
                        <div className="w-24">
                          <label className={labelCls}>Stabala</label>
                          <input type="text" inputMode="decimal" className={inputSmCls} value={editForm.brojStabala}
                            onChange={(e) => setEditForm((f) => ({ ...f, brojStabala: e.target.value }))} />
                        </div>
                        <div className="w-28">
                          <label className={labelCls}>Hektari (ha)</label>
                          <input type="text" inputMode="decimal" className={inputSmCls} value={editForm.hektari}
                            onChange={(e) => setEditForm((f) => ({ ...f, hektari: e.target.value }))} />
                        </div>
                        <div className="flex-1 min-w-[130px]">
                          <label className={labelCls}>Napomena</label>
                          <input type="text" maxLength={200} className={inputSmCls} value={editForm.napomena}
                            onChange={(e) => setEditForm((f) => ({ ...f, napomena: e.target.value }))} />
                        </div>
                      </div>
                    )}
                    {editForm.vrsta === "VLAKA" && (
                      <div className="flex gap-2 flex-wrap">
                        <div className="w-28">
                          <label className={labelCls}>Kilometri (km)</label>
                          <input type="text" inputMode="decimal" className={inputSmCls} value={editForm.kilometri}
                            onChange={(e) => setEditForm((f) => ({ ...f, kilometri: e.target.value }))} />
                        </div>
                        <div className="flex-1 min-w-[130px]">
                          <label className={labelCls}>Napomena</label>
                          <input type="text" maxLength={200} className={inputSmCls} value={editForm.napomena}
                            onChange={(e) => setEditForm((f) => ({ ...f, napomena: e.target.value }))} />
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button type="submit" disabled={editSaving}
                        className="bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-800 disabled:opacity-50">
                        {editSaving ? "Snimam..." : "Ažuriraj"}
                      </button>
                      <button type="button" onClick={() => setEditId(null)}
                        className="border border-gray-300 dark:border-gray-600 px-3 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                        Odustani
                      </button>
                    </div>
                  </form>
                </div>
              );
            }

            // ── Read mode (existing entry) ────────────────────────────────────
            if (existing) {
              return (
                <div key={k.id} className="px-3 py-2.5 flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-900 dark:text-gray-100 shrink-0" style={{ minWidth: 100 }}>
                    {displayKorisnik(k)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                    {existing.odjel?.gj}/{existing.odjel?.broj}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${VRSTA_COLOR[existing.vrsta] ?? ""}`}>
                    {VRSTA_LABEL[existing.vrsta]}
                  </span>
                  {existing.vrsta === "DOZNAKA" && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                      {existing.brojStabala != null ? `${existing.brojStabala} st` : ""}
                      {existing.hektari != null ? ` · ${existing.hektari.toFixed(2)} ha` : ""}
                    </span>
                  )}
                  {existing.vrsta === "VLAKA" && existing.kilometri != null && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{existing.kilometri.toFixed(2)} km</span>
                  )}
                  {existing.napomena && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 italic">{existing.napomena}</span>
                  )}
                  <div className="ml-auto flex items-center gap-3 shrink-0">
                    <button onClick={() => startEdit(existing)} className="text-blue-600 dark:text-blue-400 hover:underline text-xs">
                      Uredi
                    </button>
                    <button onClick={() => handleDelete(existing.id)} className="text-red-500 dark:text-red-400 hover:underline text-xs">
                      Obriši
                    </button>
                  </div>
                </div>
              );
            }

            // ── New entry row ─────────────────────────────────────────────────
            return (
              <RosterNewRow
                key={k.id}
                korisnik={k}
                pending={getPending(k.id)}
                odjeli={odjeli}
                recentOdjelIds={recentOdjeliPerKorisnik.get(k.id) ?? []}
                onUpdate={(patch) => updatePending(k.id, patch)}
                onSave={() => savePendingRow(k.id)}
                saving={savingRow === k.id}
              />
            );
          })}
        </div>
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
