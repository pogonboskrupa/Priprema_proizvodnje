"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  getPomocniRadnici,
  createPomocniRadnik,
  updatePomocniRadnik,
  getSihtaPomocnog,
  saveSihtaPomocnog,
  getKorisnici,
} from "@/lib/db";
import type { PomocniRadnik, Korisnik, VrstaPomocnog } from "@/lib/types";
import { Icon } from "@/components/Icon";

// ── constants ─────────────────────────────────────────────────────────────────

const VRSTE: VrstaPomocnog[] = ["TEREN", "GODISNJI", "BOLOVANJE", "KANCELARIJA", "OSTALO"];

const VRSTA_CFG: Record<VrstaPomocnog, { label: string; bg: string; ring: string; text: string; dot: string }> = {
  TEREN:      { label: "Teren",      bg: "bg-emerald-500", ring: "ring-emerald-500",  text: "text-emerald-700 dark:text-emerald-400",  dot: "bg-emerald-500" },
  GODISNJI:   { label: "Godišnji",   bg: "bg-sky-500",     ring: "ring-sky-500",      text: "text-sky-700 dark:text-sky-400",          dot: "bg-sky-500" },
  BOLOVANJE:  { label: "Bolovanje",  bg: "bg-rose-500",    ring: "ring-rose-500",     text: "text-rose-700 dark:text-rose-400",        dot: "bg-rose-500" },
  KANCELARIJA:{ label: "Kancelarija",bg: "bg-violet-500",  ring: "ring-violet-500",   text: "text-violet-700 dark:text-violet-400",    dot: "bg-violet-500" },
  OSTALO:     { label: "Ostalo",     bg: "bg-slate-400",   ring: "ring-slate-400",    text: "text-slate-600 dark:text-slate-400",      dot: "bg-slate-400" },
};

const DOW_SHORT = ["Po", "Ut", "Sr", "Če", "Pe", "Su", "Ne"];
const MJ = ["Januar","Februar","Mart","April","Maj","Juni","Juli","August","Septembar","Oktobar","Novembar","Decembar"];

function daysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate(); }
function firstDow(y: number, m: number) { const d = new Date(y, m - 1, 1).getDay(); return d === 0 ? 6 : d - 1; }

// ── Picker ────────────────────────────────────────────────────────────────────

function DayPicker({ onSelect, onClose }: { onSelect: (v: VrstaPomocnog | null) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute z-50 mt-1 w-40 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-1.5 flex flex-col gap-0.5">
      {VRSTE.map((v) => (
        <button key={v} onClick={() => onSelect(v)}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-sm font-medium transition-colors hover:opacity-90 text-white ${VRSTA_CFG[v].bg}`}>
          {VRSTA_CFG[v].label}
        </button>
      ))}
      <div className="h-px bg-gray-100 dark:bg-gray-700 my-0.5" />
      <button onClick={() => onSelect(null)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        Obriši
      </button>
    </div>
  );
}

// ── Šihtarica ─────────────────────────────────────────────────────────────────

function Sihtarica({ radnici }: { radnici: PomocniRadnik[] }) {
  const aktivni = radnici.filter((r) => r.aktivan);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [radnikId, setRadnikId] = useState(aktivni[0]?.id ?? "");
  const [dani, setDani] = useState<Record<string, VrstaPomocnog>>({});
  const [pickerDay, setPickerDay] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!radnikId) return;
    setLoading(true);
    setPickerDay(null);
    getSihtaPomocnog(radnikId, year, month).then(setDani).finally(() => setLoading(false));
  }, [radnikId, year, month]);

  useEffect(() => {
    if (radnikId && aktivni.find((r) => r.id === radnikId)) return;
    setRadnikId(aktivni[0]?.id ?? "");
  }, [aktivni, radnikId]);

  const total = daysInMonth(year, month);
  const offset = firstDow(year, month);
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => month === 1 ? (setYear(y => y - 1), setMonth(12)) : setMonth(m => m - 1);
  const nextMonth = () => month === 12 ? (setYear(y => y + 1), setMonth(1)) : setMonth(m => m + 1);

  const handleSelect = useCallback(async (dan: number, v: VrstaPomocnog | null) => {
    const next = { ...dani };
    if (v === null) delete next[String(dan)]; else next[String(dan)] = v;
    setDani(next);
    setPickerDay(null);
    await saveSihtaPomocnog(radnikId, year, month, next);
  }, [dani, radnikId, year, month]);

  const counts = VRSTE.map(v => ({ v, n: Object.values(dani).filter(x => x === v).length })).filter(x => x.n > 0);
  const radni = Object.values(dani).filter(v => v === "TEREN").length;
  const radnik = aktivni.find(r => r.id === radnikId);

  return (
    <div className="space-y-5">
      {/* month nav + worker select */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* worker pills */}
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          {aktivni.map((r) => (
            <button key={r.id} onClick={() => setRadnikId(r.id)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors border ${
                radnikId === r.id
                  ? "bg-green-700 text-white border-green-700 shadow-sm"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:border-green-500"
              }`}>
              {r.prezime} {r.ime}
            </button>
          ))}
          {aktivni.length === 0 && <p className="text-sm text-gray-400">Dodaj radnika u Evidenciji.</p>}
        </div>

        {/* month nav */}
        <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-1 py-0.5 ml-auto flex-shrink-0">
          <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <Icon name="arrow" className="w-4 h-4 rotate-180" />
          </button>
          <span className="text-sm font-semibold w-40 text-center text-gray-800 dark:text-gray-100">
            {MJ[month - 1]} {year}
          </span>
          <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <Icon name="arrow" className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* calendar card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        {/* header */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {radnik ? (radnik.prezime[0] + radnik.ime[0]).toUpperCase() : "—"}
            </div>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {radnik ? `${radnik.prezime} ${radnik.ime}` : "—"}
            </span>
          </div>
          {loading && <span className="text-xs text-gray-400 animate-pulse">Učitavanje…</span>}
        </div>

        <div className="p-3 sm:p-4">
          {/* dow header */}
          <div className="grid grid-cols-7 mb-1">
            {DOW_SHORT.map((d, i) => (
              <div key={d} className={`text-center text-[11px] font-semibold pb-2 ${i >= 5 ? "text-rose-400" : "text-gray-400 dark:text-gray-500"}`}>{d}</div>
            ))}
          </div>

          {/* day grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((dan, idx) => {
              if (!dan) return <div key={`e${idx}`} />;
              const vrsta = dani[String(dan)];
              const isWeekend = (offset + dan - 1) % 7 >= 5;
              const isToday = year === now.getFullYear() && month === (now.getMonth() + 1) && dan === now.getDate();

              return (
                <div key={dan} className="relative">
                  <button
                    onClick={() => setPickerDay(pickerDay === dan ? null : dan)}
                    className={`w-full aspect-square flex flex-col items-center justify-center rounded-xl text-[13px] font-semibold transition-all
                      ${vrsta
                        ? `${VRSTA_CFG[vrsta].bg} text-white shadow-sm`
                        : isWeekend
                          ? "bg-rose-50 dark:bg-rose-950/20 text-rose-400 dark:text-rose-500"
                          : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }
                      ${isToday ? "ring-2 ring-offset-1 ring-green-500 dark:ring-offset-gray-900" : ""}
                      ${pickerDay === dan ? "ring-2 ring-offset-1 ring-blue-500 dark:ring-offset-gray-900" : ""}
                    `}
                  >
                    {dan}
                  </button>
                  {pickerDay === dan && (
                    <DayPicker onSelect={(v) => handleSelect(dan, v)} onClose={() => setPickerDay(null)} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* summary bar */}
        {counts.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-2 items-center">
            <span className="text-xs text-gray-400 mr-1">Ukupno:</span>
            {counts.map(({ v, n }) => (
              <span key={v} className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${VRSTA_CFG[v].bg} text-white`}>
                {VRSTA_CFG[v].label} · {n}
              </span>
            ))}
            {radni > 0 && (
              <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                {radni} radnih dana
              </span>
            )}
          </div>
        )}
      </div>

      {/* legend */}
      <div className="flex flex-wrap gap-2">
        {VRSTE.map((v) => (
          <span key={v} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <span className={`w-3 h-3 rounded-sm ${VRSTA_CFG[v].bg}`} />
            {VRSTA_CFG[v].label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Evidencija radnika ────────────────────────────────────────────────────────

function Evidencija({ radnici, korisnici, onRefresh }: {
  radnici: PomocniRadnik[];
  korisnici: Korisnik[];
  onRefresh: () => void;
}) {
  const [ime, setIme] = useState("");
  const [prezime, setPrezime] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showArhiv, setShowArhiv] = useState(false);

  const aktivni = radnici.filter(r => r.aktivan);
  const arhivirani = radnici.filter(r => !r.aktivan);
  const projektanti = korisnici.filter(k => !k.arhiviran && k.role === "worker");

  const handleAdd = async () => {
    if (!ime.trim() || !prezime.trim()) return;
    setSaving(true);
    try {
      await createPomocniRadnik({ ime: ime.trim(), prezime: prezime.trim() });
      setIme(""); setPrezime(""); setShowAdd(false);
      onRefresh();
    } finally { setSaving(false); }
  };

  const handleProjektant = async (r: PomocniRadnik, val: string) => {
    await updatePomocniRadnik(r.id, { projektantId: val || null });
    onRefresh();
  };

  const handleArchive = async (r: PomocniRadnik) => {
    await updatePomocniRadnik(r.id, { aktivan: false });
    onRefresh();
  };

  const handleRestore = async (r: PomocniRadnik) => {
    await updatePomocniRadnik(r.id, { aktivan: true });
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* add button */}
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(v => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
            showAdd
              ? "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
              : "bg-green-700 border-green-700 text-white hover:bg-green-800"
          }`}>
          {showAdd ? "Otkaži" : <><Icon name="close" className="w-4 h-4 rotate-45" /> Novi radnik</>}
        </button>
      </div>

      {/* add form */}
      {showAdd && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Novi pomoćni radnik</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Prezime</label>
              <input
                className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 w-36"
                value={prezime} onChange={e => setPrezime(e.target.value)} placeholder="Prezime"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Ime</label>
              <input
                className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 w-32"
                value={ime} onChange={e => setIme(e.target.value)} placeholder="Ime"
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
            </div>
            <button onClick={handleAdd} disabled={saving || !ime.trim() || !prezime.trim()}
              className="px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-xl hover:bg-green-800 disabled:opacity-40 transition-colors">
              {saving ? "Čuvanje…" : "Dodaj"}
            </button>
          </div>
        </div>
      )}

      {/* active workers */}
      {aktivni.length === 0 && !showAdd && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <Icon name="users" className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nema aktivnih radnika.</p>
          <p className="text-xs mt-1">Dodaj prvog radnika.</p>
        </div>
      )}

      <div className="space-y-2">
        {aktivni.map((r) => {
          const proj = korisnici.find(k => k.id === r.projektantId);
          return (
            <div key={r.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-4 py-3 shadow-sm flex flex-wrap gap-3 items-center">
              {/* avatar */}
              <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 flex items-center justify-center text-sm font-bold flex-shrink-0">
                {(r.prezime[0] + r.ime[0]).toUpperCase()}
              </div>
              {/* name */}
              <div className="flex-1 min-w-[140px]">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{r.prezime} {r.ime}</p>
                {proj && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Projektant: {proj.fullName || proj.ime}
                  </p>
                )}
              </div>
              {/* projektant select */}
              <select
                className="border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 text-xs bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                value={r.projektantId ?? ""}
                onChange={e => handleProjektant(r, e.target.value)}
              >
                <option value="">— bez projektanta —</option>
                {projektanti.map(k => (
                  <option key={k.id} value={k.id}>{k.fullName || k.ime}</option>
                ))}
              </select>
              {/* archive */}
              <button onClick={() => handleArchive(r)}
                className="text-xs text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors border border-transparent hover:border-rose-200 dark:hover:border-rose-900">
                Arhiviraj
              </button>
            </div>
          );
        })}
      </div>

      {/* archived */}
      {arhivirani.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setShowArhiv(v => !v)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <Icon name="arrow" className={`w-3.5 h-3.5 transition-transform ${showArhiv ? "rotate-90" : ""}`} />
            Arhivirani ({arhivirani.length})
          </button>
          {showArhiv && (
            <div className="mt-2 space-y-1.5">
              {arhivirani.map((r) => (
                <div key={r.id} className="bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3 flex gap-3 items-center opacity-60 hover:opacity-80 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {(r.prezime[0] + r.ime[0]).toUpperCase()}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 flex-1">{r.prezime} {r.ime}</p>
                  <button onClick={() => handleRestore(r)}
                    className="text-xs text-gray-500 hover:text-green-700 dark:hover:text-green-400 px-2 py-1 rounded-lg hover:bg-green-50 dark:hover:bg-green-950/30 border border-transparent hover:border-green-200 dark:hover:border-green-900 transition-colors">
                    Vrati
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "sihtarica" | "evidencija";

export default function PomocniRadniciPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("sihtarica");
  const [radnici, setRadnici] = useState<PomocniRadnik[]>([]);
  const [korisnici, setKorisnici] = useState<Korisnik[]>([]);
  const [init, setInit] = useState(true);

  const canAccess = session && (session.role === "admin" || session.operater);

  useEffect(() => {
    if (!loading && !session) { router.replace("/login/"); return; }
    if (!loading && session && !canAccess) router.replace("/");
  }, [session, loading]);

  const refresh = useCallback(() => {
    Promise.all([getPomocniRadnici(), getKorisnici()])
      .then(([r, k]) => { setRadnici(r); setKorisnici(k); })
      .catch(() => {})
      .finally(() => setInit(false));
  }, []);

  useEffect(() => { if (canAccess) refresh(); }, [canAccess, refresh]);

  if (loading || init) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          <div className="h-4 w-64 bg-gray-100 dark:bg-gray-800 rounded-xl" />
          <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-2xl mt-6" />
        </div>
      </main>
    );
  }

  if (!canAccess) return null;

  const aktivni = radnici.filter(r => r.aktivan);

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* page header */}
      <div className="flex flex-wrap gap-3 items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 flex items-center gap-2">
            <Icon name="hardhat" className="w-6 h-6 text-green-700 dark:text-green-400" strokeWidth={2} />
            Pomoćni radnici
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {aktivni.length === 0 ? "Nema aktivnih radnika" :
              aktivni.length === 1 ? "1 aktivni radnik" :
              `${aktivni.length} aktivnih radnika`}
          </p>
        </div>

        {/* tab switcher */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
          {([["sihtarica", "Šihtarica"], ["evidencija", "Evidencija"]] as [Tab, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === id
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-50 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "sihtarica" && <Sihtarica radnici={radnici} />}
      {tab === "evidencija" && <Evidencija radnici={radnici} korisnici={korisnici} onRefresh={refresh} />}
    </main>
  );
}
