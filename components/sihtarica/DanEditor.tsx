"use client";
import { useState } from "react";
import type { Odjel, UnosRada, VrstaRada } from "@/lib/types";
import { editFormToPayload, NO_ODJEL_VRSTE, type UnosEditForm as Form, type UnosEditPayload } from "@/lib/unos-edit";
import { splitOdjeliByRecent } from "@/lib/recent";
import { VRSTA, vrsta as vrstaStyle } from "@/lib/vrste";
import { zabranaUpisa, zabranaIzmjene, ucinakLabel, unioDrugi, DANI_KRATKO, type DanSihtarice } from "@/lib/sihtarica";
import { fmtDateLong } from "@/lib/format";
import { UnosEditForm, inputSmCls, labelSmCls } from "@/components/UnosEditForm";

const UCINAK: readonly VrstaRada[] = ["DOZNAKA", "VLAKA"];

function fmtVrijeme(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}. ${p(d.getHours())}:${p(d.getMinutes())}`;
}
const BRZI: readonly VrstaRada[] = ["TEREN", "KANCELARIJA", "GODISNJI", "BOLOVANJE"];

const prazanForm = (vrsta: VrstaRada = "DOZNAKA", odjelId = ""): Form => ({
  vrsta, odjelId, brojStabala: "", hektari: "", kilometri: "", napomena: "",
});

const formIzUnosa = (u: UnosRada): Form => ({
  vrsta: u.vrsta,
  odjelId: u.odjelId ?? "",
  brojStabala: u.brojStabala?.toString() ?? "",
  hektari: u.hektari?.toString().replace(".", ",") ?? "",
  kilometri: u.kilometri?.toString().replace(".", ",") ?? "",
  napomena: u.napomena ?? "",
});

export function DanEditor({
  dan, prethodni, odjeli, recentIds, onCreate, onUpdate, onDelete,
}: {
  dan: DanSihtarice;
  prethodni: DanSihtarice | null;
  odjeli: Odjel[];
  recentIds: readonly string[];
  onCreate: (data: UnosEditPayload) => Promise<boolean>;
  onUpdate: (id: string, data: UnosEditPayload) => Promise<boolean>;
  onDelete: (u: UnosRada) => void;
}) {
  const zadnjiOdjel = dan.unosi.find((u) => u.odjelId)?.odjelId ?? recentIds[0] ?? "";
  const [form, setForm] = useState<Form>(() => prazanForm("DOZNAKA", zadnjiOdjel));
  const [edit, setEdit] = useState<{ id: string; form: Form } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const { recent, rest } = splitOdjeliByRecent(odjeli, recentIds);
  const upisaneVrste = new Set(dan.unosi.map((u) => u.vrsta));

  async function run(action: () => Promise<boolean>): Promise<boolean> {
    setBusy(true);
    setError("");
    const ok = await action();
    setBusy(false);
    return ok;
  }

  const zabrana = (v: VrstaRada) => zabranaUpisa(dan.datum, dan.unosi, v);

  async function brziUpis(v: VrstaRada) {
    const z = zabrana(v);
    if (z) { setError(z); return; }
    const ok = await run(() => onCreate({
      vrsta: v, odjelId: null, brojStabala: null, hektari: null, kilometri: null,
      napomena: form.napomena.trim() || null,
    }));
    if (ok) setForm((f) => ({ ...f, napomena: "" }));
  }

  async function sacuvajUcinak() {
    const z = zabrana(form.vrsta);
    if (z) { setError(z); return; }
    const r = editFormToPayload(form);
    if (!r.ok) { setError(r.error); return; }
    if (await run(() => onCreate(r.data))) setForm(prazanForm(form.vrsta, form.odjelId));
  }

  // Prisustvo se prepisuje odmah; doznaka/vlaka samo popuni vrstu i odjel (učinak je svaki dan drugačiji)
  const zaKopiju = prethodni?.unosi ?? [];
  const kopijaBrzi = [...new Set(zaKopiju.filter((u) => NO_ODJEL_VRSTE.has(u.vrsta)).map((u) => u.vrsta))]
    .filter((v) => !zabrana(v));
  const kopijaUcinak = zaKopiju.find((u) => !NO_ODJEL_VRSTE.has(u.vrsta) && u.odjelId);

  async function kaoPrethodni() {
    if (kopijaUcinak) setForm(prazanForm(kopijaUcinak.vrsta, kopijaUcinak.odjelId));
    for (const v of kopijaBrzi) {
      const ok = await run(() => onCreate({
        vrsta: v, odjelId: null, brojStabala: null, hektari: null, kilometri: null, napomena: null,
      }));
      if (!ok) return;
    }
  }

  async function sacuvajIzmjenu() {
    if (!edit) return;
    const r = editFormToPayload(edit.form);
    if (!r.ok) { setError(r.error); return; }
    const original = dan.unosi.find((u) => u.id === edit.id);
    const z = original && zabranaIzmjene(original, r.data.vrsta, dan.unosi);
    if (z) { setError(z); return; }
    if (await run(() => onUpdate(edit.id, r.data))) setEdit(null);
  }

  return (
    <div className="px-3 sm:pl-[4.75rem] pb-4 pt-1 space-y-4 bg-green-50/40 dark:bg-green-950/10 print:hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 first-letter:uppercase">{fmtDateLong(dan.datum)}</span>
        {dan.praznik && <span className="text-xs text-rose-700 dark:text-rose-300">Praznik — {dan.praznik}</span>}
        {dan.weekday === 6 && !dan.praznik && <span className="text-xs text-amber-700 dark:text-amber-400">Subota — upiši samo ako je bila radna subota.</span>}
        {!dan.zakljucan && !edit && dan.unosi.length === 0 && prethodni && (kopijaBrzi.length > 0 || kopijaUcinak) && (
          <button type="button" disabled={busy} onClick={kaoPrethodni}
            className="ml-auto text-xs font-medium text-green-700 dark:text-green-400 hover:underline disabled:opacity-50">
            ↺ Kao {DANI_KRATKO[prethodni.weekday].toLowerCase()} {prethodni.dan}.
            {" "}({prethodni.unosi.map((u) => VRSTA[u.vrsta]?.short ?? u.vrsta).join(", ")})
          </button>
        )}
      </div>

      {dan.unosi.length > 0 && (
        <ul className="space-y-1.5">
          {dan.unosi.map((u) => {
            const vs = vrstaStyle(u.vrsta);
            if (edit?.id === u.id) {
              return (
                <li key={u.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
                  <UnosEditForm
                    form={edit.form}
                    onChange={(patch) => setEdit({ id: u.id, form: { ...edit.form, ...patch } })}
                    odjeli={odjeli}
                    saving={busy}
                    error={error}
                    onSubmit={sacuvajIzmjenu}
                    onCancel={() => { setEdit(null); setError(""); }}
                  />
                </li>
              );
            }
            return (
              <li key={u.id} className={`flex items-center gap-2 rounded-lg border-l-4 ${vs.borderL} bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm`}>
                <span className={`font-semibold ${vs.text}`}>{vs.label}</span>
                {u.odjel && <span className="font-mono text-gray-600 dark:text-gray-300">{u.odjel.gj} / {u.odjel.broj}</span>}
                <span className="tabular-nums text-gray-500 dark:text-gray-400">{ucinakLabel(u)}</span>
                <span className="flex-1 min-w-0 truncate italic text-xs text-gray-400">{u.napomena}</span>
                {unioDrugi(u) && (
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    unio {unioDrugi(u)!.puno}{u.createdAt ? ` · ${fmtVrijeme(u.createdAt)}` : ""}
                  </span>
                )}
                <button type="button" onClick={() => { setEdit({ id: u.id, form: formIzUnosa(u) }); setError(""); }}
                  className="text-xs font-medium text-green-700 dark:text-green-400 hover:underline">Uredi</button>
                <button type="button" onClick={() => onDelete(u)}
                  className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline">Obriši</button>
              </li>
            );
          })}
        </ul>
      )}

      {dan.zakljucan && !edit && (
        <p className="text-xs text-gray-500 dark:text-gray-400">Nedjelja je neradni dan — postojeći unos možeš samo ispraviti ili obrisati.</p>
      )}

      {!edit && !dan.zakljucan && (
        <div className="grid gap-4 md:grid-cols-[auto_1fr]">
          <div>
            <div className={labelSmCls}>Prisustvo — jedan klik upisuje dan</div>
            <div className="flex flex-wrap gap-1.5">
              {BRZI.map((v) => (
                <button key={v} type="button" disabled={busy || upisaneVrste.has(v)} onClick={() => brziUpis(v)}
                  title={zabrana(v) ?? undefined}
                  className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${VRSTA[v].badge} border-transparent hover:brightness-95`}>
                  + {VRSTA[v].label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); sacuvajUcinak(); }} className="space-y-2">
            <div className="flex items-center gap-1.5">
              <span className={`${labelSmCls} mb-0 mr-1`}>Učinak</span>
              {UCINAK.map((v) => (
                <button key={v} type="button"
                  onClick={() => setForm({ ...form, vrsta: v, brojStabala: "", hektari: "", kilometri: "" })}
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                    form.vrsta === v ? VRSTA[v].btnActive : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900"
                  }`}>
                  {VRSTA[v].label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              {!NO_ODJEL_VRSTE.has(form.vrsta) && (
                <div className="w-44">
                  <label className={labelSmCls} htmlFor={`odjel-${dan.datum}`}>Odjel</label>
                  <select id={`odjel-${dan.datum}`} className={inputSmCls} value={form.odjelId}
                    onChange={(e) => setForm({ ...form, odjelId: e.target.value })}>
                    <option value="">Odjel...</option>
                    {recent.length > 0 && (
                      <optgroup label="Nedavno rađeni">
                        {recent.map((o) => <option key={o.id} value={o.id}>{o.gj} / {o.broj}</option>)}
                      </optgroup>
                    )}
                    <optgroup label={recent.length > 0 ? "Ostali odjeli" : "Odjeli"}>
                      {rest.map((o) => <option key={o.id} value={o.id}>{o.gj} / {o.broj}</option>)}
                    </optgroup>
                  </select>
                </div>
              )}
              {form.vrsta === "DOZNAKA" && (
                <>
                  <div className="w-20">
                    <label className={labelSmCls} htmlFor={`st-${dan.datum}`}>Stabala</label>
                    <input id={`st-${dan.datum}`} type="text" inputMode="numeric" className={inputSmCls}
                      value={form.brojStabala} onChange={(e) => setForm({ ...form, brojStabala: e.target.value })} />
                  </div>
                  <div className="w-20">
                    <label className={labelSmCls} htmlFor={`ha-${dan.datum}`}>ha</label>
                    <input id={`ha-${dan.datum}`} type="text" inputMode="decimal" className={inputSmCls}
                      value={form.hektari} onChange={(e) => setForm({ ...form, hektari: e.target.value })} />
                  </div>
                </>
              )}
              {form.vrsta === "VLAKA" && (
                <div className="w-20">
                  <label className={labelSmCls} htmlFor={`km-${dan.datum}`}>km</label>
                  <input id={`km-${dan.datum}`} type="text" inputMode="decimal" className={inputSmCls}
                    value={form.kilometri} onChange={(e) => setForm({ ...form, kilometri: e.target.value })} />
                </div>
              )}
              <div className="flex-1 min-w-[8rem]">
                <label className={labelSmCls} htmlFor={`nap-${dan.datum}`}>Napomena</label>
                <input id={`nap-${dan.datum}`} type="text" maxLength={200} className={inputSmCls}
                  value={form.napomena} onChange={(e) => setForm({ ...form, napomena: e.target.value })} />
              </div>
              <button type="submit" disabled={busy}
                className="bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50 transition-colors">
                {busy ? "Snimam…" : "Sačuvaj"}
              </button>
            </div>
          </form>
        </div>
      )}

      {error && !edit && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
