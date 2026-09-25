"use client";
import type { PomocniRadnik, VrstaPomocnog } from "@/lib/types";
import { POMOCNI, VRSTE_POMOCNI, rezimeSihte, inicijali, punoIme, type DaniSihte, type DanMjeseca } from "@/lib/pomocni";
import { useCetkaPotez, type Cetka } from "./Cetka";

const DOW = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];

interface Props {
  radnik: PomocniRadnik;
  radnici: PomocniRadnik[];
  kalendar: DanMjeseca[];
  dani: DaniSihte;
  danas: string;
  cetka: Cetka;
  disabled: boolean;
  projektant: string | null;
  onPostavi: (izmjene: Record<number, VrstaPomocnog | null>) => void;
  onOdaberi: (radnikId: string) => void;
}

export function SihtaKalendar({ radnik, radnici, kalendar, dani, danas, cetka, disabled, projektant, onPostavi, onOdaberi }: Props) {
  const potez = useCetkaPotez<number>(cetka, (dan, v) => onPostavi({ [dan]: v }));
  const rez = rezimeSihte(dani, kalendar, danas);
  const idx = radnici.findIndex((r) => r.id === radnik.id);
  const offset = kalendar[0]?.dow ?? 0;
  // Tekući mjesec: samo do danas (kao "Prazno"); budući mjesec: svi dani, za planiranje odsustva
  const buduciMjesec = (kalendar[0]?.datum ?? "") > danas;
  const praznoRadnih = kalendar.filter((d) => d.radni && !dani[String(d.dan)] && (buduciMjesec || d.datum <= danas));
  const btnNav = "w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-30 disabled:hover:bg-transparent text-lg";

  const popuni = () => {
    if (cetka === "BRISI") return;
    onPostavi(Object.fromEntries(praznoRadnih.map((d) => [d.dan, cetka])));
  };

  return (
    <div className="space-y-4">
      {/* Radnik */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-11 h-11 rounded-full bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 flex items-center justify-center text-sm font-bold flex-shrink-0">
          {inicijali(radnik.ime, radnik.prezime)}
        </span>
        <div className="mr-auto min-w-0">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 truncate">{punoIme(radnik)}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{projektant ? `Radi s: ${projektant}` : "Bez projektanta"}</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className={btnNav} disabled={idx <= 0} onClick={() => onOdaberi(radnici[idx - 1].id)} aria-label="Prethodni radnik">‹</button>
          <select id="pomocni-radnik" value={radnik.id} onChange={(e) => onOdaberi(e.target.value)} aria-label="Radnik"
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 max-w-[13rem]">
            {radnici.map((r) => <option key={r.id} value={r.id}>{punoIme(r)}</option>)}
          </select>
          <button type="button" className={btnNav} disabled={idx < 0 || idx >= radnici.length - 1} onClick={() => onOdaberi(radnici[idx + 1].id)} aria-label="Sljedeći radnik">›</button>
        </div>
      </div>

      {/* Rezime */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-px rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-700">
        {VRSTE_POMOCNI.map((v) => (
          <div key={v} className="bg-white dark:bg-gray-900 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <span className={`w-2 h-2 rounded-full ${POMOCNI[v].dot}`} aria-hidden />
              {POMOCNI[v].label}
            </div>
            <div className={`mt-0.5 text-xl font-bold tabular-nums ${rez.po[v] ? POMOCNI[v].text : "text-gray-300 dark:text-gray-600"}`}>{rez.po[v]}</div>
          </div>
        ))}
        <div className="bg-white dark:bg-gray-900 px-3 py-2.5">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Prazno</div>
          <div className={`mt-0.5 text-xl font-bold tabular-nums ${rez.nepopunjeno ? "text-amber-600 dark:text-amber-400" : "text-green-700 dark:text-green-400"}`}>
            {rez.nepopunjeno || "✓"}
          </div>
        </div>
      </div>

      {/* Kalendar */}
      <section className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden select-none ${disabled ? "opacity-60 pointer-events-none" : ""}`}>
        <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          {DOW.map((d, i) => (
            <div key={d} className={`py-2 text-center text-[11px] font-semibold uppercase tracking-wide ${i >= 5 ? "text-rose-500 dark:text-rose-400" : "text-gray-500 dark:text-gray-400"}`}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 p-1.5 sm:gap-1.5 sm:p-2">
          {Array.from({ length: offset }, (_, i) => <div key={`e${i}`} aria-hidden />)}
          {kalendar.map((d) => {
            const v = dani[String(d.dan)];
            const prazanRadni = !v && d.radni && d.datum <= danas;
            return (
              <button key={d.dan} type="button" title={d.praznik ?? undefined}
                aria-label={`${d.dan}. — ${v ? POMOCNI[v].label : "prazno"}${d.praznik ? `, ${d.praznik}` : ""}`}
                onPointerDown={(e) => potez.onPointerDown(d.dan, v, e)}
                onPointerEnter={(e) => potez.onPointerEnter(d.dan, e)}
                onClick={() => potez.onClick(d.dan, v)}
                className={`relative h-14 sm:h-16 rounded-lg p-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${
                  v ? POMOCNI[v].badge
                  : prazanRadni ? "border border-dashed border-amber-300 dark:border-amber-700/70 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                  : d.vikend || d.praznik ? "bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800"
                  : "border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                } ${d.datum === danas ? "ring-2 ring-green-600 dark:ring-green-500" : ""}`}>
                <span className={`block text-xs font-semibold tabular-nums ${v ? "" : d.vikend || d.praznik ? "text-rose-500 dark:text-rose-400" : "text-gray-700 dark:text-gray-300"}`}>
                  {d.dan}
                </span>
                {v && <span className="absolute bottom-1.5 right-1.5 text-[11px] font-bold">{POMOCNI[v].kod}</span>}
                {!v && d.praznik && <span className="absolute bottom-1 left-1.5 right-1 text-[9px] leading-tight text-rose-500 dark:text-rose-400 truncate">{d.praznik}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={popuni} disabled={disabled || cetka === "BRISI" || !praznoRadnih.length}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:hover:bg-transparent">
          Popuni prazne radne dane ({praznoRadnih.length}){cetka !== "BRISI" ? ` — ${POMOCNI[cetka].label}` : ""}
        </button>
        <p className="text-xs text-gray-400 dark:text-gray-500">Vikendi i praznici se ne popunjavaju automatski.</p>
      </div>
    </div>
  );
}
