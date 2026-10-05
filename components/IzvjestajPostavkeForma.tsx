"use client";
import { useEffect, useMemo, useState } from "react";
import { getKorisnici, setIzvjestajPostavke } from "@/lib/db";
import type { Korisnik } from "@/lib/types";
import { useIzvjestajPostavke } from "@/hooks/useIzvjestajPostavke";
import { poredaj, ZADANE_POSTAVKE, type IzvjestajPostavke, type ProjektantUIzvjestaju } from "@/lib/izvjestaj-postavke";

const inputCls = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1";
const btnStrelica = "w-8 h-8 flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent";

/** Postavke samo za sedmični i mjesečni izvještaj u Šihtarici */
export function IzvjestajPostavkeForma() {
  const { postavke, ucitano } = useIzvjestajPostavke();
  if (!ucitano) return <div className="py-10 text-center text-sm text-gray-400">Učitavam postavke…</div>;
  return <Forma pocetne={postavke} />;
}

function Forma({ pocetne }: { pocetne: IzvjestajPostavke }) {
  const [korisnici, setKorisnici] = useState<Korisnik[]>([]);
  const [draft, setDraft] = useState<IzvjestajPostavke>(pocetne);
  const [firmaTekst, setFirmaTekst] = useState(pocetne.firma.join("\n"));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    getKorisnici()
      .then((ks) => setKorisnici(ks.filter((k) => k.role === "worker" && !k.arhiviran)))
      .catch(() => setMsg({ text: "Greška pri učitavanju projektanata.", error: true }));
  }, []);

  const poredani = useMemo(() => poredaj(korisnici, draft.redoslijed), [korisnici, draft.redoslijed]);

  function pomjeri(i: number, smjer: -1 | 1) {
    const ids = poredani.map((k) => k.id);
    [ids[i], ids[i + smjer]] = [ids[i + smjer], ids[i]];
    setDraft((d) => ({ ...d, redoslijed: ids }));
  }

  function postaviProjektanta(id: string, patch: ProjektantUIzvjestaju) {
    setDraft((d) => ({ ...d, projektanti: { ...d.projektanti, [id]: { ...d.projektanti[id], ...patch } } }));
  }

  async function sacuvaj() {
    setSaving(true);
    setMsg(null);
    const projektanti = Object.fromEntries(
      Object.entries(draft.projektanti)
        .map(([id, p]) => [id, { ime: p.ime?.trim() ?? "", zvanje: p.zvanje?.trim() ?? "" }] as const)
        .filter(([, p]) => p.ime || p.zvanje),
    );
    try {
      await setIzvjestajPostavke({
        ...draft,
        firma: firmaTekst.split("\n").map((l) => l.trim()).filter(Boolean),
        primalac: draft.primalac.trim(),
        sekcija: draft.sekcija.trim(),
        potpis: draft.potpis.trim(),
        redoslijed: poredani.map((k) => k.id),
        projektanti,
      });
      setMsg({ text: "Sačuvano ✓ — izvještaji se odmah ažuriraju." });
    } catch {
      setMsg({ text: "Greška pri snimanju. Provjeri internet i pokušaj ponovo.", error: true });
    } finally {
      setSaving(false);
    }
  }

  const zaglavljePromijenjeno =
    firmaTekst !== ZADANE_POSTAVKE.firma.join("\n") || draft.primalac !== ZADANE_POSTAVKE.primalac ||
    draft.sekcija !== ZADANE_POSTAVKE.sekcija || draft.potpis !== ZADANE_POSTAVKE.potpis;

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Važi samo za <b className="font-semibold text-gray-700 dark:text-gray-200">Sedmični</b> i <b className="font-semibold text-gray-700 dark:text-gray-200">Mjesečni izvještaj</b> u Šihtarici.
        Profili korisnika se ne mijenjaju.
      </p>

      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200">Zaglavlje i potpis</h2>
          {zaglavljePromijenjeno && (
            <button type="button" className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:underline"
              onClick={() => {
                setFirmaTekst(ZADANE_POSTAVKE.firma.join("\n"));
                setDraft((d) => ({ ...d, primalac: ZADANE_POSTAVKE.primalac, sekcija: ZADANE_POSTAVKE.sekcija, potpis: ZADANE_POSTAVKE.potpis }));
              }}>
              Vrati zadani tekst
            </button>
          )}
        </div>
        <div>
          <label className={labelCls} htmlFor="izv-firma">Firma — svaki red posebno (gore lijevo)</label>
          <textarea id="izv-firma" rows={4} className={inputCls} value={firmaTekst} onChange={(e) => setFirmaTekst(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={labelCls} htmlFor="izv-primalac">Primalac (desno)</label>
            <input id="izv-primalac" className={inputCls} value={draft.primalac} maxLength={120}
              onChange={(e) => setDraft({ ...draft, primalac: e.target.value })} />
          </div>
          <div>
            <label className={labelCls} htmlFor="izv-sekcija">Sekcija (mjesečni, iznad tabele)</label>
            <input id="izv-sekcija" className={inputCls} value={draft.sekcija} maxLength={120}
              onChange={(e) => setDraft({ ...draft, sekcija: e.target.value })} />
          </div>
          <div>
            <label className={labelCls} htmlFor="izv-potpis">Potpis (dole desno)</label>
            <input id="izv-potpis" className={inputCls} value={draft.potpis} maxLength={120}
              onChange={(e) => setDraft({ ...draft, potpis: e.target.value })} />
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200">Projektanti — redoslijed i ispis</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Strelicama mijenjaš redoslijed. Prazno polje = ime i titula iz profila.</p>
          <label htmlFor="izv-ime-bold" className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
            <input id="izv-ime-bold" type="checkbox" className="w-4 h-4 accent-green-700" checked={draft.imeBold}
              onChange={(e) => setDraft({ ...draft, imeBold: e.target.checked })} />
            Ime i prezime <b>podebljano</b>
          </label>
        </div>
        {poredani.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">Nema aktivnih projektanata.</div>
        ) : (
          <ol className="divide-y divide-gray-100 dark:divide-gray-800">
            {poredani.map((k, i) => {
              const p = draft.projektanti[k.id] ?? {};
              return (
                <li key={k.id} className="px-4 py-3 grid gap-2 sm:grid-cols-[2.5rem_auto_1fr_1fr] sm:items-center">
                  <span className="text-sm font-semibold tabular-nums text-gray-500 dark:text-gray-400">{i + 1}.</span>
                  <div className="flex gap-1">
                    <button type="button" className={btnStrelica} disabled={i === 0} onClick={() => pomjeri(i, -1)}
                      aria-label={`Pomjeri ${k.fullName || k.ime} gore`}>↑</button>
                    <button type="button" className={btnStrelica} disabled={i === poredani.length - 1} onClick={() => pomjeri(i, 1)}
                      aria-label={`Pomjeri ${k.fullName || k.ime} dole`}>↓</button>
                  </div>
                  <div>
                    <label className="sr-only" htmlFor={`izv-ime-${k.id}`}>Ime u izvještaju</label>
                    <input id={`izv-ime-${k.id}`} className={inputCls} value={p.ime ?? ""} maxLength={60}
                      placeholder={k.fullName || k.ime} onChange={(e) => postaviProjektanta(k.id, { ime: e.target.value })} />
                  </div>
                  <div>
                    <label className="sr-only" htmlFor={`izv-zvanje-${k.id}`}>Zvanje u izvještaju</label>
                    <input id={`izv-zvanje-${k.id}`} className={inputCls} value={p.zvanje ?? ""} maxLength={60}
                      placeholder={k.title || "zvanje"} onChange={(e) => postaviProjektanta(k.id, { zvanje: e.target.value })} />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={sacuvaj} disabled={saving}
          className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50">
          {saving ? "Snimam…" : "Sačuvaj"}
        </button>
        {msg && <span role="status" className={`text-sm ${msg.error ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
