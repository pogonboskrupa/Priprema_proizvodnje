"use client";
import type { ReactNode } from "react";
import { DANI_KRATKO, ucinakLabel, type DanSihtarice } from "@/lib/sihtarica";
import { vrsta as vrstaStyle } from "@/lib/vrste";

export function DanRed({
  dan, open, canEdit, onToggle, editor,
}: {
  dan: DanSihtarice;
  open: boolean;
  canEdit: boolean;
  onToggle: () => void;
  editor: ReactNode;
}) {
  const prazanRadni = !dan.vikend && !dan.buduci && dan.unosi.length === 0;
  const clickable = canEdit && !dan.buduci;

  return (
    <li className={`relative border-b border-gray-100 dark:border-gray-800 last:border-b-0 break-inside-avoid ${
      dan.vikend ? "bg-gray-50/80 dark:bg-gray-800/30" : "bg-white dark:bg-gray-900"
    } ${open ? "ring-2 ring-inset ring-green-600/40 z-10" : ""}`}>
      {dan.danas && <span className="absolute left-0 inset-y-0 w-1 bg-green-600 print:hidden" aria-hidden />}
      <button
        type="button"
        onClick={onToggle}
        disabled={!clickable}
        aria-expanded={open}
        className={`w-full grid grid-cols-[3.25rem_1fr_auto] items-center gap-3 px-3 py-2 text-left min-h-[3rem] focus:outline-none focus-visible:bg-green-50 dark:focus-visible:bg-green-950/30 ${
          clickable ? "hover:bg-green-50/60 dark:hover:bg-green-950/20 cursor-pointer" : "cursor-default"
        } ${dan.buduci ? "opacity-45" : ""}`}
      >
        <div className={`flex flex-col items-center justify-center leading-none rounded-lg py-1 ${
          dan.danas ? "bg-green-700 text-white" : ""
        }`}>
          <span className={`text-lg font-bold tabular-nums ${
            dan.danas ? "" : dan.weekday === 0 ? "text-red-600 dark:text-red-400" : dan.vikend ? "text-gray-500 dark:text-gray-400" : "text-gray-800 dark:text-gray-100"
          }`}>
            {dan.dan}
          </span>
          <span className={`text-[10px] uppercase tracking-wider mt-0.5 ${dan.danas ? "text-white/80" : "text-gray-400 dark:text-gray-500"}`}>
            {DANI_KRATKO[dan.weekday]}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 min-w-0">
          {dan.unosi.map((u) => {
            const vs = vrstaStyle(u.vrsta);
            const ucinak = ucinakLabel(u);
            return (
              <span key={u.id}
                className={`inline-flex items-center gap-1.5 max-w-full rounded-md border-l-[3px] ${vs.borderL} ${vs.badge} px-2 py-1 text-xs print:bg-transparent`}>
                <b className="font-semibold">{vs.label}</b>
                {u.odjel && <span className="font-mono opacity-90">{u.odjel.gj}/{u.odjel.broj}</span>}
                {ucinak && <span className="tabular-nums">{ucinak}</span>}
                {u.napomena && <span className="italic opacity-70 truncate max-w-[14rem]" title={u.napomena}>„{u.napomena}“</span>}
              </span>
            );
          })}
          {dan.unosi.length === 0 && prazanRadni && (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden />
              nije upisano
            </span>
          )}
          {dan.unosi.length === 0 && dan.vikend && !dan.buduci && (
            <span className="text-xs text-gray-400 dark:text-gray-500">vikend</span>
          )}
        </div>

        {clickable ? (
          <span className={`w-7 h-7 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500 transition-transform print:hidden ${
            open ? "rotate-45 text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40" : ""
          }`} aria-hidden>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" d="M12 5v14M5 12h14" />
            </svg>
          </span>
        ) : <span className="w-7" />}
      </button>
      {open && editor}
    </li>
  );
}
