'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getPomocniRadnici,
  createPomocniRadnik,
  updatePomocniRadnik,
  getSihtaPomocnog,
  saveSihtaPomocnog,
} from '@/lib/db';
import type { PomocniRadnik, Korisnik, VrstaPomocnog } from '@/lib/types';

// ── helpers ───────────────────────────────────────────────────────────────────

const VRSTE: VrstaPomocnog[] = ['TEREN', 'GODISNJI', 'BOLOVANJE', 'KANCELARIJA', 'OSTALO'];
const VRSTA_LABEL: Record<VrstaPomocnog, string> = {
  TEREN: 'Teren',
  GODISNJI: 'Godišnji',
  BOLOVANJE: 'Bolovanje',
  KANCELARIJA: 'Kancelarija',
  OSTALO: 'Ostalo',
};
const VRSTA_CLS: Record<VrstaPomocnog, string> = {
  TEREN:      'bg-green-500 text-white',
  GODISNJI:   'bg-sky-500 text-white',
  BOLOVANJE:  'bg-red-500 text-white',
  KANCELARIJA:'bg-violet-500 text-white',
  OSTALO:     'bg-gray-400 text-white',
};
const VRSTA_BORDER: Record<VrstaPomocnog, string> = {
  TEREN:      'border-green-500',
  GODISNJI:   'border-sky-500',
  BOLOVANJE:  'border-red-500',
  KANCELARIJA:'border-violet-500',
  OSTALO:     'border-gray-400',
};

const MONTH_NAMES = [
  'Januar','Februar','Mart','April','Maj','Juni',
  'Juli','August','Septembar','Oktobar','Novembar','Decembar',
];
const DOW = ['Pon','Uto','Sri','Čet','Pet','Sub','Ned'];

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

// dow 0=Sun → 1-indexed Mon=0
function firstDow(year: number, month: number) {
  const d = new Date(year, month - 1, 1).getDay();
  return d === 0 ? 6 : d - 1; // Mon=0…Sun=6
}

// ── sub-tab: Šihtarica ────────────────────────────────────────────────────────

interface SihtaricaProps {
  radnici: PomocniRadnik[];
}

function Sihtarica({ radnici }: SihtaricaProps) {
  const aktivni = radnici.filter((r) => r.aktivan);
  const now = new Date();
  const [godina, setGodina] = useState(now.getFullYear());
  const [mjesec, setMjesec] = useState(now.getMonth() + 1);
  const [radnikId, setRadnikId] = useState<string>(aktivni[0]?.id ?? '');
  const [dani, setDani] = useState<Record<string, VrstaPomocnog>>({});
  const [picker, setPicker] = useState<{ dan: number; x: number; y: number } | null>(null);
  const [loading, setLoading] = useState(false);

  // load when radnik/period changes
  useEffect(() => {
    if (!radnikId) return;
    setLoading(true);
    getSihtaPomocnog(radnikId, godina, mjesec)
      .then(setDani)
      .finally(() => setLoading(false));
  }, [radnikId, godina, mjesec]);

  // sync radnikId when list changes
  useEffect(() => {
    if (radnikId && aktivni.find((r) => r.id === radnikId)) return;
    setRadnikId(aktivni[0]?.id ?? '');
  }, [aktivni, radnikId]);

  const setDay = useCallback(
    async (dan: number, vrsta: VrstaPomocnog | null) => {
      const next = { ...dani };
      if (vrsta === null) {
        delete next[String(dan)];
      } else {
        next[String(dan)] = vrsta;
      }
      setDani(next);
      setPicker(null);
      await saveSihtaPomocnog(radnikId, godina, mjesec, next);
    },
    [dani, radnikId, godina, mjesec]
  );

  const total = daysInMonth(godina, mjesec);
  const offset = firstDow(godina, mjesec); // 0=Mon … 6=Sun
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  // pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (mjesec === 1) { setGodina((y) => y - 1); setMjesec(12); }
    else setMjesec((m) => m - 1);
  };
  const nextMonth = () => {
    if (mjesec === 12) { setGodina((y) => y + 1); setMjesec(1); }
    else setMjesec((m) => m + 1);
  };

  return (
    <div className="space-y-4">
      {/* header controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          className="border rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
          value={radnikId}
          onChange={(e) => setRadnikId(e.target.value)}
        >
          {aktivni.length === 0 && <option value="">— nema aktivnih radnika —</option>}
          {aktivni.map((r) => (
            <option key={r.id} value={r.id}>{r.prezime} {r.ime}</option>
          ))}
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">‹</button>
          <span className="text-sm font-medium w-36 text-center">
            {MONTH_NAMES[mjesec - 1]} {godina}
          </span>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">›</button>
        </div>
      </div>

      {/* legend */}
      <div className="flex flex-wrap gap-2">
        {VRSTE.map((v) => (
          <span key={v} className={`text-xs px-2 py-0.5 rounded-full ${VRSTA_CLS[v]}`}>
            {VRSTA_LABEL[v]}
          </span>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-500">Učitavanje...</p>}

      {/* calendar grid */}
      <div className="relative">
        {picker && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPicker(null)} />
            <div
              className="fixed z-50 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-xl shadow-lg p-2 flex flex-col gap-1 min-w-[140px]"
              style={{ top: picker.y, left: picker.x }}
            >
              {VRSTE.map((v) => (
                <button
                  key={v}
                  onClick={() => setDay(picker.dan, v)}
                  className={`text-left text-xs px-3 py-1.5 rounded-lg ${VRSTA_CLS[v]} hover:opacity-90`}
                >
                  {VRSTA_LABEL[v]}
                </button>
              ))}
              <button
                onClick={() => setDay(picker.dan, null)}
                className="text-left text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Obriši
              </button>
            </div>
          </>
        )}

        <div className="grid grid-cols-7 gap-1">
          {DOW.map((d) => (
            <div key={d} className="text-xs text-center font-medium text-gray-500 dark:text-gray-400 pb-1">
              {d}
            </div>
          ))}
          {cells.map((dan, idx) => {
            if (!dan) return <div key={`e${idx}`} />;
            const vrsta = dani[String(dan)];
            return (
              <button
                key={dan}
                onClick={(e) => {
                  const rect = (e.target as HTMLElement).getBoundingClientRect();
                  setPicker({ dan, x: rect.left, y: rect.bottom + 4 });
                }}
                className={`aspect-square flex flex-col items-center justify-center rounded-lg border-2 text-xs font-semibold transition-colors
                  ${vrsta
                    ? `${VRSTA_CLS[vrsta]} ${VRSTA_BORDER[vrsta]}`
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-400 text-gray-700 dark:text-gray-300'
                  }`}
              >
                {dan}
              </button>
            );
          })}
        </div>
      </div>

      {/* summary */}
      <div className="flex flex-wrap gap-3 text-sm pt-1">
        {VRSTE.map((v) => {
          const cnt = Object.values(dani).filter((x) => x === v).length;
          if (!cnt) return null;
          return (
            <span key={v} className={`px-2 py-0.5 rounded-full text-xs ${VRSTA_CLS[v]}`}>
              {VRSTA_LABEL[v]}: {cnt}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── sub-tab: Radnici ──────────────────────────────────────────────────────────

interface RadniciListaProps {
  radnici: PomocniRadnik[];
  korisnici: Korisnik[];
  onRefresh: () => void;
}

function RadniciLista({ radnici, korisnici, onRefresh }: RadniciListaProps) {
  const [ime, setIme] = useState('');
  const [prezime, setPrezime] = useState('');
  const [saving, setSaving] = useState(false);
  const [showArhiv, setShowArhiv] = useState(false);

  const aktivni = radnici.filter((r) => r.aktivan);
  const arhivirani = radnici.filter((r) => !r.aktivan);

  const projektanti = korisnici.filter((k) => !k.arhiviran && k.role === 'worker');

  const handleAdd = async () => {
    if (!ime.trim() || !prezime.trim()) return;
    setSaving(true);
    try {
      await createPomocniRadnik({ ime: ime.trim(), prezime: prezime.trim() });
      setIme('');
      setPrezime('');
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (r: PomocniRadnik) => {
    await updatePomocniRadnik(r.id, { aktivan: false });
    onRefresh();
  };

  const handleRestore = async (r: PomocniRadnik) => {
    await updatePomocniRadnik(r.id, { aktivan: true });
    onRefresh();
  };

  const handleProjektant = async (r: PomocniRadnik, val: string) => {
    await updatePomocniRadnik(r.id, { projektantId: val || null });
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* add form */}
      <div className="flex flex-wrap gap-2 items-end border dark:border-gray-700 rounded-xl p-3 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Prezime</label>
          <input
            className="border rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-600 w-36"
            value={prezime}
            onChange={(e) => setPrezime(e.target.value)}
            placeholder="Prezime"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Ime</label>
          <input
            className="border rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-600 w-32"
            value={ime}
            onChange={(e) => setIme(e.target.value)}
            placeholder="Ime"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={saving || !ime.trim() || !prezime.trim()}
          className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? '...' : 'Dodaj'}
        </button>
      </div>

      {/* active list */}
      {aktivni.length === 0 && (
        <p className="text-sm text-gray-500">Nema aktivnih radnika.</p>
      )}
      <div className="divide-y dark:divide-gray-700">
        {aktivni.map((r) => (
          <div key={r.id} className="flex flex-wrap gap-3 items-center py-2.5">
            <span className="text-sm font-medium w-40">{r.prezime} {r.ime}</span>
            <select
              className="border rounded-lg px-2 py-1 text-xs bg-white dark:bg-gray-800 dark:border-gray-600"
              value={r.projektantId ?? ''}
              onChange={(e) => handleProjektant(r, e.target.value)}
            >
              <option value="">— bez projektanta —</option>
              {projektanti.map((k) => (
                <option key={k.id} value={k.id}>{k.fullName || k.ime}</option>
              ))}
            </select>
            <button
              onClick={() => handleArchive(r)}
              className="ml-auto text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:border-red-400"
            >
              Arhiviraj
            </button>
          </div>
        ))}
      </div>

      {/* archived */}
      {arhivirani.length > 0 && (
        <div>
          <button
            onClick={() => setShowArhiv((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
          >
            <span>{showArhiv ? '▾' : '▸'}</span>
            Arhivirani ({arhivirani.length})
          </button>
          {showArhiv && (
            <div className="mt-2 divide-y dark:divide-gray-700">
              {arhivirani.map((r) => (
                <div key={r.id} className="flex gap-3 items-center py-2 opacity-60">
                  <span className="text-sm w-40">{r.prezime} {r.ime}</span>
                  <button
                    onClick={() => handleRestore(r)}
                    className="ml-auto text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-300"
                  >
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

// ── main component ────────────────────────────────────────────────────────────

interface Props {
  korisnici: Korisnik[];
}

type SubTab = 'radnici' | 'sihtarica';

export default function PomocniRadniciTab({ korisnici }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('radnici');
  const [radnici, setRadnici] = useState<PomocniRadnik[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    getPomocniRadnici().then(setRadnici).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading) {
    return <p className="text-sm text-gray-500 py-4">Učitavanje...</p>;
  }

  return (
    <div className="space-y-4">
      {/* sub-tab toggle */}
      <div className="flex gap-1 border-b dark:border-gray-700 pb-0">
        {(['radnici', 'sihtarica'] as SubTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              subTab === t
                ? 'border-green-600 text-green-700 dark:text-green-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t === 'radnici' ? 'Radnici' : 'Šihtarica'}
          </button>
        ))}
      </div>

      {subTab === 'radnici' && (
        <RadniciLista radnici={radnici} korisnici={korisnici} onRefresh={refresh} />
      )}
      {subTab === 'sihtarica' && (
        <Sihtarica radnici={radnici} />
      )}
    </div>
  );
}
