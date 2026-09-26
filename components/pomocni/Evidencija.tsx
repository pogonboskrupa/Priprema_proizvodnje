"use client";
import { useMemo, useState } from "react";
import { createPomocniRadnik, updatePomocniRadnik } from "@/lib/db";
import type { Korisnik, PomocniRadnik } from "@/lib/types";
import { POMOCNI, rezimeSihte, inicijali, punoIme, type DaniSihte, type DanMjeseca } from "@/lib/pomocni";
import { Icon } from "@/components/Icon";
import { ConfirmModal } from "@/components/ConfirmModal";

interface Props {
  radnici: PomocniRadnik[];
  projektanti: Korisnik[];
  sihte: Record<string, DaniSihte>;
  kalendar: DanMjeseca[];
  danas: string;
  onRefresh: () => Promise<void>;
  onOtvori: (radnikId: string) => void;
  toast: (msg: string, error?: boolean) => void;
}

const input = "border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-600";
const btnGhost = "px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors";

function imeProjektanta(k: Korisnik) { return k.fullName || k.ime; }

export function Evidencija({ radnici, projektanti, sihte, kalendar, danas, onRefresh, onOtvori, toast }: Props) {
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [novi, setNovi] = useState({ ime: "", prezime: "", projektantId: "" });
  const [edit, setEdit] = useState<{ id: string; ime: string; prezime: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showArhiv, setShowArhiv] = useState(false);
  const [confirm, setConfirm] = useState<PomocniRadnik | null>(null);

  const projMap = useMemo(() => new Map(projektanti.map((k) => [k.id, imeProjektanta(k)])), [projektanti]);

  const aktivni = radnici.filter((r) => r.aktivan);
  const arhivirani = radnici.filter((r) => !r.aktivan);
  const filtrirani = aktivni.filter((r) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return punoIme(r).toLowerCase().includes(t) || (projMap.get(r.projektantId ?? "") ?? "").toLowerCase().includes(t);
  });

  // Grupisano po projektantu; bez projektanta na kraju
  const grupe = (() => {
    const m = new Map<string, PomocniRadnik[]>();
    for (const r of filtrirani) {
      const key = r.projektantId && projMap.has(r.projektantId) ? r.projektantId : "";
      m.set(key, [...(m.get(key) ?? []), r]);
    }
    return [...m.entries()]
      .map(([id, rs]) => ({ id, naziv: id ? projMap.get(id)! : "Bez projektanta", radnici: rs }))
      .sort((a, b) => (a.id ? 0 : 1) - (b.id ? 0 : 1) || a.naziv.localeCompare(b.naziv));
  })();

  // greška osvježavanja nije greška upisa — inače bi ponovni pokušaj dodao radnika dvaput
  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
    } catch {
      toast("Promjena nije sačuvana. Provjeri internet i pokušaj ponovo.", true);
      setBusy(false);
      return;
    }
    try {
      await onRefresh();
      toast(ok);
    } catch {
      toast(`${ok}. Lista nije osvježena — osvježi stranicu.`, true);
    } finally {
      setBusy(false);
    }
  }

  const dodaj = () => {
    const ime = novi.ime.trim(), prezime = novi.prezime.trim();
    if (!ime || !prezime) return;
    run(async () => {
      await createPomocniRadnik({ ime, prezime, projektantId: novi.projektantId || null });
      setNovi({ ime: "", prezime: "", projektantId: novi.projektantId });
    }, `Dodan: ${prezime} ${ime}`);
  };

  const sacuvajIme = () => {
    if (!edit) return;
    const ime = edit.ime.trim(), prezime = edit.prezime.trim();
    if (!ime || !prezime) return;
    run(async () => { await updatePomocniRadnik(edit.id, { ime, prezime }); setEdit(null); }, "Ime sačuvano");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[12rem] max-w-sm">
          <span className="sr-only">Pretraga</span>
          <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input id="pomocni-pretraga" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Traži radnika ili projektanta"
            className={`${input} w-full pl-9`} />
        </label>
        <button type="button" onClick={() => setShowAdd((v) => !v)} aria-expanded={showAdd}
          className={`ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            showAdd ? "border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            : "bg-green-700 text-white hover:bg-green-800"
          }`}>
          {showAdd ? "Zatvori" : <><Icon name="plus" className="w-4 h-4" strokeWidth={2.2} /> Novi radnik</>}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={(e) => { e.preventDefault(); dodaj(); }}
          className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50/60 dark:bg-green-950/20 p-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <label className="grid gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
            Prezime
            <input id="novi-prezime" autoFocus value={novi.prezime} onChange={(e) => setNovi({ ...novi, prezime: e.target.value })} className={input} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
            Ime
            <input id="novi-ime" value={novi.ime} onChange={(e) => setNovi({ ...novi, ime: e.target.value })} className={input} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
            Radi s projektantom
            <select id="novi-projektant" value={novi.projektantId} onChange={(e) => setNovi({ ...novi, projektantId: e.target.value })} className={input}>
              <option value="">— bez projektanta —</option>
              {projektanti.map((k) => <option key={k.id} value={k.id}>{imeProjektanta(k)}</option>)}
            </select>
          </label>
          <button type="submit" disabled={busy || !novi.ime.trim() || !novi.prezime.trim()}
            className="px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-medium hover:bg-green-800 disabled:opacity-40 transition-colors">
            {busy ? "Čuvam…" : "Dodaj"}
          </button>
        </form>
      )}

      {aktivni.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 py-14 text-center">
          <Icon name="hardhat" className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-300">Još nema pomoćnih radnika</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Dodaj prvog radnika dugmetom „Novi radnik“.</p>
        </div>
      ) : filtrirani.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">Nema rezultata za „{q}“.</p>
      ) : (
        <div className="space-y-4">
          {grupe.map((g) => (
            <section key={g.id || "bez"} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
              <header className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className={`text-xs font-semibold uppercase tracking-wide ${g.id ? "text-gray-600 dark:text-gray-300" : "text-gray-400 dark:text-gray-500"}`}>{g.naziv}</h3>
                <span className="text-xs text-gray-400 tabular-nums">{g.radnici.length}</span>
              </header>
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {g.radnici.map((r) => {
                  const rez = rezimeSihte(sihte[r.id] ?? {}, kalendar, danas);
                  const odsustva = rez.po.GODISNJI + rez.po.BOLOVANJE;
                  const editing = edit?.id === r.id;
                  return (
                    <li key={r.id} className="px-4 py-3 flex items-start sm:items-center gap-3">
                      <span className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {inicijali(r.ime, r.prezime)}
                      </span>
                      <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-2">

                      {editing ? (
                        <form onSubmit={(e) => { e.preventDefault(); sacuvajIme(); }} className="flex flex-wrap items-center gap-2 flex-1 min-w-[14rem]">
                          <input id={`edit-prezime-${r.id}`} autoFocus aria-label="Prezime" value={edit.prezime} onChange={(e) => setEdit({ ...edit, prezime: e.target.value })} className={`${input} w-32 py-1.5`} />
                          <input id={`edit-ime-${r.id}`} aria-label="Ime" value={edit.ime} onChange={(e) => setEdit({ ...edit, ime: e.target.value })} className={`${input} w-28 py-1.5`} />
                          <button type="submit" disabled={busy} className="px-3 py-1.5 rounded-lg bg-green-700 text-white text-xs font-medium hover:bg-green-800 disabled:opacity-40">Sačuvaj</button>
                          <button type="button" onClick={() => setEdit(null)} className={btnGhost}>Otkaži</button>
                        </form>
                      ) : (
                        <div className="flex-1 min-w-[10rem]">
                          <button type="button" onClick={() => onOtvori(r.id)} className="text-sm font-semibold text-gray-800 dark:text-gray-100 hover:underline text-left">
                            {punoIme(r)}
                          </button>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums">
                            <span className={`px-1.5 py-0.5 rounded ${POMOCNI.TEREN.badge}`}>Teren {rez.po.TEREN}</span>
                            {rez.po.KANCELARIJA > 0 && <span className={`px-1.5 py-0.5 rounded ${POMOCNI.KANCELARIJA.badge}`}>Kanc. {rez.po.KANCELARIJA}</span>}
                            {odsustva > 0 && <span className={`px-1.5 py-0.5 rounded ${POMOCNI.GODISNJI.badge}`}>Odsustvo {odsustva}</span>}
                            {rez.nepopunjeno > 0 && <span className="px-1.5 py-0.5 rounded text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40">{rez.nepopunjeno} praznih</span>}
                          </div>
                        </div>
                      )}

                      <select id={`projektant-${r.id}`} aria-label={`Projektant za ${punoIme(r)}`} value={r.projektantId ?? ""} disabled={busy}
                        onChange={(e) => run(() => updatePomocniRadnik(r.id, { projektantId: e.target.value || null }), "Projektant promijenjen")}
                        className={`${input} py-1.5 text-xs max-w-[12rem]`}>
                        <option value="">— bez projektanta —</option>
                        {projektanti.map((k) => <option key={k.id} value={k.id}>{imeProjektanta(k)}</option>)}
                      </select>

                      <div className="flex items-center gap-0.5 -ml-2.5 sm:ml-0">
                        <button type="button" className={btnGhost} onClick={() => onOtvori(r.id)}>Šihtarica</button>
                        {!editing && <button type="button" className={btnGhost} onClick={() => setEdit({ id: r.id, ime: r.ime, prezime: r.prezime })}>Uredi</button>}
                        <button type="button" onClick={() => setConfirm(r)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
                          Arhiviraj
                        </button>
                      </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {arhivirani.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowArhiv((v) => !v)} aria-expanded={showArhiv}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
            {showArhiv ? "▾" : "▸"} Arhiva ({arhivirani.length})
          </button>
          {showArhiv && (
            <ul className="mt-2 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
              {arhivirani.map((r) => (
                <li key={r.id} className="px-4 py-2.5 flex items-center gap-3 bg-gray-50/60 dark:bg-gray-900/60">
                  <span className="text-sm text-gray-500 dark:text-gray-400 flex-1">{punoIme(r)}</span>
                  <button type="button" disabled={busy} className={btnGhost}
                    onClick={() => run(() => updatePomocniRadnik(r.id, { aktivan: true }), `Vraćen: ${punoIme(r)}`)}>
                    Vrati
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {confirm && (
        <ConfirmModal
          msg={`Arhivirati radnika „${punoIme(confirm)}“? Šihte ostaju sačuvane, a radnik se može vratiti iz arhive.`}
          okLabel="Arhiviraj"
          okColor="amber"
          onOk={() => { const r = confirm; setConfirm(null); run(() => updatePomocniRadnik(r.id, { aktivan: false }), `Arhiviran: ${punoIme(r)}`); }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
