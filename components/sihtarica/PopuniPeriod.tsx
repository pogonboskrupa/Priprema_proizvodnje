"use client";
import { useState } from "react";
import type { VrstaRada } from "@/lib/types";
import { VRSTA } from "@/lib/vrste";
import { datumiZaPopunu, type DanSihtarice } from "@/lib/sihtarica";

const VRSTE_PERIODA: readonly VrstaRada[] = ["GODISNJI", "BOLOVANJE", "TEREN", "KANCELARIJA"];

export function PopuniPeriod({
  dani, onSubmit, onClose,
}: {
  dani: readonly DanSihtarice[];
  onSubmit: (vrsta: VrstaRada, datumi: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const dostupni = dani.filter((d) => !d.buduci);
  const prvi = dostupni[0]?.datum ?? "";
  const zadnji = dostupni[dostupni.length - 1]?.datum ?? "";

  const [vrsta, setVrsta] = useState<VrstaRada>("GODISNJI");
  const [od, setOd] = useState(prvi);
  const [do_, setDo] = useState(zadnji);
  const [preskociNeradne, setPreskociNeradne] = useState(true);
  const [samoPrazne, setSamoPrazne] = useState(true);
  const [busy, setBusy] = useState(false);

  const datumi = od && do_ && od <= do_ ? datumiZaPopunu(dani, od, do_, { preskociNeradne, samoPrazne, vrsta }) : [];

  async function submit() {
    if (!datumi.length) return;
    setBusy(true);
    await onSubmit(vrsta, datumi);
    setBusy(false);
  }

  const dateCls = "border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100";

  return (
    <section className="rounded-xl border border-dashed border-green-600/50 bg-white dark:bg-gray-900 p-4 space-y-3 print:hidden">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Popuni period</h2>
        <button type="button" onClick={onClose} className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">Zatvori</button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {VRSTE_PERIODA.map((v) => (
          <button key={v} type="button" onClick={() => setVrsta(v)}
            className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors ${
              vrsta === v ? VRSTA[v].btnActive : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
            }`}>
            {VRSTA[v].label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-500 dark:text-gray-400">
          <span className="block mb-0.5">Od</span>
          <input id="popuni-od" type="date" className={dateCls} value={od} min={prvi} max={zadnji} onChange={(e) => setOd(e.target.value)} />
        </label>
        <label className="text-xs text-gray-500 dark:text-gray-400">
          <span className="block mb-0.5">Do</span>
          <input id="popuni-do" type="date" className={dateCls} value={do_} min={prvi} max={zadnji} onChange={(e) => setDo(e.target.value)} />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 py-1.5">
          <input id="popuni-vikend" type="checkbox" checked={preskociNeradne} onChange={(e) => setPreskociNeradne(e.target.checked)} className="accent-green-700" />
          Preskoči vikende i praznike
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 py-1.5">
          <input id="popuni-prazne" type="checkbox" checked={samoPrazne} onChange={(e) => setSamoPrazne(e.target.checked)} className="accent-green-700" />
          Samo neupisani dani
        </label>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={submit} disabled={busy || datumi.length === 0}
          className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-40 transition-colors">
          {busy ? "Upisujem…" : `Upiši ${VRSTA[vrsta].label.toLowerCase()} — ${datumi.length} ${datumi.length === 1 ? "dan" : "dana"}`}
        </button>
        {datumi.length > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
            {datumi.map((d) => Number(d.slice(8))).join(", ")}.
          </span>
        )}
        {od > do_ && <span className="text-xs text-red-600 dark:text-red-400">Datum „od“ je poslije datuma „do“.</span>}
      </div>
    </section>
  );
}
