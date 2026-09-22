"use client";
import { useEffect, useState } from "react";
import { getUnosiZaMjesec, getInzinjerByKorisnikId } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { UnosRada } from "@/lib/types";
import { monthYearLabel, fmtDateLong } from "@/lib/format";

const DAY_NAMES = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];

const VRSTA_COLOR: Record<string, string> = {
  DOZNAKA: "bg-green-500",
  VLAKA: "bg-amber-500",
  TEREN: "bg-orange-500",
  GODISNJI: "bg-sky-500",
  KANCELARIJA: "bg-indigo-500",
  BOLOVANJE: "bg-red-500",
};

const VRSTA_LABEL: Record<string, string> = {
  DOZNAKA: "Doz",
  VLAKA: "Vl",
  TEREN: "Ter",
  GODISNJI: "God",
  KANCELARIJA: "Kan",
  BOLOVANJE: "Bol",
};


function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOffset(year: number, month: number) {
  const day = new Date(year, month - 1, 1).getDay();
  return day === 0 ? 6 : day - 1; // Mon=0..Sun=6
}

export default function KalendarPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const isWorker = session?.role === "worker";
  const [myInzinjerId, setMyInzinjerId] = useState<string | null>(null);
  const [myInzinjerLoaded, setMyInzinjerLoaded] = useState(!isWorker);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [unosi, setUnosi] = useState<UnosRada[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !session) router.replace("/login/");
  }, [session, authLoading]);

  useEffect(() => {
    if (!session || !isWorker) return;
    getInzinjerByKorisnikId(session.userId).then((inz) => {
      setMyInzinjerId(inz?.id ?? null);
      setMyInzinjerLoaded(true);
    });
  }, [session]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    getUnosiZaMjesec(year, month)
      .then((u) => setUnosi(u))
      .finally(() => setLoading(false));
  }, [session, year, month]);

  if (authLoading || !session || !myInzinjerLoaded) return null;

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  }

  const visibleUnosi = isWorker
    ? unosi.filter((u) => u.inzinjerId === myInzinjerId)
    : unosi;

  const byDay: Record<string, UnosRada[]> = {};
  for (const u of visibleUnosi) {
    const key = u.datum.slice(0, 10);
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(u);
  }

  const daysInMonth = getDaysInMonth(year, month);
  const offset = getFirstDayOffset(year, month);
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;

  const monthLabel = monthYearLabel(year, month);

  const selectedKey = selectedDay;
  const selectedEntries = selectedKey ? (byDay[selectedKey] ?? []) : [];

  return (
    <div className="py-6">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mr-auto">Kalendar</h1>
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

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {/* Header */}
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
                return <div key={idx} className="min-h-[72px] border-b border-r border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50" />;
              }

              const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
              const entries = byDay[dateStr] ?? [];
              const isSun = (idx % 7) === 6;
              const isToday = dateStr === now.toISOString().slice(0, 10);
              const isSelected = selectedDay === dateStr;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                  className={`min-h-[72px] p-1.5 border-b border-r border-gray-100 dark:border-gray-800 cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-green-50 dark:bg-green-950/40"
                      : isSun
                      ? "bg-red-50/30 dark:bg-red-950/10 hover:bg-red-50 dark:hover:bg-red-950/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  }`}
                >
                  <div className={`text-xs font-semibold mb-1 w-5 h-5 flex items-center justify-center rounded-full ${
                    isToday
                      ? "bg-green-700 text-white"
                      : isSun
                      ? "text-red-500 dark:text-red-400"
                      : "text-gray-700 dark:text-gray-300"
                  }`}>
                    {dayNum}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {entries.slice(0, 3).map((u, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${VRSTA_COLOR[u.vrsta] ?? "bg-gray-400"}`} />
                        <span className="text-[9px] leading-tight text-gray-600 dark:text-gray-400 truncate">
                          {VRSTA_LABEL[u.vrsta]}
                        </span>
                      </div>
                    ))}
                    {entries.length > 3 && (
                      <div className="text-[9px] text-gray-400 dark:text-gray-500 pl-2.5">+{entries.length - 3}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Day detail panel */}
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
                <div key={i} className="flex items-center gap-3 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${VRSTA_COLOR[u.vrsta] ?? "bg-gray-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      {u.odjel?.broj && <span className="text-xs text-gray-500 dark:text-gray-400">Odjel {u.odjel.broj}</span>}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-3 mt-0.5">
                      <span>{u.vrsta}</span>
                      {u.vrsta === "DOZNAKA" && <><span>{u.brojStabala} st</span><span>{u.hektari?.toFixed(2)} ha</span></>}
                      {u.vrsta === "VLAKA" && <span>{u.kilometri?.toFixed(2)} km</span>}
                      {u.napomena && <span className="italic">{u.napomena}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3">
        {Object.entries(VRSTA_LABEL).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className={`w-2.5 h-2.5 rounded-full ${VRSTA_COLOR[k]}`} />
            {v}
          </div>
        ))}
      </div>
    </div>
  );
}
