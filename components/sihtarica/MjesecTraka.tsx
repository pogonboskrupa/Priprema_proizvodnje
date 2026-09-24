"use client";
import type { DanSihtarice } from "@/lib/sihtarica";
import { VRSTA } from "@/lib/vrste";

function stanje(d: DanSihtarice): string {
  if (d.konflikt) return "konflikt";
  if (d.unosi.length) return [...new Set(d.unosi.map((u) => VRSTA[u.vrsta]?.label ?? u.vrsta))].join(", ");
  if (d.praznik) return d.praznik;
  if (d.buduci) return "";
  return d.neradni ? "neradni dan" : "nije upisano";
}

/** Pregled cijelog mjeseca u jednom redu — boja = vrsta rada, klik otvara dan */
export function MjesecTraka({ dani, onPick }: { dani: readonly DanSihtarice[]; onPick: (datum: string) => void }) {
  return (
    <nav aria-label="Pregled mjeseca" className="flex gap-[3px] print:hidden">
      {dani.map((d) => {
        const vrste = [...new Set(d.unosi.map((u) => u.vrsta))];
        const prazno = !d.unosi.length;
        const opis = stanje(d);
        return (
          <button
            key={d.datum}
            type="button"
            onClick={() => onPick(d.datum)}
            disabled={d.buduci}
            title={`${d.dan}.${opis ? ` — ${opis}` : ""}`}
            aria-label={`${d.dan}. ${opis}`}
            className={`group flex-1 min-w-0 flex flex-col items-stretch gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 disabled:cursor-default`}
          >
            <span className={`h-7 rounded-[4px] overflow-hidden flex flex-col transition-transform group-enabled:group-hover:-translate-y-0.5 ${
              d.konflikt ? "ring-2 ring-red-500 ring-offset-1 dark:ring-offset-gray-950" : d.danas ? "ring-2 ring-green-700 ring-offset-1 dark:ring-offset-gray-950" : ""
            } ${
              !prazno ? "" :
              d.buduci ? "border border-dashed border-gray-200 dark:border-gray-700" :
              d.praznik ? "bg-rose-200 dark:bg-rose-900/60" :
              d.neradni ? "bg-gray-200 dark:bg-gray-700/60" :
              "bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700"
            }`}>
              {vrste.map((v) => <span key={v} className={`flex-1 ${VRSTA[v].dot}`} />)}
            </span>
            <span className={`hidden sm:block text-[10px] leading-none text-center tabular-nums ${
              d.danas ? "font-bold text-green-700 dark:text-green-400" : d.neradni ? "text-gray-400 dark:text-gray-600" : "text-gray-500 dark:text-gray-400"
            }`}>
              {d.dan}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
