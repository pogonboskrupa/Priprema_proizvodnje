"use client";
import { useEffect, useState, useMemo } from "react";
import { getOdjeli, getKorisnici, getUnosiZaDan, getUnosi, createUnos, updateUnos, deleteUnos } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { Odjel, UnosRada, VrstaRada, Korisnik } from "@/lib/types";
import { ConfirmModal } from "@/components/ConfirmModal";
import { fmtDateLong, localDateStr } from "@/lib/format";
import { recentOdjelIdsByInzinjer, splitOdjeliByRecent } from "@/lib/recent";
import { EVIDENCIJA_OD_DATUM } from "@/lib/godine";
import { isOffline } from "@/lib/firebase";
import { zabranaUpisa } from "@/lib/sihtarica";
import { NO_ODJEL_VRSTE, editFormToPayload, type UnosEditForm as EditForm } from "@/lib/unos-edit";
import { VRSTA, VRSTE, vrsta as vrstaStyle } from "@/lib/vrste";
import { UnosEditForm, inputSmCls, labelSmCls as labelCls } from "@/components/UnosEditForm";

const today = () => localDateStr();

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

function pendingToPayload(p: PendingRow) {
  if (!p.vrsta) return { ok: false as const, error: "" };
  return editFormToPayload({ ...p, vrsta: p.vrsta });
}

const emptyEditForm = (): EditForm => ({
  odjelId: "", vrsta: "DOZNAKA",
  brojStabala: "", hektari: "", kilometri: "", napomena: "",
});

function shiftDay(d: string, delta: number) {
  const [y, m, day] = d.split("-").map(Number);
  return localDateStr(new Date(y, m - 1, day + delta));
}
const prevDay = (d: string) => shiftDay(d, -1);
const nextDay = (d: string) => shiftDay(d, 1);

function displayKorisnik(k: Korisnik) {
  return k.fullName || k.ime;
}

// ── RosterNewRow ──────────────────────────────────────────────────────────────

function RosterNewRow({
  korisnik, pending, odjeli, recentOdjelIds, onUpdate, onSave, saving, onCancel,
}: {
  korisnik: Korisnik;
  pending: PendingRow;
  odjeli: Odjel[];
  recentOdjelIds: string[];
  onUpdate: (patch: Partial<PendingRow>) => void;
  onSave: () => void;
  saving: boolean;
  /** Postavljen kad je ovo dodatni unos za dan koji već ima unos */
  onCancel?: () => void;
}) {
  const { recent: recentOdjeli, rest: sortedOdjeli } = splitOdjeliByRecent(odjeli, recentOdjelIds);

  const noOdjelNeeded = pending.vrsta ? NO_ODJEL_VRSTE.has(pending.vrsta) : false;
  const parsed = pendingToPayload(pending);
  const isReady = parsed.ok;
  const numberError = !parsed.ok && parsed.error === "Neispravan broj.";

  return (
    <div className="px-3 py-3 space-y-2">
      {/* Name + save button */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 leading-tight">
          {onCancel ? <span className="text-xs text-gray-500 dark:text-gray-400">+ dodatni unos</span> : displayKorisnik(korisnik)}
        </span>
        {onCancel && (
          <button onClick={onCancel} className="ml-auto shrink-0 text-xs text-gray-500 dark:text-gray-400 hover:underline">
            Odustani
          </button>
        )}
        {isReady && (
          <button
            onClick={onSave}
            disabled={saving}
            className="shrink-0 text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold transition-colors"
          >
            {saving ? "..." : "Sačuvaj"}
          </button>
        )}
        {numberError && (
          <span className="shrink-0 text-xs text-red-600 dark:text-red-400">Neispravan broj</span>
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
                  ? VRSTA[v].btnActive
                  : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-900"
              }`}
            >
              {VRSTA[v].label}
            </button>
          ))}
        </div>
      </div>

      {/* Metric inputs (DOZNAKA / VLAKA only) */}
      {pending.vrsta === "DOZNAKA" && (
        <div className="flex gap-2 flex-wrap pl-0.5">
          <div className="w-24">
            <label className={labelCls}>Stabala</label>
            <input type="text" inputMode="numeric" className={inputSmCls}
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
  const [editError, setEditError] = useState("");
  const [extraRows, setExtraRows] = useState<ReadonlySet<string>>(new Set());

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
    }).catch(() => setMsg("Greška pri učitavanju podataka. Osvježi stranicu."));
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

  const existingMap = new Map<string, UnosRada[]>();
  for (const u of unosi) existingMap.set(u.inzinjerId, [...(existingMap.get(u.inzinjerId) ?? []), u]);
  const showsNewRow = (id: string) => !existingMap.has(id) || extraRows.has(id);

  function toggleExtra(id: string, on: boolean) {
    setExtraRows((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }

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
    return !!p && pendingToPayload(p).ok;
  }

  const readyCount = korisnici.filter((k) =>
    showsNewRow(k.id) && isPendingReady(pendingRows[k.id])
  ).length;

  function zabranaZa(korisnikId: string, p: PendingRow): string | null {
    const parsed = pendingToPayload(p);
    if (!parsed.ok) return parsed.error;
    return zabranaUpisa(datum, unosi.filter((u) => u.inzinjerId === korisnikId), parsed.data.vrsta);
  }

  async function createFromPending(korisnikId: string, p: PendingRow) {
    const parsed = pendingToPayload(p);
    if (!parsed.ok) throw new Error(parsed.error);
    const d = parsed.data;
    const created = await createUnos({
      datum, vrsta: d.vrsta,
      inzinjerId: korisnikId, odjelId: d.odjelId ?? undefined,
      brojStabala: d.brojStabala ?? undefined,
      hektari: d.hektari ?? undefined,
      kilometri: d.kilometri ?? undefined,
      napomena: d.napomena ?? undefined,
      createdById: session!.userId, createdByRole: session!.role,
    });
    setAllUnosi((prev) => [created, ...prev]);
  }

  function showMsg(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(""), 4000);
  }

  async function savePendingRow(korisnikId: string) {
    const p = pendingRows[korisnikId];
    if (!isPendingReady(p)) return;
    const z = zabranaZa(korisnikId, p);
    if (z) { showMsg(z); return; }
    setSavingRow(korisnikId);
    try {
      await createFromPending(korisnikId, p);
      const fresh = await getUnosiZaDan(datum);
      setUnosi(fresh);
      toggleExtra(korisnikId, false);
      setPendingRows((prev) => {
        const next = { ...prev };
        // Reset to auto-populate if single odjel
        const k = korisnici.find((k) => k.id === korisnikId);
        next[korisnikId] = k?.odjeliIds?.length === 1
          ? { ...emptyPending(), odjelId: k.odjeliIds[0] }
          : emptyPending();
        return next;
      });
    } catch {
      showMsg("Greška pri snimanju. Pokušaj ponovo.");
    } finally {
      setSavingRow(null);
    }
  }

  async function saveAllReady() {
    const kandidati = korisnici.filter((k) =>
      showsNewRow(k.id) && isPendingReady(pendingRows[k.id])
    );
    // redove koji krše pravila preskoči i ostavi popunjene da se isprave
    const odbijeni = kandidati.filter((k) => zabranaZa(k.id, pendingRows[k.id]));
    const ready = kandidati.filter((k) => !odbijeni.includes(k));
    if (!ready.length) {
      if (odbijeni.length) showMsg(`${displayKorisnik(odbijeni[0])}: ${zabranaZa(odbijeni[0].id, pendingRows[odbijeni[0].id])}`);
      return;
    }
    setBatchSaving(true);
    try {
      await Promise.all(ready.map((k) => createFromPending(k.id, pendingRows[k.id])));
      const fresh = await getUnosiZaDan(datum);
      setUnosi(fresh);
      setExtraRows(new Set());
      // Reset saved rows to auto-populate
      setPendingRows((prev) => {
        const auto: Record<string, PendingRow> = {};
        korisnici.forEach((k) => {
          if (odbijeni.includes(k)) auto[k.id] = prev[k.id];
          else if (k.odjeliIds?.length === 1) {
            auto[k.id] = { ...emptyPending(), odjelId: k.odjeliIds[0] };
          }
        });
        return auto;
      });
      showMsg(`Sačuvano ${ready.length} unos${ready.length === 1 ? "" : "a"} ✓${isOffline() ? " (offline — poslaće se kad bude signala)" : ""}`
        + (odbijeni.length ? ` · ${odbijeni.length} nije sačuvano: ${displayKorisnik(odbijeni[0])} — ${zabranaZa(odbijeni[0].id, pendingRows[odbijeni[0].id])}` : ""));
    } catch {
      showMsg("Greška: dio unosa nije sačuvan. Provjeri listu i pokušaj ponovo.");
      setUnosi(await getUnosiZaDan(datum).catch(() => unosi));
    } finally {
      setBatchSaving(false);
    }
  }

  function startEdit(u: UnosRada) {
    setEditId(u.id);
    setEditError("");
    setEditForm({
      odjelId: u.odjelId ?? "",
      vrsta: u.vrsta,
      brojStabala: u.brojStabala != null ? String(u.brojStabala) : "",
      hektari: u.hektari != null ? String(u.hektari) : "",
      kilometri: u.kilometri != null ? String(u.kilometri) : "",
      napomena: u.napomena ?? "",
    });
  }

  async function handleSaveEdit() {
    if (!editId) return;
    const parsed = editFormToPayload(editForm);
    if (!parsed.ok) { setEditError(parsed.error); return; }
    setEditSaving(true);
    setEditError("");
    try {
      await updateUnos(editId, {
        ...parsed.data,
        updatedById: session!.userId,
        updatedByRole: session!.role,
      });
      setEditId(null);
      const fresh = await getUnosiZaDan(datum);
      setUnosi(fresh);
    } catch {
      setEditError("Greška pri snimanju. Pokušaj ponovo.");
    } finally {
      setEditSaving(false);
    }
  }

  function handleDelete(id: string) {
    setConfirmState({
      msg: "Obrisati ovaj unos?",
      onOk: async () => {
        setConfirmState(null);
        try {
          await deleteUnos(id);
          setUnosi((prev) => prev.filter((u) => u.id !== id));
          setAllUnosi((prev) => prev.filter((u) => u.id !== id));
        } catch {
          showMsg("Greška pri brisanju unosa.");
        }
      },
    });
  }

  return (
    <div className="py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mr-auto">Unos učinka</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDatum(prevDay(datum))}
            disabled={datum <= EVIDENCIJA_OD_DATUM}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-40"
          >‹</button>
          <input
            type="date" value={datum}
            min={EVIDENCIJA_OD_DATUM}
            max={today()}
            onChange={(e) => {
              const v = e.target.value;
              if (v && v >= EVIDENCIJA_OD_DATUM && v <= today()) setDatum(v);
            }}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <button
            onClick={() => setDatum(nextDay(datum))}
            disabled={datum >= today()}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-40"
          >›</button>
        </div>
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
        <div className={`mb-4 rounded-lg px-4 py-2.5 text-sm border ${
          msg.startsWith("Greška")
            ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
            : "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
        }`}>
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
            const entries = existingMap.get(k.id) ?? [];
            const newRow = showsNewRow(k.id) && (
              <RosterNewRow
                korisnik={k}
                pending={getPending(k.id)}
                odjeli={odjeli}
                recentOdjelIds={recentOdjeliPerKorisnik.get(k.id) ?? []}
                onUpdate={(patch) => updatePending(k.id, patch)}
                onSave={() => savePendingRow(k.id)}
                saving={savingRow === k.id}
                onCancel={entries.length ? () => toggleExtra(k.id, false) : undefined}
              />
            );

            return (
              <div key={k.id}>
                {entries.map((u, i) => {
                  const isLast = i === entries.length - 1;

                  if (editId === u.id) {
                    return (
                      <div key={u.id} className="px-3 py-3 bg-blue-50 dark:bg-blue-950/30 space-y-3">
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                          {displayKorisnik(k)}
                        </div>
                        <UnosEditForm
                          form={editForm}
                          onChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
                          odjeli={odjeli}
                          saving={editSaving}
                          error={editError}
                          onSubmit={handleSaveEdit}
                          onCancel={() => setEditId(null)}
                        />
                      </div>
                    );
                  }

                  const st = vrstaStyle(u.vrsta);
                  return (
                    <div key={u.id} className="px-3 py-2.5 flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900 dark:text-gray-100 shrink-0" style={{ minWidth: 100 }}>
                        {i === 0 ? displayKorisnik(k) : ""}
                      </span>
                      {u.odjel && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                          {u.odjel.gj}/{u.odjel.broj}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${st.badge}`}>
                        {st.label}
                      </span>
                      {u.vrsta === "DOZNAKA" && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                          {u.brojStabala != null ? `${u.brojStabala} st` : ""}
                          {u.hektari != null ? ` · ${u.hektari.toFixed(2)} ha` : ""}
                        </span>
                      )}
                      {u.vrsta === "VLAKA" && u.kilometri != null && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{u.kilometri.toFixed(2)} km</span>
                      )}
                      {u.napomena && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">{u.napomena}</span>
                      )}
                      <div className="ml-auto flex items-center gap-3 shrink-0">
                        {isLast && !extraRows.has(k.id) && (
                          <button onClick={() => toggleExtra(k.id, true)} className="text-green-700 dark:text-green-400 hover:underline text-xs" title="Dodaj još jedan unos za ovaj dan">
                            + Još
                          </button>
                        )}
                        <button onClick={() => startEdit(u)} className="text-blue-600 dark:text-blue-400 hover:underline text-xs">
                          Uredi
                        </button>
                        <button onClick={() => handleDelete(u.id)} className="text-red-500 dark:text-red-400 hover:underline text-xs">
                          Obriši
                        </button>
                      </div>
                    </div>
                  );
                })}
                {newRow}
              </div>
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
