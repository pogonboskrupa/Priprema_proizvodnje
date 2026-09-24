"use client";
import { useEffect, useState, useMemo } from "react";
import { getUnosiZaMjesec, getKorisnici, getOdjeli, updateUnos, deleteUnos } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { UnosRada, Korisnik, Odjel, VrstaRada } from "@/lib/types";
import { monthYearLabel, fmtDateLong, localDateStr } from "@/lib/format";
import { ConfirmModal } from "@/components/ConfirmModal";
import { NO_ODJEL_VRSTE, editFormToPayload, type UnosEditForm } from "@/lib/unos-edit";

const DAY_NAMES = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];

const VRSTA_DOT: Record<string, string> = {
  DOZNAKA: "bg-green-500", VLAKA: "bg-amber-500", TEREN: "bg-orange-500",
  GODISNJI: "bg-sky-500", KANCELARIJA: "bg-indigo-500", BOLOVANJE: "bg-red-500",
};
const VRSTA_LABEL: Record<string, string> = {
  DOZNAKA: "Doznaka", VLAKA: "Vlaka", TEREN: "Teren",
  KANCELARIJA: "Kancelarija", GODISNJI: "Godišnji", BOLOVANJE: "Bolovanje",
};
const VRSTA_SHORT: Record<string, string> = {
  DOZNAKA: "Doz", VLAKA: "Vl", TEREN: "Ter", GODISNJI: "God", KANCELARIJA: "Kan", BOLOVANJE: "Bol",
};
const VRSTA_ORDER = ["DOZNAKA", "VLAKA", "TEREN", "KANCELARIJA", "GODISNJI", "BOLOVANJE"];
const VRSTA_TILE_BORDER: Record<string, string> = {
  DOZNAKA:    "border-l-green-500  text-green-700  dark:text-green-300",
  VLAKA:      "border-l-amber-500  text-amber-700  dark:text-amber-300",
  TEREN:      "border-l-orange-500 text-orange-700 dark:text-orange-300",
  KANCELARIJA:"border-l-indigo-500 text-indigo-700 dark:text-indigo-300",
  GODISNJI:   "border-l-sky-500    text-sky-700    dark:text-sky-300",
  BOLOVANJE:  "border-l-red-500    text-red-700    dark:text-red-300",
};
const VRSTA_COL_COLOR: Record<string, string> = {
  DOZNAKA:    "text-green-600  dark:text-green-400",
  VLAKA:      "text-amber-600  dark:text-amber-400",
  TEREN:      "text-orange-600 dark:text-orange-400",
  KANCELARIJA:"text-indigo-600 dark:text-indigo-400",
  GODISNJI:   "text-sky-600    dark:text-sky-400",
  BOLOVANJE:  "text-red-600    dark:text-red-400",
};
const VRSTA_BADGE: Record<string, string> = {
  DOZNAKA:    "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300",
  VLAKA:      "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300",
  TEREN:      "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300",
  KANCELARIJA:"bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300",
  GODISNJI:   "bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300",
  BOLOVANJE:  "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300",
};
const VRSTA_BTN_ACTIVE: Record<string, string> = {
  DOZNAKA: "bg-green-600 text-white border-green-600",
  VLAKA: "bg-amber-500 text-white border-amber-500",
  TEREN: "bg-orange-500 text-white border-orange-500",
  GODISNJI: "bg-sky-500 text-white border-sky-500",
  KANCELARIJA: "bg-indigo-500 text-white border-indigo-500",
  BOLOVANJE: "bg-red-500 text-white border-red-500",
};
const VRSTE: VrstaRada[] = ["DOZNAKA", "VLAKA", "TEREN", "GODISNJI", "KANCELARIJA", "BOLOVANJE"];

const inputSmCls = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-green-500";
const labelCls = "block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) { return new Date(year, month, 0).getDate(); }
function getFirstDayOffset(year: number, month: number) {
  const day = new Date(year, month - 1, 1).getDay();
  return day === 0 ? 6 : day - 1;
}
function fmtAuditTime(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} u ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function roleLabel(k: Korisnik | undefined | null): string {
  if (!k) return "";
  if (k.operater) return "operater";
  if (k.role === "admin") return "admin";
  return "projektant";
}
function personName(k: Korisnik | undefined | null): string {
  if (!k) return "Nepoznat";
  return k.fullName || k.ime;
}
function wasEdited(u: UnosRada): boolean {
  return !!u.updatedById;
}

// ── Recap computation ─────────────────────────────────────────────────────────

type VrstaStats = { days: Set<string>; ha: number; stabala: number; km: number };
function computeRecap(unosi: UnosRada[]) {
  const byVrsta: Record<string, VrstaStats> = {};
  const totalDates = new Set<string>();
  for (const u of unosi) {
    const ds = u.datum.slice(0, 10);
    if (!ds) continue;
    if (!byVrsta[u.vrsta]) byVrsta[u.vrsta] = { days: new Set(), ha: 0, stabala: 0, km: 0 };
    byVrsta[u.vrsta].days.add(ds);
    totalDates.add(ds);
    if (u.vrsta === "DOZNAKA") {
      byVrsta[u.vrsta].ha += Number(u.hektari) || 0;
      byVrsta[u.vrsta].stabala += Number(u.brojStabala) || 0;
    } else if (u.vrsta === "VLAKA") {
      byVrsta[u.vrsta].km += Number(u.kilometri) || 0;
    }
  }
  return { byVrsta, totalDays: totalDates.size };
}

type WorkerRow = {
  id: string; name: string; totalDays: number;
  doz: number; vl: number; ter: number; kan: number; god: number; bol: number;
  ha: number; stabala: number; km: number;
};
function computeAllWorkersRecap(allUnosi: UnosRada[], workers: Korisnik[]): WorkerRow[] {
  type Acc = {
    total: Set<string>; doz: Set<string>; vl: Set<string>; ter: Set<string>;
    kan: Set<string>; god: Set<string>; bol: Set<string>;
    ha: number; stabala: number; km: number;
  };
  const empty = (): Acc => ({
    total: new Set(), doz: new Set(), vl: new Set(), ter: new Set(),
    kan: new Set(), god: new Set(), bol: new Set(), ha: 0, stabala: 0, km: 0,
  });
  const map: Record<string, Acc> = {};
  for (const w of workers) map[w.id] = empty();
  for (const u of allUnosi) {
    const a = map[u.inzinjerId];
    if (!a) continue;
    const ds = u.datum.slice(0, 10);
    if (!ds) continue;
    a.total.add(ds);
    switch (u.vrsta) {
      case "DOZNAKA": a.doz.add(ds); a.ha += Number(u.hektari) || 0; a.stabala += Number(u.brojStabala) || 0; break;
      case "VLAKA":   a.vl.add(ds); a.km += Number(u.kilometri) || 0; break;
      case "TEREN":       a.ter.add(ds); break;
      case "KANCELARIJA": a.kan.add(ds); break;
      case "GODISNJI":    a.god.add(ds); break;
      case "BOLOVANJE":   a.bol.add(ds); break;
    }
  }
  return workers
    .map((w) => {
      const a = map[w.id];
      return {
        id: w.id, name: w.fullName || w.ime, totalDays: a.total.size,
        doz: a.doz.size, vl: a.vl.size, ter: a.ter.size,
        kan: a.kan.size, god: a.god.size, bol: a.bol.size,
        ha: a.ha, stabala: a.stabala, km: a.km,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ── Recap components ──────────────────────────────────────────────────────────

function SingleWorkerRecap({ recap, monthLabel }: { recap: ReturnType<typeof computeRecap>; monthLabel: string }) {
  const { byVrsta, totalDays } = recap;
  if (totalDays === 0) return null;
  const present = VRSTA_ORDER.filter((v) => byVrsta[v]);
  return (
    <div className="mt-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Rekapitulacija</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 capitalize truncate">{monthLabel}</span>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2 flex-shrink-0">
          <span className="text-2xl font-bold tabular-nums leading-none text-gray-800 dark:text-gray-100">{totalDays}</span>
          <div className="text-xs leading-snug text-gray-500 dark:text-gray-400">
            <div>dana</div>
            <div className="font-semibold text-gray-600 dark:text-gray-300">{totalDays * 8} h</div>
          </div>
        </div>
      </div>
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {present.map((vrsta) => {
          const s = byVrsta[vrsta];
          const days = s.days.size;
          const tileClass = VRSTA_TILE_BORDER[vrsta] ?? "border-l-gray-400 text-gray-600 dark:text-gray-300";
          return (
            <div key={vrsta} className={`border-l-[3px] rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30 p-3 flex flex-col gap-1 ${tileClass}`}>
              <span className="text-[10px] font-bold uppercase tracking-widest">{VRSTA_LABEL[vrsta]}</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-bold tabular-nums text-gray-800 dark:text-gray-100 leading-none">{days}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">d · {days * 8}h</span>
              </div>
              {vrsta === "DOZNAKA" && (s.ha > 0 || s.stabala > 0) && (
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-snug">
                  {s.ha > 0 && <span>{s.ha.toFixed(2)} ha</span>}
                  {s.ha > 0 && s.stabala > 0 && <span className="mx-1">·</span>}
                  {s.stabala > 0 && <span>{s.stabala.toLocaleString()} stabala</span>}
                </div>
              )}
              {vrsta === "VLAKA" && s.km > 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">{s.km.toFixed(2)} km</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CellNum({ v, color }: { v: number; color: string }) {
  return (
    <td className={`px-3 py-2.5 text-center tabular-nums text-xs font-medium ${v > 0 ? color : "text-gray-300 dark:text-gray-700"}`}>
      {v > 0 ? v : "–"}
    </td>
  );
}

function AdminAllWorkersRecap({ data, monthLabel }: { data: WorkerRow[]; monthLabel: string }) {
  const totals = data.reduce(
    (acc, w) => ({ ha: acc.ha + w.ha, km: acc.km + w.km, stabala: acc.stabala + w.stabala }),
    { ha: 0, km: 0, stabala: 0 }
  );
  const hasMetrics = totals.ha > 0 || totals.km > 0;
  return (
    <div className="mt-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Rekapitulacija — svi radnici</span>
        <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">{monthLabel}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Radnik</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200">Dana</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200">Sati</th>
              {(["DOZNAKA","VLAKA","TEREN","KANCELARIJA","GODISNJI","BOLOVANJE"] as const).map((v) => (
                <th key={v} className={`text-center px-3 py-2.5 text-xs font-semibold ${VRSTA_COL_COLOR[v]}`}>
                  {VRSTA_SHORT[v]}
                </th>
              ))}
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">ha / km</th>
            </tr>
          </thead>
          <tbody>
            {data.map((w) => (
              <tr key={w.id} className={`border-t border-gray-100 dark:border-gray-800 transition-colors ${
                w.totalDays === 0 ? "opacity-40" : "hover:bg-gray-50/60 dark:hover:bg-gray-800/40"
              }`}>
                <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-100">{w.name}</td>
                <td className="px-3 py-2.5 text-center font-bold tabular-nums text-gray-800 dark:text-gray-100">{w.totalDays || "–"}</td>
                <td className="px-3 py-2.5 text-center tabular-nums text-gray-500 dark:text-gray-400">{w.totalDays ? w.totalDays * 8 : "–"}</td>
                <CellNum v={w.doz} color={VRSTA_COL_COLOR["DOZNAKA"]} />
                <CellNum v={w.vl}  color={VRSTA_COL_COLOR["VLAKA"]} />
                <CellNum v={w.ter} color={VRSTA_COL_COLOR["TEREN"]} />
                <CellNum v={w.kan} color={VRSTA_COL_COLOR["KANCELARIJA"]} />
                <CellNum v={w.god} color={VRSTA_COL_COLOR["GODISNJI"]} />
                <CellNum v={w.bol} color={VRSTA_COL_COLOR["BOLOVANJE"]} />
                <td className="px-4 py-2.5 text-right text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                  {w.ha > 0 && <span className="mr-2">{w.ha.toFixed(1)} ha</span>}
                  {w.km > 0 && <span>{w.km.toFixed(1)} km</span>}
                  {w.ha === 0 && w.km === 0 && "–"}
                </td>
              </tr>
            ))}
          </tbody>
          {hasMetrics && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
                <td className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide" colSpan={9}>Ukupno</td>
                <td className="px-4 py-2.5 text-right text-xs font-bold text-gray-700 dark:text-gray-200 tabular-nums">
                  {totals.ha > 0 && <span className="mr-2">{totals.ha.toFixed(1)} ha</span>}
                  {totals.km > 0 && <span>{totals.km.toFixed(1)} km</span>}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const emptyEditForm = (): UnosEditForm => ({
  vrsta: "DOZNAKA", odjelId: "", brojStabala: "", hektari: "", kilometri: "", napomena: "",
});

export default function KalendarPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const isWorker = session?.role === "worker";
  const canEdit = !!(session?.role === "admin" || session?.operater);

  const now = new Date();
  const todayStr = localDateStr(now);

  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [unosi, setUnosi]   = useState<UnosRada[]>([]);
  const [workers, setWorkers] = useState<Korisnik[]>([]);
  const [odjeli, setOdjeli]   = useState<Odjel[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [editId, setEditId]       = useState<string | null>(null);
  const [editForm, setEditForm]   = useState<UnosEditForm>(emptyEditForm());
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [confirmState, setConfirmState] = useState<{ msg: string; onOk: () => void } | null>(null);

  useEffect(() => {
    if (!authLoading && !session) router.replace("/login/");
  }, [session, authLoading]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    setEditId(null);
    getUnosiZaMjesec(year, month)
      .then(setUnosi)
      .finally(() => setLoading(false));
  }, [session, year, month]);

  useEffect(() => {
    if (!session) return;
    if (!isWorker) getKorisnici().then((k) => setWorkers(k.filter((w) => w.role === "worker"))).catch(() => {});
    if (canEdit) getOdjeli().then(setOdjeli).catch(() => {});
  }, [session, isWorker, canEdit]);

  const isAdmin = session?.role === "admin";
  const userId = session?.userId;

  const visibleUnosi = useMemo(() => {
    if (isWorker) return unosi.filter((u) => u.inzinjerId === userId);
    if (selectedWorkerId) return unosi.filter((u) => u.inzinjerId === selectedWorkerId);
    return unosi;
  }, [unosi, isWorker, selectedWorkerId, userId]);

  const byDay = useMemo(() => {
    const map: Record<string, UnosRada[]> = {};
    for (const u of visibleUnosi) {
      const key = u.datum.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(u);
    }
    return map;
  }, [visibleUnosi]);

  const singleRecap   = useMemo(() => computeRecap(visibleUnosi), [visibleUnosi]);
  const allWorkersData = useMemo(() => {
    if (!isAdmin || selectedWorkerId || workers.length === 0) return null;
    return computeAllWorkersRecap(unosi, workers);
  }, [isAdmin, selectedWorkerId, workers, unosi]);

  if (authLoading || !session) return null;

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
    setSelectedDay(null);
  }

  async function reload() {
    const u = await getUnosiZaMjesec(year, month);
    setUnosi(u);
  }

  function startEdit(u: UnosRada) {
    setEditId(u.id);
    setEditError("");
    setEditForm({
      vrsta: u.vrsta,
      odjelId: u.odjelId ?? "",
      brojStabala: u.brojStabala != null ? String(u.brojStabala) : "",
      hektari: u.hektari != null ? String(u.hektari) : "",
      kilometri: u.kilometri != null ? String(u.kilometri) : "",
      napomena: u.napomena ?? "",
    });
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
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
      await reload();
    } catch {
      setEditError("Greška pri snimanju. Pokušaj ponovo.");
    } finally {
      setEditSaving(false);
    }
  }

  function handleDelete(u: UnosRada) {
    const name = u.korisnik?.fullName || u.korisnik?.ime || u.inzinjerId;
    setConfirmState({
      msg: `Obrisati unos za ${name}?`,
      onOk: async () => {
        setConfirmState(null);
        await deleteUnos(u.id);
        setUnosi((prev) => prev.filter((x) => x.id !== u.id));
      },
    });
  }

  const daysInMonth  = getDaysInMonth(year, month);
  const offset       = getFirstDayOffset(year, month);
  const totalCells   = Math.ceil((offset + daysInMonth) / 7) * 7;
  const monthLabel   = monthYearLabel(year, month);
  const selectedEntries = selectedDay ? (byDay[selectedDay] ?? []) : [];
  const allSortedOdjeli = [...odjeli].sort((a, b) => (a.gj + a.broj).localeCompare(b.gj + b.broj));
  const showWorkerName  = !isWorker && !selectedWorkerId;

  return (
    <div className="py-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mr-auto">Kalendar</h1>

        {!isWorker && workers.length > 0 && (
          <select
            value={selectedWorkerId ?? ""}
            onChange={(e) => { setSelectedWorkerId(e.target.value || null); setSelectedDay(null); }}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Svi radnici</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>{w.fullName || w.ime}</option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors">‹</button>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 capitalize px-3 min-w-[130px] text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors">›</button>
        </div>
      </div>

      {/* ── Calendar grid ────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {/* Day name header */}
        <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
          {DAY_NAMES.map((d, i) => (
            <div key={d} className={`text-center py-2.5 text-xs font-semibold tracking-wide ${
              i >= 5 ? "text-slate-400 dark:text-slate-500" : "text-gray-400 dark:text-gray-500"
            }`}>
              {d}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-sm text-gray-400 dark:text-gray-500">Učitavanje...</div>
        ) : (
          <div className="grid grid-cols-7">
            {Array.from({ length: totalCells }).map((_, idx) => {
              const dayNum = idx - offset + 1;
              if (dayNum < 1 || dayNum > daysInMonth) {
                return <div key={idx} className="min-h-[76px] border-b border-r border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-950/30" />;
              }
              const ds = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
              const entries = byDay[ds] ?? [];
              const isWeekend   = idx % 7 === 5 || idx % 7 === 6;
              const isWorkWeekend = isWeekend && entries.length > 0;
              const isToday  = ds === todayStr;
              const isSelected = selectedDay === ds;

              return (
                <div
                  key={idx}
                  onClick={() => { setSelectedDay(isSelected ? null : ds); setEditId(null); }}
                  className={`min-h-[76px] p-1.5 border-b border-r border-gray-100 dark:border-gray-800 cursor-pointer transition-colors select-none
                    ${isSelected
                      ? "bg-green-50 dark:bg-green-950/50 ring-1 ring-inset ring-green-400/60 dark:ring-green-600/60"
                      : isWeekend && !isWorkWeekend
                      ? "bg-slate-100/80 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                      : "hover:bg-gray-50/80 dark:hover:bg-gray-800/50"
                    }`}
                >
                  {/* Day number */}
                  <div className={`text-xs font-bold mb-1 w-5 h-5 flex items-center justify-center rounded-full leading-none
                    ${isToday
                      ? "bg-green-700 text-white"
                      : isWeekend && !isWorkWeekend
                      ? "text-slate-400 dark:text-slate-500"
                      : isSelected
                      ? "text-green-700 dark:text-green-400"
                      : "text-gray-600 dark:text-gray-400"
                    }`}>
                    {dayNum}
                  </div>

                  {/* Entry indicators */}
                  <div className="flex flex-col gap-[3px]">
                    {entries.slice(0, 3).map((u, i) => (
                      <div key={i} className="flex items-center gap-0.5">
                        <span className={`w-[5px] h-[5px] rounded-full flex-shrink-0 ${VRSTA_DOT[u.vrsta] ?? "bg-gray-400"}`} />
                        <span className="text-[8px] leading-none text-gray-500 dark:text-gray-400 truncate font-medium">
                          {showWorkerName
                            ? (u.korisnik?.fullName || u.korisnik?.ime || VRSTA_SHORT[u.vrsta])?.slice(0, 5)
                            : VRSTA_SHORT[u.vrsta]}
                        </span>
                      </div>
                    ))}
                    {entries.length > 3 && (
                      <span className="text-[8px] leading-none text-gray-400 dark:text-gray-500 pl-2 font-medium">
                        +{entries.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Day detail panel ─────────────────────────────────────────────────── */}
      {selectedDay && (
        <div className="mt-3 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/50">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm capitalize">
              {fmtDateLong(selectedDay)}
            </h3>
            <button
              onClick={() => { setSelectedDay(null); setEditId(null); }}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 text-sm transition-colors"
            >
              ✕
            </button>
          </div>

          {selectedEntries.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
              Nema unosa za ovaj dan.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {selectedEntries.map((u) => {
                const isEditingThis = editId === u.id;
                const edited = wasEdited(u);
                const workerName = u.korisnik?.fullName || u.korisnik?.ime;

                // ── Edit form ──────────────────────────────────────────────
                if (isEditingThis) {
                  return (
                    <div key={u.id} className="px-4 py-4 bg-blue-50/40 dark:bg-blue-950/20">
                      {workerName && showWorkerName && (
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">{workerName}</div>
                      )}
                      <form onSubmit={handleSaveEdit} className="space-y-3">
                        {/* Vrsta chips */}
                        <div className="flex flex-wrap gap-1.5">
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

                        {/* Odjel (only if needed) */}
                        {!NO_ODJEL_VRSTE.has(editForm.vrsta) && (
                          <div style={{ minWidth: 200 }}>
                            <label className={labelCls}>Odjel</label>
                            <select className={inputSmCls} value={editForm.odjelId}
                              onChange={(e) => setEditForm((f) => ({ ...f, odjelId: e.target.value }))}>
                              <option value="">Odjel...</option>
                              {allSortedOdjeli.map((o) => (
                                <option key={o.id} value={o.id}>{o.gj} / {o.broj}</option>
                              ))}
                            </select>
                          </div>
                        )}

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
                        {!["DOZNAKA","VLAKA"].includes(editForm.vrsta) && (
                          <div className="max-w-[280px]">
                            <label className={labelCls}>Napomena</label>
                            <input type="text" maxLength={200} className={inputSmCls} value={editForm.napomena}
                              onChange={(e) => setEditForm((f) => ({ ...f, napomena: e.target.value }))} />
                          </div>
                        )}

                        {editError && (
                          <p className="text-xs text-red-600 dark:text-red-400">{editError}</p>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button type="submit" disabled={editSaving}
                            className="bg-green-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-800 disabled:opacity-50 transition-colors">
                            {editSaving ? "Snimam..." : "Ažuriraj"}
                          </button>
                          <button type="button" onClick={() => setEditId(null)}
                            className="border border-gray-300 dark:border-gray-600 px-3.5 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                            Odustani
                          </button>
                        </div>
                      </form>
                    </div>
                  );
                }

                // ── Read mode ───────────────────────────────────────────────
                const borderColor = {
                  DOZNAKA: "border-l-green-500", VLAKA: "border-l-amber-500",
                  TEREN: "border-l-orange-500", GODISNJI: "border-l-sky-500",
                  KANCELARIJA: "border-l-indigo-500", BOLOVANJE: "border-l-red-500",
                }[u.vrsta] ?? "border-l-gray-400";

                return (
                  <div key={u.id} className={`px-4 py-3 border-l-[3px] ${borderColor}`}>
                    {/* Top row: worker + vrsta badge + actions */}
                    <div className="flex items-start gap-2 mb-1.5">
                      <div className="flex-1 min-w-0">
                        {showWorkerName && workerName && (
                          <div className="font-semibold text-sm text-gray-800 dark:text-gray-100 leading-tight truncate">
                            {workerName}
                          </div>
                        )}
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${VRSTA_BADGE[u.vrsta] ?? ""}`}>
                            {VRSTA_LABEL[u.vrsta]}
                          </span>
                          {u.odjel && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                              Odjel {u.odjel.gj}/{u.odjel.broj}
                            </span>
                          )}
                          {u.vrsta === "DOZNAKA" && (u.brojStabala != null || u.hektari != null) && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                              {u.brojStabala != null && `${u.brojStabala} st`}
                              {u.brojStabala != null && u.hektari != null && " · "}
                              {u.hektari != null && `${u.hektari.toFixed(2)} ha`}
                            </span>
                          )}
                          {u.vrsta === "VLAKA" && u.kilometri != null && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{u.kilometri.toFixed(2)} km</span>
                          )}
                        </div>
                        {u.napomena && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-0.5">{u.napomena}</p>
                        )}
                      </div>

                      {/* Action buttons (admin/operater only) */}
                      {canEdit && (
                        <div className="flex items-center gap-2 shrink-0 mt-0.5">
                          <button
                            onClick={() => startEdit(u)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                          >
                            Uredi
                          </button>
                          <span className="text-gray-300 dark:text-gray-600">·</span>
                          <button
                            onClick={() => handleDelete(u)}
                            className="text-xs text-red-500 dark:text-red-400 hover:underline"
                          >
                            Obriši
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Audit trail */}
                    <div className="mt-2 space-y-0.5 border-t border-gray-100 dark:border-gray-800 pt-2">
                      {/* Created by */}
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                        <span className="text-gray-300 dark:text-gray-600">↑</span>
                        <span>
                          Unio:{" "}
                          <span className="font-medium text-gray-500 dark:text-gray-400">
                            {personName(u.creator)}
                          </span>
                          {u.creator && (
                            <span className="ml-1 px-1 py-px rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                              {roleLabel(u.creator)}
                            </span>
                          )}
                          {" — "}
                          {fmtAuditTime(u.createdAt)}
                        </span>
                      </div>

                      {/* Edited by (only if was edited) */}
                      {edited && (
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                          <span className="text-amber-400 dark:text-amber-500">✎</span>
                          <span>
                            Editovao:{" "}
                            <span className="font-medium text-gray-500 dark:text-gray-400">
                              {personName(u.updater)}
                            </span>
                            {u.updater && (
                              <span className="ml-1 px-1 py-px rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                                {roleLabel(u.updater)}
                              </span>
                            )}
                            {" — "}
                            {fmtAuditTime(u.updatedAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Monthly recap ────────────────────────────────────────────────────── */}
      {!loading && (
        isAdmin && !selectedWorkerId && allWorkersData
          ? <AdminAllWorkersRecap data={allWorkersData} monthLabel={monthLabel} />
          : visibleUnosi.length > 0
          ? <SingleWorkerRecap recap={singleRecap} monthLabel={monthLabel} />
          : null
      )}

      {/* ── Legend ──────────────────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
        {Object.entries(VRSTA_SHORT).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <span className={`w-2 h-2 rounded-full ${VRSTA_DOT[k]}`} />
            {v}
          </div>
        ))}
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
