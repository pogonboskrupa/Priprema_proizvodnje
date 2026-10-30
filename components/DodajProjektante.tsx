"use client";
import { useMemo, useState } from "react";
import { createKorisnik, getKorisnikByIme } from "@/lib/db";
import { generatePin } from "@/lib/auth";
import { jedinstvenoIme, predloziKorisnickoIme } from "@/lib/korisnicko-ime";
import { kratkiNaziv } from "@/lib/sumarija";
import type { PinRed } from "@/components/PinSpisak";

interface Red { ime: string; fullName: string; title: string }
const prazanRed = (): Red => ({ ime: "", fullName: "", title: "" });
const pocetniRedovi = () => [prazanRed(), prazanRed(), prazanRed()];

const polje = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400";
const PRAVA = [
  { kljuc: "operater", naziv: "Operater", opis: "unosi učinak za sve projektante" },
  { kljuc: "sihter", naziv: "Šihter", opis: "vodi evidenciju rada svih" },
  { kljuc: "izvjestaji", naziv: "Izvještaji", opis: "vidi sedmični i mjesečni izvještaj" },
] as const;
type Prava = Record<(typeof PRAVA)[number]["kljuc"], boolean>;

/**
 * Dodavanje projektanata jedne šumarije: tabela (korisničko ime, ime i prezime, radno mjesto),
 * lijepljenje spiska iz Excela, prijedlog korisničkih imena i prava za cijelu grupu. PIN je nasumičan.
 */
export function DodajProjektante({ sumarija, onGotovo, onDodano, toast }: {
  sumarija: { id: string; naziv: string };
  onGotovo: (redovi: PinRed[]) => void;
  onDodano: () => void | Promise<void>;
  toast: (m: string) => void;
}) {
  const [redovi, setRedovi] = useState<Red[]>(pocetniRedovi);
  const [greske, setGreske] = useState<Record<number, string>>({});
  const [prava, setPrava] = useState<Prava>({ operater: false, sihter: false, izvjestaji: false });
  const [zauzeto, setZauzeto] = useState(false);
  const [napredak, setNapredak] = useState("");

  const postavi = (i: number, dio: Partial<Red>) => {
    setRedovi((r) => r.map((x, j) => (j === i ? { ...x, ...dio } : x)));
    setGreske((g) => { const ostalo = { ...g }; delete ostalo[i]; return ostalo; });
  };

  // isto korisničko ime u dva reda označava se odmah, ne tek pri snimanju
  const duplikati = useMemo(() => {
    const brojac = new Map<string, number>();
    for (const r of redovi) { const k = r.ime.trim().toUpperCase(); if (k) brojac.set(k, (brojac.get(k) ?? 0) + 1); }
    return new Set([...brojac].filter(([, n]) => n > 1).map(([k]) => k));
  }, [redovi]);

  /** true = zalijepljen spisak je obrađen, preglednik ne smije umetnuti tekst u polje */
  function zalijepi(od: number, tekst: string): boolean {
    const linije = tekst.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (linije.length < 2 && !/[\t;]/.test(tekst)) return false;
    const novi = linije.map((l): Red => {
      const dijelovi = l.split(/\t|;/).map((d) => d.trim());
      // jedna kolona: ime i prezime (ima razmak) ili samo korisničko ime
      if (dijelovi.length === 1) return /\s/.test(dijelovi[0]) ? { ime: "", fullName: dijelovi[0], title: "" } : { ime: dijelovi[0], fullName: "", title: "" };
      return { ime: dijelovi[0], fullName: dijelovi[1] ?? "", title: dijelovi.slice(2).join(" ") };
    });
    setRedovi((r) => [...r.slice(0, od), ...novi, ...r.slice(od + novi.length)]);
    setGreske({});
    return true;
  }

  function predloziImena() {
    const zauzeta = new Set(redovi.map((r) => r.ime.trim().toUpperCase()).filter(Boolean));
    // izračun izvan setState funkcije: ona se u razvoju poziva dvaput, a skup zauzetih imena se mijenja
    setRedovi(redovi.map((x) => {
      if (x.ime.trim() || !x.fullName.trim()) return x;
      const ime = jedinstvenoIme(predloziKorisnickoIme(x.fullName), zauzeta);
      if (ime) zauzeta.add(ime);
      return { ...x, ime };
    }));
    setGreske({});
  }

  const popunjeni = redovi.filter((r) => r.ime.trim() || r.fullName.trim()).length;
  const bezImena = redovi.filter((r) => !r.ime.trim() && r.fullName.trim()).length;

  async function dodaj() {
    const unos = redovi
      .map((r, i) => ({ i, ime: r.ime.trim().toUpperCase(), fullName: r.fullName.trim(), title: r.title.trim() }))
      .filter((r) => r.ime || r.fullName);
    if (!unos.length) { toast("Upiši bar jednog projektanta."); return; }

    setZauzeto(true);
    try {
      const err: Record<number, string> = {};
      const vidjeni = new Set<string>();
      for (const r of unos) {
        if (!r.ime) err[r.i] = "Upiši korisničko ime (ili klikni „Predloži korisnička imena“).";
        else if (vidjeni.has(r.ime)) err[r.i] = "Korisničko ime se ponavlja u spisku.";
        vidjeni.add(r.ime);
      }
      // prijava traži jedinstveno ime u cijeloj aplikaciji, pa se provjerava i arhiva
      await Promise.all(unos.filter((r) => r.ime && !err[r.i]).map(async (r) => {
        if (await getKorisnikByIme(r.ime)) err[r.i] = "Korisničko ime je zauzeto (možda u arhivi).";
      }));
      setGreske(err);
      if (Object.keys(err).length) { toast("Ispravi označene redove."); return; }

      const gotovi: PinRed[] = [];
      const neuspjeli: number[] = [];
      for (const [n, r] of unos.entries()) {
        setNapredak(`Dodajem ${n + 1} od ${unos.length}…`);
        try {
          const pin = generatePin();
          await createKorisnik({
            ime: r.ime, fullName: r.fullName || r.ime, title: r.title, pin, role: "worker", sumarijaId: sumarija.id,
            avatar: "", odjeliIds: [], operater: prava.operater, sihter: prava.sihter, izvjestaji: prava.izvjestaji,
          });
          gotovi.push({ ime: r.ime, fullName: r.fullName || r.ime, pin, sumarija: kratkiNaziv(sumarija.naziv) });
        } catch {
          neuspjeli.push(r.i);
        }
      }
      if (gotovi.length) { onGotovo(gotovi); await onDodano(); }
      if (neuspjeli.length) {
        // neuspjeli redovi ostaju u tabeli da se pokušaju ponovo
        setRedovi(neuspjeli.map((i) => redovi[i]));
        setGreske(Object.fromEntries(neuspjeli.map((_, k) => [k, "Greška pri snimanju — pokušaj ponovo."])));
        toast(`Dodano ${gotovi.length}, neuspjelo ${neuspjeli.length}.`);
      } else {
        setRedovi(pocetniRedovi());
        setGreske({});
        toast(`Dodano: ${gotovi.length} ✓`);
      }
    } finally {
      setZauzeto(false);
      setNapredak("");
    }
  }

  return (
    <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20 p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-gray-800 dark:text-gray-100">Novi projektanti <span className="font-normal text-gray-500 dark:text-gray-400">· {kratkiNaziv(sumarija.naziv)}</span></h3>
        <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
          Upiši projektante ili zalijepi spisak iz Excela (kolone: korisničko ime, ime i prezime, radno mjesto). PIN se dodjeljuje automatski i prikaže jednom, nakon dodavanja.
        </p>
      </div>

      <div className="space-y-2">
        <div className="hidden sm:grid grid-cols-[1fr_1.3fr_1fr_1.5rem] gap-2 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <span>Korisničko ime</span><span>Ime i prezime</span><span>Radno mjesto <span className="font-normal normal-case">(neobavezno)</span></span><span />
        </div>
        {redovi.map((r, i) => {
          const dup = duplikati.has(r.ime.trim().toUpperCase());
          return (
            <div key={i} className="rounded-lg sm:rounded-none bg-white/60 dark:bg-gray-900/40 sm:bg-transparent p-2 sm:p-0">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.3fr_1fr_1.5rem] gap-2 sm:items-center">
                <input aria-label={`Korisničko ime, red ${i + 1}`} placeholder="Korisničko ime" maxLength={30} autoComplete="off" value={r.ime}
                  className={`${polje} font-mono uppercase ${dup || greske[i] ? "!border-red-400" : ""}`}
                  onChange={(e) => postavi(i, { ime: e.target.value })}
                  onPaste={(e) => { if (zalijepi(i, e.clipboardData.getData("text"))) e.preventDefault(); }} />
                <input aria-label={`Ime i prezime, red ${i + 1}`} placeholder="Ime i prezime" maxLength={60} autoComplete="off" value={r.fullName}
                  className={polje}
                  onChange={(e) => postavi(i, { fullName: e.target.value })}
                  onPaste={(e) => { if (zalijepi(i, e.clipboardData.getData("text"))) e.preventDefault(); }} />
                <input aria-label={`Radno mjesto, red ${i + 1}`} placeholder="Radno mjesto" maxLength={60} autoComplete="off" value={r.title}
                  className={polje}
                  onChange={(e) => postavi(i, { title: e.target.value })} />
                <button type="button" aria-label={`Ukloni red ${i + 1}`} disabled={redovi.length === 1}
                  onClick={() => { setRedovi((x) => x.filter((_, j) => j !== i)); setGreske({}); }}
                  className="justify-self-end sm:justify-self-center text-gray-400 hover:text-red-600 disabled:opacity-30">✕</button>
              </div>
              {(greske[i] || dup) && <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{greske[i] ?? "Korisničko ime se ponavlja u spisku."}</p>}
            </div>
          );
        })}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <button type="button" onClick={() => setRedovi((r) => [...r, prazanRed()])} className="text-xs font-medium text-green-700 dark:text-green-400 hover:underline">+ red</button>
          <button type="button" onClick={() => setRedovi((r) => [...r, ...Array.from({ length: 5 }, prazanRed)])} className="text-xs font-medium text-green-700 dark:text-green-400 hover:underline">+ 5 redova</button>
          {bezImena > 0 && (
            <button type="button" onClick={predloziImena} className="text-xs font-semibold text-green-800 dark:text-green-300 hover:underline">
              Predloži korisnička imena ({bezImena})
            </button>
          )}
        </div>
      </div>

      <fieldset className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/40 px-3 py-2.5">
        <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Dodatna prava za sve u spisku (neobavezno)</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
          {PRAVA.map((p) => (
            <label key={p.kljuc} className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
              <input type="checkbox" checked={prava[p.kljuc]} onChange={(e) => setPrava((x) => ({ ...x, [p.kljuc]: e.target.checked }))} className="h-4 w-4 accent-green-700" />
              <span><span className="font-medium">{p.naziv}</span> <span className="text-xs text-gray-500 dark:text-gray-400">— {p.opis}</span></span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={zauzeto || popunjeni === 0} onClick={dodaj}
          className="bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50">
          {zauzeto ? napredak || "Dodajem…" : popunjeni > 0 ? `Dodaj ${popunjeni} ${popunjeni === 1 ? "projektanta" : "projektanata"}` : "Dodaj projektante"}
        </button>
        {!zauzeto && popunjeni > 0 && <span className="text-xs text-gray-500 dark:text-gray-400">Svi će dobiti nasumični PIN.</span>}
      </div>
    </div>
  );
}
