"use client";
import type { Odjel } from "@/lib/types";
import { NO_ODJEL_VRSTE, type UnosEditForm as Form } from "@/lib/unos-edit";
import { VRSTA, VRSTE } from "@/lib/vrste";
import { cmpOdjel } from "@/lib/format";

export const inputSmCls = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-green-500";
export const labelSmCls = "block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5";

export function UnosEditForm({
  form, onChange, odjeli, saving, error, onSubmit, onCancel,
}: {
  form: Form;
  onChange: (patch: Partial<Form>) => void;
  odjeli: Odjel[];
  saving: boolean;
  error: string;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const sortedOdjeli = [...odjeli].sort(cmpOdjel);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {VRSTE.map((v) => (
          <button key={v} type="button"
            onClick={() => onChange({ vrsta: v, brojStabala: "", hektari: "", kilometri: "" })}
            className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
              form.vrsta === v ? VRSTA[v].btnActive : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900"
            }`}>
            {VRSTA[v].label}
          </button>
        ))}
      </div>

      {!NO_ODJEL_VRSTE.has(form.vrsta) && (
        <div className="max-w-[280px]">
          <label className={labelSmCls}>Odjel</label>
          <select className={inputSmCls} value={form.odjelId}
            onChange={(e) => onChange({ odjelId: e.target.value })}>
            <option value="">Odjel...</option>
            {sortedOdjeli.map((o) => (
              <option key={o.id} value={o.id}>{o.gj} / {o.broj}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {form.vrsta === "DOZNAKA" && (
          <>
            <div className="w-24">
              <label className={labelSmCls}>Stabala</label>
              <input type="text" inputMode="numeric" className={inputSmCls} value={form.brojStabala}
                onChange={(e) => onChange({ brojStabala: e.target.value })} />
            </div>
            <div className="w-28">
              <label className={labelSmCls}>Hektari (ha)</label>
              <input type="text" inputMode="decimal" className={inputSmCls} value={form.hektari}
                onChange={(e) => onChange({ hektari: e.target.value })} />
            </div>
          </>
        )}
        {form.vrsta === "VLAKA" && (
          <div className="w-28">
            <label className={labelSmCls}>Kilometri (km)</label>
            <input type="text" inputMode="decimal" className={inputSmCls} value={form.kilometri}
              onChange={(e) => onChange({ kilometri: e.target.value })} />
          </div>
        )}
        <div className="flex-1 min-w-[130px]">
          <label className={labelSmCls}>Napomena</label>
          <input type="text" maxLength={200} className={inputSmCls} value={form.napomena}
            onChange={(e) => onChange({ napomena: e.target.value })} />
        </div>
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving}
          className="bg-green-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-800 disabled:opacity-50 transition-colors">
          {saving ? "Snimam..." : "Ažuriraj"}
        </button>
        <button type="button" onClick={onCancel}
          className="border border-gray-300 dark:border-gray-600 px-3.5 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          Odustani
        </button>
      </div>
    </form>
  );
}
