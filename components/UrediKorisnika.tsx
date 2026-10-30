"use client";
import { useEffect, useRef, useState } from "react";
import { getKorisnikByIme, updateKorisnik } from "@/lib/db";
import { generatePin } from "@/lib/auth";
import type { Korisnik } from "@/lib/types";

const polje = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100";

/** Admin mijenja korisničko ime i/ili postavlja novi PIN; prazan PIN znači "ne mijenjaj" */
export function UrediKorisnika({ korisnik, onZatvori, onSnimljeno }: {
  korisnik: Korisnik;
  onZatvori: () => void;
  /** Poruka za prikaz nakon snimanja i (novo) korisničko ime */
  onSnimljeno: (poruka: string, novoIme: string) => void;
}) {
  const [ime, setIme] = useState(korisnik.ime);
  const [pin, setPin] = useState("");
  const [greska, setGreska] = useState("");
  const [snima, setSnima] = useState(false);
  const imeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    imeRef.current?.focus();
    imeRef.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onZatvori(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onZatvori]);

  const novoIme = ime.trim().toUpperCase();
  const imePromijenjeno = novoIme !== korisnik.ime;
  const pinPromijenjen = pin !== "";
  const nistaNovo = !imePromijenjeno && !pinPromijenjen;

  async function snimi() {
    if (!novoIme) { setGreska("Korisničko ime ne smije biti prazno."); return; }
    if (pinPromijenjen && !/^\d{4}$/.test(pin)) { setGreska("PIN mora imati tačno 4 cifre."); return; }
    setSnima(true);
    setGreska("");
    try {
      if (imePromijenjeno) {
        // prijava traži jedinstveno ime u cijeloj aplikaciji, pa se provjerava i arhiva
        const zauzeto = await getKorisnikByIme(novoIme);
        if (zauzeto && zauzeto.id !== korisnik.id) { setGreska("Korisničko ime je već zauzeto (možda u arhivi)."); setSnima(false); return; }
      }
      await updateKorisnik(korisnik.id, { ...(imePromijenjeno && { ime: novoIme }), ...(pinPromijenjen && { pin }) });
      const sta = [imePromijenjeno && "korisničko ime", pinPromijenjen && "PIN"].filter(Boolean).join(" i ");
      onSnimljeno(`Promijenjeno: ${sta} (${novoIme}) ✓`, novoIme);
      onZatvori();
    } catch {
      setGreska("Greška pri snimanju. Provjeri internet i pokušaj ponovo.");
      setSnima(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/45" onClick={onZatvori}>
      <div role="dialog" aria-modal="true" aria-labelledby="uredi-naslov"
        className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <h2 id="uredi-naslov" className="text-lg font-bold text-gray-800 dark:text-gray-100">Uredi korisnika</h2>
        <p className="mt-0.5 mb-4 text-sm text-gray-500 dark:text-gray-400">{korisnik.fullName || korisnik.ime}</p>

        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); snimi(); }}>
          <div>
            <label htmlFor="uredi-ime" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Korisničko ime</label>
            <input id="uredi-ime" ref={imeRef} className={`${polje} font-mono uppercase`} value={ime} maxLength={30} autoComplete="off"
              onChange={(e) => { setIme(e.target.value); setGreska(""); }} />
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">Unosi i izvještaji ostaju vezani za korisnika; mijenja se samo ime za prijavu.</p>
          </div>

          <div>
            <label htmlFor="uredi-pin" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Novi PIN (4 cifre)</label>
            <div className="flex gap-2">
              {/* tekstualno polje (ne type=password): preglednik ne nudi spremanje lozinke, a admin vidi šta javlja korisniku */}
              <input id="uredi-pin" className={`${polje} font-mono tracking-[0.3em]`} value={pin} inputMode="numeric" maxLength={4} autoComplete="off"
                data-lpignore="true" data-1p-ignore="true" placeholder="ostavi prazno = bez promjene"
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setGreska(""); }} />
              <button type="button" onClick={() => { setPin(generatePin()); setGreska(""); }}
                className="whitespace-nowrap rounded-lg border border-gray-300 dark:border-gray-600 px-3 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
                Nasumični
              </button>
            </div>
            {pinPromijenjen && <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">Zapiši i javi korisniku novi PIN: <span className="font-mono font-bold">{pin}</span></p>}
          </div>

          {greska && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{greska}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onZatvori}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">Odustani</button>
            <button type="submit" disabled={snima || nistaNovo}
              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50">
              {snima ? "Snimam…" : "Sačuvaj"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
