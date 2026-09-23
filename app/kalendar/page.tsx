"use client";
import { useEffect, useState, useMemo } from "react";
import { getUnosiZaMjesec, getKorisnici } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { UnosRada, Korisnik } from "@/lib/types";
import { monthYearLabel, fmtDateLong } from "@/lib/format";

const DAY_NAMES = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];

const VRSTA_DOT: Record<string, string> = {
  DOZNAKA: "bg-green-500",
  VLAKA: "bg-amber-500",
  TEREN: "bg-orange-500",
  GODISNJI: "bg-sky-500",
  KANCELARIJA: "bg-indigo-500",
  BOLOVANJE: "bg-red-500",
};

const VRSTA_LABEL: Record<string, string> = {
  DOZNAKA: "Doznaka",
  VLAKA: "Vlaka",
  TEREN: "Teren",
  KANCELARIJA: "Kancelarija",
  GODISNJI: "Godišnji",
  BOLOVANJE: "Bolovanje",
};

const VRSTA_SHORT: Record<string, string> = {
  DOZNAKA: "Doz",
  VLAKA: "Vl",
  TEREN: "Ter",
  GODISNJI: "God",
  KANCELARIJA: "Kan",
  BOLOVANJE: "Bol",
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

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOffset(year: number, month: number) {
  const day = new Date(year, month - 1, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

// ── Recap computation ──────────────────────────────────────────────────────────

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
      case "DOZNAKA":
        a.doz.add(ds); a.ha += Number(u.hektari) || 0; a.stabala += Number(u.brojStabala) || 0; break;
      case "VLAKA":
        a.vl.add(ds); a.km += Number(u.kilometri) || 0; break;
      case "TEREN":      a.ter.add(ds); break;
      case "KANCELARIJA":a.kan.add(ds); break;
      case "GODISNJI":   a.god.add(ds); break;
      case "BOLOVANJE":  a.bol.add(ds); break;
    }
  }

  return workers
    .map((w) => {
      const a = map[w.id];
      return {
        id: w.id, name: w.fullName || w.ime,
        totalDays: a.total.size,
        doz: a.doz.size, vl: a.vl.size, ter: a.ter.size,
        kan: a.kan.size, god: a.god.size, bol: a.bol.size,
        ha: a.ha, stabala: a.stabala, km: a.km,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ── Recap components ──────────────────────────────────────────────────────────

function SingleWorkerRecap({
  recap, monthLabel,
}: {
  recap: ReturnType<typeof computeRecap>;
  monthLabel: string;
}) {
  const { byVrsta, totalDays } = recap;
  if (totalDays === 0) return null;
  const present = VRSTA_ORDER.filter((v) => byVrsta[v]);

  return (
    <div className="mt-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Rekapitulacija</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 capitalize truncate">{monthLabel}</span>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2 flex-shrink-0">
          <span className="text-2xl font-bold tabular-nums leading-none text-gray-800 dark:text-gray-100">
            {totalDays}
          </span>
          <div className="text-xs leading-snug text-gray-500 dark:text-gray-400">
            <div>dana</div>
            <div className="font-semibold text-gray-600 dark:text-gray-300">{totalDays * 8} h</div>
          </div>
        </div>
      </div>

      {/* Tiles */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {present.map((vrsta) => {
          const s = byVrsta[vrsta];
          const days = s.days.size;
          const tileClass = VRSTA_TILE_BORDER[vrsta] ?? "border-l-gray-400 text-gray-600 dark:text-gray-300";
          return (
            <div
              key={vrsta}
              className={`border-l-[3px] rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30 p-3 flex flex-col gap-1 ${tileClass}`}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {VRSTA_LABEL[vrsta]}
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-bold tabular-nums text-gray-800 dark:text-gray-100 leading-none">
                  {days}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">
                  d · {days * 8}h
                </span>
              </div>
              {vrsta === "DOZNAKA" && (s.ha > 0 || s.stabala > 0) && (
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-snug">
                  {s.ha > 0 && <span>{s.ha.toFixed(2)} ha</span>}
                  {s.ha > 0 && s.stabala > 0 && <span className="mx-1">·</span>}
                  {s.stabala > 0 && <span>{s.stabala.toLocaleString()} stabala</span>}
                </div>
              )}
              {vrsta === "VLAKA" && s.km > 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {s.km.toFixed(2)} km
                </div>
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

function AdminAllWorkersRecap({
  data, monthLabel,
}: {
  data: WorkerRow[];
  monthLabel: string;
}) {
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
              <tr
                key={w.id}
                className={`border-t border-gray-100 dark:border-gray-800 transition-colors ${
                  w.totalDays === 0
                    ? "opacity-40"
                    : "hover:bg-gray-50/60 dark:hover:bg-gray-800/40"
                }`}
              >
                <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-100">{w.name}</td>
                <td className="px-3 py-2.5 text-center font-bold tabular-nums text-gray-800 dark:text-gray-100">
                  {w.totalDays || "–"}
                </td>
                <td className="px-3 py-2.5 text-center tabular-nums text-gray-500 dark:text-gray-400">
                  {w.totalDays ? w.totalDays * 8 : "–"}
                </td>
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
                <td
                  className="px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
                  colSpan={9}
                >
                  Ukupno
                </td>
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

export default function KalendarPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const isWorker = session?.role === "worker";
  const isAdmin = session?.role === "admin";

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [unosi, setUnosi] = useState<UnosRada[]>([]);
  const [workers, setWorkers] = useState<Korisnik[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !session) router.replace("/login/");
  }, [session, authLoading]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    getUnosiZaMjesec(year, month)
      .then((u) => setUnosi(u))
      .finally(() => setLoading(false));
  }, [session, year, month]);

  useEffect(() => {
    if (!session || !isAdmin) return;
    getKorisnici().then((k) => setWorkers(k.filter((w) => w.role === "worker")));
  }, [session, isAdmin]);

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

  const visibleUnosi = useMemo(() => {
    if (isWorker) return unosi.filter((u) => u.inzinjerId === session.userId);
    if (selectedWorkerId) return unosi.filter((u) => u.inzinjerId === selectedWorkerId);
    return unosi;
  }, [unosi, isWorker, selectedWorkerId, session]);

  const byDay = useMemo(() => {
    const map: Record<string, UnosRada[]> = {};
    for (const u of visibleUnosi) {
      const key = u.datum.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(u);
    }
    return map;
  }, [visibleUnosi]);

  const singleRecap = useMemo(() => computeRecap(visibleUnosi), [visibleUnosi]);
  const allWorkersData = useMemo(() => {
    if (!isAdmin || selectedWorkerId || workers.length === 0) return null;
    return computeAllWorkersRecap(unosi, workers);
  }, [isAdmin, selectedWorkerId, workers, unosi]);

  const daysInMonth = getDaysInMonth(year, month);
  const offset = getFirstDayOffset(year, month);
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;
  const monthLabel = monthYearLabel(year, month);
  const selectedEntries = selectedDay ? (byDay[selectedDay] ?? []) : [];

  return (
    <div className="py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mr-auto">Kalendar</h1>

        {isAdmin && workers.length > 0 && (
          <select
            value={selectedWorkerId ?? ""}
            onChange={(e) => { setSelectedWorkerId(e.target.value || null); setSelectedDay(null); }}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="">Svi radnici</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>{w.fullName || w.ime}</option>
            ))}
          </select>
        )}

        <button
          onClick={prevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
        >‹</button>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 capitalize min-w-36 text-center">
          {monthLabel}
        </span>
        <button
          onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
        >›</button>
      </div>

      {/* Calendar grid */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {DAY_NAMES.map((d, i) => (
            <div
              key={d}
              className={`text-center py-2 text-xs font-semibold ${
                i === 6 ? "text-red-500 dark:text-red-400" : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">Učitavanje...</div>
        ) : (
          <div className="grid grid-cols-7">
            {Array.from({ length: totalCells }).map((_, idx) => {
              const dayNum = idx - offset + 1;
              if (dayNum < 1 || dayNum > daysInMonth) {
                return (
                  <div
                    key={idx}
                    className="min-h-[72px] border-b border-r border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50"
                  />
                );
              }

              const ds = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
              const entries = byDay[ds] ?? [];
              const isSun = idx % 7 === 6;
              const isToday = ds === now.toISOString().slice(0, 10);
              const isSelected = selectedDay === ds;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDay(isSelected ? null : ds)}
                  className={`min-h-[72px] p-1.5 border-b border-r border-gray-100 dark:border-gray-800 cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-green-50 dark:bg-green-950/40"
                      : isSun
                      ? "bg-red-50/30 dark:bg-red-950/10 hover:bg-red-50 dark:hover:bg-red-950/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  }`}
                >
                  <div
                    className={`text-xs font-semibold mb-1 w-5 h-5 flex items-center justify-center rounded-full ${
                      isToday
                        ? "bg-green-700 text-white"
                        : isSun
                        ? "text-red-500 dark:text-red-400"
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {dayNum}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {entries.slice(0, 3).map((u, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${VRSTA_DOT[u.vrsta] ?? "bg-gray-400"}`} />
                        <span className="text-[9px] leading-tight text-gray-600 dark:text-gray-400 truncate">
                          {VRSTA_SHORT[u.vrsta]}
                        </span>
                      </div>
                    ))}
                    {entries.length > 3 && (
                      <div className="text-[9px] text-gray-400 dark:text-gray-500 pl-2.5">
                        +{entries.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Day detail */}
      {selectedDay && (
        <div className="mt-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-3 text-sm">
            {fmtDateLong(selectedDay)}
          </h3>
          {selectedEntries.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Nema unosa za ovaj dan.</p>
          ) : (
            <div className="space-y-2">
              {selectedEntries.map((u, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0"
                >
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${VRSTA_DOT[u.vrsta] ?? "bg-gray-400"}`} />
                  <div className="flex-1 min-w-0">
                    {u.odjel?.broj && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">Odjel {u.odjel.broj}</div>
                    )}
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      <span className="font-medium">{u.vrsta}</span>
                      {u.vrsta === "DOZNAKA" && (
                        <>
                          {u.brojStabala != null && <span>{u.brojStabala} st</span>}
                          {u.hektari != null && <span>{u.hektari.toFixed(2)} ha</span>}
                        </>
                      )}
                      {u.vrsta === "VLAKA" && u.kilometri != null && (
                        <span>{u.kilometri.toFixed(2)} km</span>
                      )}
                      {u.napomena && <span className="italic">{u.napomena}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Monthly recap */}
      {!loading && (
        isAdmin && !selectedWorkerId && allWorkersData
          ? <AdminAllWorkersRecap data={allWorkersData} monthLabel={monthLabel} />
          : visibleUnosi.length > 0
          ? <SingleWorkerRecap recap={singleRecap} monthLabel={monthLabel} />
          : null
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {Object.entries(VRSTA_SHORT).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className={`w-2.5 h-2.5 rounded-full ${VRSTA_DOT[k]}`} />
            {v}
          </div>
        ))}
      </div>
    </div>
  );
}
