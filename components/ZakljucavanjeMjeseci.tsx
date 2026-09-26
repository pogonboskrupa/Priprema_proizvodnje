"use client";
import { useMemo, useState } from "react";
import { setZakljucanoDo } from "@/lib/db";
import { mjeseciEvidencije } from "@/lib/godine";
import { zakljucanoLabel, type ZakljucanoDo } from "@/lib/zakljucavanje";
import { useZakljucavanje } from "@/hooks/useZakljucavanje";
import { Icon } from "@/components/Icon";

export function ZakljucavanjeMjeseci({ korisnikId }: { korisnikId: string }) {
  const { zakljucanoDo } = useZakljucavanje();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // tekući mjesec se ne zaključava — u njemu se još radi
  const mjeseci = useMemo(() => mjeseciEvidencije().slice(1).reverse(), []);
  const prosli = mjeseci[mjeseci.length - 1]?.value ?? null;

  async function postavi(z: ZakljucanoDo) {
    setBusy(true);
    setErr("");
    try {
      await setZakljucanoDo(z, korisnikId);
    } catch {
      setErr("Promjena nije sačuvana. Provjeri internet i pokušaj ponovo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-4 max-w-2xl">
      <div className="flex items-start gap-3">
        <span className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center ${
          zakljucanoDo ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "bg-gray-100 dark:bg-gray-800 text-gray-500"
        }`}>
          <Icon name={zakljucanoDo ? "lock" : "unlock"} className="w-5 h-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">
            {zakljucanoDo ? <>Zaključano do kraja: <span className="capitalize">{zakljucanoLabel(zakljucanoDo)}</span></> : "Ništa nije zaključano"}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            U zaključanim mjesecima projektanti i operateri ne mogu dodati, izmijeniti ni obrisati unose rada ni šihte pomoćnih radnika. Admin može.
          </p>
        </div>
      </div>

      {prosli && zakljucanoDo !== prosli && (
        <button type="button" disabled={busy} onClick={() => postavi(prosli)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:hover:bg-white text-white dark:text-slate-900 text-sm font-semibold disabled:opacity-50 transition-colors">
          <Icon name="lock" className="w-4 h-4" strokeWidth={2} />
          Zaključaj sve do kraja <span className="capitalize">{zakljucanoLabel(prosli)}</span>
        </button>
      )}

      {mjeseci.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Klikni mjesec da zaključaš njega i sve ranije:</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {mjeseci.map((m) => {
              const zakljucan = !!zakljucanoDo && m.value <= zakljucanoDo;
              const granica = m.value === zakljucanoDo;
              return (
                <button key={m.value} type="button" disabled={busy || granica} onClick={() => postavi(m.value)}
                  aria-pressed={zakljucan}
                  title={granica ? "Granica zaključavanja" : `Zaključaj do kraja: ${m.label}`}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium capitalize transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 disabled:cursor-default ${
                    zakljucan
                      ? `bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 ${granica ? "ring-2 ring-slate-500 dark:ring-slate-400" : ""}`
                      : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-slate-400"
                  }`}>
                  {zakljucan && <Icon name="lock" className="w-3 h-3" strokeWidth={2.2} />}
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {zakljucanoDo && (
        <button type="button" disabled={busy} onClick={() => postavi(null)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:underline disabled:opacity-50">
          <Icon name="unlock" className="w-4 h-4" strokeWidth={2} /> Otključaj sve
        </button>
      )}
      {err && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{err}</p>}
    </section>
  );
}
