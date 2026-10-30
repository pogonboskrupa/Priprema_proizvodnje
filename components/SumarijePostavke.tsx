"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createKorisnik, createSumarija, getKorisnikByIme, getKorisnici, getSumarije, updateKorisnik, updateSumarija } from "@/lib/db";
import { generatePin } from "@/lib/auth";
import { DEFAULT_SUMARIJA_ID, jeSuperAdmin, sumarijaOd, type Sumarija } from "@/lib/sumarija";
import type { Korisnik } from "@/lib/types";

const polje = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100";
const dugme = "bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-800 disabled:opacity-50";

/** Samo super admin: šumarije i admin svake šumarije */
export function SumarijePostavke({ onPin, toast }: {
  onPin: (n: { ime: string; pin: string; novi: boolean }) => void;
  toast: (m: string) => void;
}) {
  const [sumarije, setSumarije] = useState<Sumarija[]>([]);
  const [korisnici, setKorisnici] = useState<Korisnik[]>([]);
  const [novaSumarija, setNovaSumarija] = useState("");
  const [zauzeto, setZauzeto] = useState(false);
  // toast roditelja se mijenja pri svakom renderu; ref sprječava beskonačno ponovno učitavanje
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; });

  const ucitaj = useCallback(async () => {
    try {
      const [s, k] = await Promise.all([getSumarije({ ukljuciArhivirane: true }), getKorisnici({ ukljuciArhivirane: true })]);
      setSumarije(s);
      setKorisnici(k);
    } catch {
      toastRef.current("Greška pri učitavanju šumarija. Provjeri internet.");
    }
  }, []);

  useEffect(() => {
    let otkazano = false;
    Promise.all([getSumarije({ ukljuciArhivirane: true }), getKorisnici({ ukljuciArhivirane: true })])
      .then(([s, k]) => { if (!otkazano) { setSumarije(s); setKorisnici(k); } })
      .catch(() => { if (!otkazano) toastRef.current("Greška pri učitavanju šumarija. Provjeri internet."); });
    return () => { otkazano = true; };
  }, []);

  async function radi(akcija: () => Promise<void>) {
    setZauzeto(true);
    try { await akcija(); await ucitaj(); } catch { toast("Greška pri snimanju. Provjeri internet i pokušaj ponovo."); }
    setZauzeto(false);
  }

  const dodajSumariju = () => radi(async () => {
    const naziv = novaSumarija.trim();
    if (!naziv) { toast("Upiši naziv šumarije!"); return; }
    if (sumarije.some((s) => s.naziv.toLowerCase() === naziv.toLowerCase())) { toast("Šumarija s tim nazivom već postoji."); return; }
    await createSumarija(naziv);
    setNovaSumarija("");
  });

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-3">
        <h2 className="font-semibold text-gray-700 dark:text-gray-200">Nova šumarija</h2>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); dodajSumariju(); }}>
          <label htmlFor="nova-sumarija" className="sr-only">Naziv šumarije</label>
          <input id="nova-sumarija" className={polje} value={novaSumarija} onChange={(e) => setNovaSumarija(e.target.value)} maxLength={60} placeholder="Naziv šumarije" />
          <button type="submit" disabled={zauzeto} className={`${dugme} whitespace-nowrap`}>Dodaj</button>
        </form>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Nova šumarija počinje prazna: korisnike, odjele i admina dodaješ nakon što je izabereš u zaglavlju.
        </p>
      </div>

      {sumarije.map((s) => (
        <SumarijaKartica key={s.id} sumarija={s} korisnici={korisnici.filter((k) => sumarijaOd(k) === s.id)} zauzeto={zauzeto}
          radi={radi} onPin={onPin} toast={toast} />
      ))}
    </div>
  );
}

function SumarijaKartica({ sumarija, korisnici, zauzeto, radi, onPin, toast }: {
  sumarija: Sumarija;
  korisnici: Korisnik[];
  zauzeto: boolean;
  radi: (a: () => Promise<void>) => Promise<void>;
  onPin: (n: { ime: string; pin: string; novi: boolean }) => void;
  toast: (m: string) => void;
}) {
  const [naziv, setNaziv] = useState(sumarija.naziv);
  const [novi, setNovi] = useState({ ime: "", fullName: "" });
  const [postojeci, setPostojeci] = useState("");
  const jeZadana = sumarija.id === DEFAULT_SUMARIJA_ID;
  // super admini (admin bez šumarije) ne pripadaju nijednoj šumariji
  const clanovi = korisnici.filter((k) => !jeSuperAdmin(k) && !k.arhiviran);
  const admini = clanovi.filter((k) => k.role === "admin");
  const kandidati = clanovi.filter((k) => k.role === "worker");

  const dodajAdmina = () => radi(async () => {
    const ime = novi.ime.trim().toUpperCase();
    if (!ime) { toast("Upiši korisničko ime admina!"); return; }
    // prijava traži jedinstveno ime u cijeloj aplikaciji, ne samo u ovoj šumariji
    if (await getKorisnikByIme(ime)) { toast("Korisnik s tim imenom već postoji (možda u arhivi)!"); return; }
    const pin = generatePin();
    await createKorisnik({
      ime, fullName: novi.fullName || novi.ime, title: "", pin, role: "admin",
      sumarijaId: sumarija.id, avatar: "", odjeliIds: [],
    });
    setNovi({ ime: "", fullName: "" });
    onPin({ ime, pin, novi: true });
  });

  const postaviPostojeceg = () => radi(async () => {
    if (!postojeci) return;
    await updateKorisnik(postojeci, { role: "admin", sumarijaId: sumarija.id });
    setPostojeci("");
  });

  return (
    <section className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-4 ${sumarija.arhivirana ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[12rem]">
          <label htmlFor={`naziv-${sumarija.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
            Naziv šumarije {jeZadana && <span className="text-gray-400">(zadana)</span>}
          </label>
          <input id={`naziv-${sumarija.id}`} className={polje} value={naziv} onChange={(e) => setNaziv(e.target.value)} maxLength={60} />
        </div>
        {naziv.trim() !== sumarija.naziv && naziv.trim() !== "" && (
          <button disabled={zauzeto} className={dugme} onClick={() => radi(() => updateSumarija(sumarija.id, { naziv: naziv.trim() }))}>Sačuvaj naziv</button>
        )}
        {!jeZadana && (
          <button disabled={zauzeto} className="text-xs text-amber-600 dark:text-amber-400 hover:underline pb-2"
            onClick={() => radi(() => updateSumarija(sumarija.id, { arhivirana: !sumarija.arhivirana }))}>
            {sumarija.arhivirana ? "Vrati iz arhive" : "Arhiviraj"}
          </button>
        )}
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
        {clanovi.length} {clanovi.length === 1 ? "korisnik" : "korisnika"}
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Admin šumarije</h3>
        {admini.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Nema admina — ovu šumariju za sada vodi samo super admin.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {admini.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-1.5 text-sm">
                <span className="font-mono font-medium">{a.ime}</span>
                <span className="text-gray-500 dark:text-gray-400 truncate">{a.fullName}</span>
                <button disabled={zauzeto} className="ml-auto text-xs text-amber-600 dark:text-amber-400 hover:underline"
                  onClick={() => radi(() => updateKorisnik(a.id, { role: "worker" }).then(() => undefined))}>
                  Ukloni admina
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 pt-1">
          <div>
            <label htmlFor={`adm-ime-${sumarija.id}`} className="sr-only">Korisničko ime novog admina</label>
            <input id={`adm-ime-${sumarija.id}`} className={polje} placeholder="Korisničko ime novog admina" value={novi.ime} maxLength={30}
              onChange={(e) => setNovi({ ...novi, ime: e.target.value })} />
          </div>
          <div>
            <label htmlFor={`adm-pun-${sumarija.id}`} className="sr-only">Puno ime i prezime</label>
            <input id={`adm-pun-${sumarija.id}`} className={polje} placeholder="Puno ime i prezime" value={novi.fullName} maxLength={60}
              onChange={(e) => setNovi({ ...novi, fullName: e.target.value })} />
          </div>
          <button disabled={zauzeto} className={dugme} onClick={dodajAdmina}>+ Novi admin</button>
        </div>

        {kandidati.length > 0 && (
          <div className="flex gap-2">
            <label htmlFor={`adm-post-${sumarija.id}`} className="sr-only">Postojeći korisnik kao admin</label>
            <select id={`adm-post-${sumarija.id}`} className={polje} value={postojeci} onChange={(e) => setPostojeci(e.target.value)}>
              <option value="">Ili postavi postojećeg korisnika za admina…</option>
              {kandidati.map((k) => <option key={k.id} value={k.id}>{k.fullName || k.ime}</option>)}
            </select>
            <button disabled={zauzeto || !postojeci} className={dugme} onClick={postaviPostojeceg}>Postavi</button>
          </div>
        )}
      </div>
    </section>
  );
}
