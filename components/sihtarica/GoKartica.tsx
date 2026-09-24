"use client";
import { useState } from "react";
import type { GoPeriod } from "@/lib/godisnji";
import { fmtDate } from "@/lib/format";

export function GoKartica({
  period, ugovor, iskoristeno, canEdit, onSave,
}: {
  period: GoPeriod;
  ugovor: number | undefined;
  iskoristeno: number;
  canEdit: boolean;
  onSave: (dana: number | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState(ugovor?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const imaUgovor = typeof ugovor === "number";
  const preostalo = imaUgovor ? ugovor - iskoristeno : null;
  const pct = imaUgovor && ugovor > 0 ? Math.min(100, (iskoristeno / ugovor) * 100) : 0;
  const dirty = draft.trim() !== (ugovor?.toString() ?? "");

  async function save() {
    const t = draft.trim();
    const n = t === "" ? null : Number(t);
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 60)) {
      setError("Upiši cijeli broj od 0 do 60.");
      return;
    }
    setSaving(true);
    setError("");
    try { await onSave(n); } catch { setError("Greška pri snimanju."); }
    setSaving(false);
  }

  return (
    <section className="rounded-xl border border-sky-200 dark:border-sky-900 bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/40 dark:to-gray-900 p-4 print:border-gray-400 print:bg-none">
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-3">
        <h2 className="text-sm font-semibold text-sky-900 dark:text-sky-200">
          Godišnji odmor <span className="font-mono">{period.label}</span>
        </h2>
        <span className="text-[11px] text-sky-700/70 dark:text-sky-300/60 tabular-nums">
          {fmtDate(period.od)} – {fmtDate(period.do)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Po ugovoru</div>
          {canEdit ? (
            <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex items-center gap-1">
              <input
                id="go-ugovor"
                type="text" inputMode="numeric" maxLength={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
                placeholder="—"
                className="w-14 border border-sky-300 dark:border-sky-800 rounded-lg px-2 py-1 text-lg font-bold tabular-nums bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-400 print:border-0 print:p-0"
                aria-label="Broj dana godišnjeg odmora po ugovoru"
              />
              {dirty && (
                <button type="submit" disabled={saving}
                  className="text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg px-2 py-1.5 disabled:opacity-50 print:hidden">
                  {saving ? "…" : "Sačuvaj"}
                </button>
              )}
            </form>
          ) : (
            <div className="text-2xl font-bold tabular-nums text-gray-800 dark:text-gray-100">{imaUgovor ? ugovor : "—"}</div>
          )}
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Iskorišteno</div>
          <div className="text-2xl font-bold tabular-nums text-sky-700 dark:text-sky-300">{iskoristeno}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Preostalo</div>
          <div className={`text-2xl font-bold tabular-nums ${
            preostalo === null ? "text-gray-400" : preostalo < 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"
          }`}>
            {preostalo ?? "—"}
          </div>
        </div>
      </div>

      {imaUgovor ? (
        <div className="mt-3 h-2 rounded-full bg-sky-100 dark:bg-sky-900/50 overflow-hidden" role="progressbar"
          aria-valuemin={0} aria-valuemax={ugovor} aria-valuenow={iskoristeno}>
          <div className={`h-full rounded-full ${preostalo !== null && preostalo < 0 ? "bg-red-500" : "bg-sky-500"}`} style={{ width: `${pct}%` }} />
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {canEdit ? "Upiši broj dana po ugovoru — iskorišteni dani se oduzimaju od 1. jula." : "Broj dana po ugovoru upisuje administrator."}
        </p>
      )}
      {imaUgovor && (
        <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">Računaju se samo radni dani — vikendi i praznici se ne troše iz godišnjeg.</p>
      )}
      {preostalo !== null && preostalo < 0 && (
        <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">Prekoračeno za {-preostalo} {-preostalo === 1 ? "dan" : "dana"}.</p>
      )}
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}
