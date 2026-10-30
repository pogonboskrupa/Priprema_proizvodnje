"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createKorisnik, createSumarija, getKorisnikByIme, getSumarije, getSviKorisnici, updateKorisnik, updateSumarija } from "@/lib/db";
import { generatePin } from "@/lib/auth";
import { fmtLastOnline } from "@/lib/format";
import { DEFAULT_SUMARIJA_ID, grupisiPoSumarijama, jeSuperAdmin, sumarijaOd, ulogaLabel, type GrupaKorisnika, type Sumarija } from "@/lib/sumarija";
import type { Korisnik } from "@/lib/types";
import { SortTh, sortiraj, type SortStanje } from "@/components/SortTh";
import { PinSpisak, type PinRed } from "@/components/PinSpisak";

const polje = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100";
const dugme = "bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-800 disabled:opacity-50";
const kartica = "bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm";
const th = "text-left px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300";

type Radi = (a: () => Promise<void>) => Promise<void>;
type Pogled = "po" | "svi";
type SortKey = "ime" | "korisnik" | "uloga" | "online";

interface Akcije {
  zauzeto: boolean;
  radi: Radi;
  toast: (m: string) => void;
  onResetPin: (k: Korisnik) => void;
  onArhiviraj: (k: Korisnik) => void;
  onVrati: (k: Korisnik) => void;
}

/** Samo Šef sektora: šumarije, vodeći projektant i radnici svake šumarije */
export function SumarijePostavke({ onPin, toast, onResetPin, onArhiviraj, onVrati, verzija }: {
  onPin: (n: { ime: string; pin: string; novi: boolean; uloga?: string }) => void;
  toast: (m: string) => void;
  onResetPin: (k: Korisnik) => void;
  onArhiviraj: (k: Korisnik) => void;
  onVrati: (k: Korisnik) => void;
  /** Roditelj povećava kad se korisnici promijene izvan ove kartice (reset PIN, arhiviranje) */
  verzija: number;
}) {
  const [sumarije, setSumarije] = useState<Sumarija[]>([]);
  const [korisnici, setKorisnici] = useState<Korisnik[]>([]);
  const [pogled, setPogled] = useState<Pogled>("po");
  const [trazi, setTrazi] = useState("");
  const [arhivirani, setArhivirani] = useState(false);
  const [novaSumarija, setNovaSumarija] = useState("");
  const [zauzeto, setZauzeto] = useState(false);
  const [pinSpisak, setPinSpisak] = useState<{ naslov: string; redovi: PinRed[] } | null>(null);
  // toast roditelja se mijenja pri svakom renderu; ref sprječava beskonačno ponovno učitavanje
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; });

  const ucitaj = useCallback(async () => {
    try {
      const [s, k] = await Promise.all([getSumarije({ ukljuciArhivirane: true }), getSviKorisnici()]);
      setSumarije(s);
      setKorisnici(k);
    } catch {
      toastRef.current("Greška pri učitavanju šumarija. Provjeri internet.");
    }
  }, []);

  useEffect(() => {
    let otkazano = false;
    Promise.all([getSumarije({ ukljuciArhivirane: true }), getSviKorisnici()])
      .then(([s, k]) => { if (!otkazano) { setSumarije(s); setKorisnici(k); } })
      .catch(() => { if (!otkazano) toastRef.current("Greška pri učitavanju šumarija. Provjeri internet."); });
    return () => { otkazano = true; };
  }, [verzija]);

  const radi: Radi = async (akcija) => {
    setZauzeto(true);
    try { await akcija(); await ucitaj(); } catch { toast("Greška pri snimanju. Provjeri internet i pokušaj ponovo."); }
    setZauzeto(false);
  };

  // Šef sektora (admin bez šumarije) ne pripada nijednoj šumariji
  const radnici = useMemo(() => korisnici.filter((k) => !jeSuperAdmin(k)), [korisnici]);
  const aktivni = radnici.filter((k) => !k.arhiviran);
  const filtrirani = useMemo(() => {
    const t = trazi.trim().toLowerCase();
    return radnici.filter((k) =>
      (arhivirani || !k.arhiviran) && (!t || k.ime.toLowerCase().includes(t) || (k.fullName ?? "").toLowerCase().includes(t)));
  }, [radnici, trazi, arhivirani]);

  const dodajSumariju = () => radi(async () => {
    const naziv = novaSumarija.trim();
    if (!naziv) { toast("Upiši naziv šumarije!"); return; }
    if (sumarije.some((s) => s.naziv.toLowerCase() === naziv.toLowerCase())) { toast("Šumarija s tim nazivom već postoji."); return; }
    await createSumarija(naziv);
    setNovaSumarija("");
  });

  const akcije: Akcije = { zauzeto, radi, toast, onResetPin, onArhiviraj, onVrati };

  return (
    <div className="space-y-4">
      {pinSpisak && <PinSpisak redovi={pinSpisak.redovi} naslov={pinSpisak.naslov} onZatvori={() => setPinSpisak(null)} toast={toast} />}

      <div className={`${kartica} p-5 space-y-3`}>
        <h2 className="font-semibold text-gray-700 dark:text-gray-200">Nova šumarija</h2>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); dodajSumariju(); }}>
          <label htmlFor="nova-sumarija" className="sr-only">Naziv šumarije</label>
          <input id="nova-sumarija" className={polje} value={novaSumarija} onChange={(e) => setNovaSumarija(e.target.value)} maxLength={60} placeholder="Naziv šumarije" />
          <button type="submit" disabled={zauzeto} className={`${dugme} whitespace-nowrap`}>Dodaj</button>
        </form>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Nova šumarija počinje prazna: vodeće projektante i radnike dodaješ ispod, a odjele nakon što je izabereš u traci iznad.
        </p>
      </div>

      <div className={`${kartica} p-4 flex flex-wrap items-center gap-x-5 gap-y-3`}>
        <Zbir broj={sumarije.filter((s) => !s.arhivirana).length} naziv="šumarija" />
        <Zbir broj={aktivni.filter((k) => k.role === "admin").length} naziv="vodećih projektanata" />
        <Zbir broj={aktivni.filter((k) => k.role === "worker").length} naziv="radnika" />
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label htmlFor="trazi-radnika" className="sr-only">Pretraga radnika</label>
          <input id="trazi-radnika" type="search" className={`${polje} !w-56`} placeholder="Traži radnika…" value={trazi} onChange={(e) => setTrazi(e.target.value)} />
          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={arhivirani} onChange={(e) => setArhivirani(e.target.checked)} />
            Arhivirani
          </label>
          <div role="tablist" aria-label="Pogled radnika" className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
            {([["po", "Po šumarijama"], ["svi", "Svi radnici"]] as const).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={pogled === id} onClick={() => setPogled(id)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  pogled === id ? "bg-white dark:bg-gray-700 text-green-700 dark:text-green-300 shadow-sm" : "text-gray-500 dark:text-gray-400"
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {pogled === "svi" ? (
        <div className={`${kartica} overflow-hidden`}>
          <SviRadniciTabela grupe={grupisiPoSumarijama(filtrirani, sumarije)} sumarije={sumarije} akcije={akcije} skrijPrazne={trazi.trim() !== ""} />
        </div>
      ) : (
        sumarije.map((s) => (
          <SumarijaKartica key={s.id} sumarija={s} sumarije={sumarije}
            radnici={filtrirani.filter((k) => sumarijaOd(k) === s.id)} ukupno={aktivni.filter((k) => sumarijaOd(k) === s.id)}
            akcije={akcije} onPin={onPin} onSpisak={(naslov, redovi) => setPinSpisak({ naslov, redovi })} />
        ))
      )}
    </div>
  );
}

function Zbir({ broj, naziv }: { broj: number; naziv: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-2xl font-bold tabular-nums text-gray-800 dark:text-gray-100">{broj}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400">{naziv}</span>
    </div>
  );
}

function vrijednostSorta(k: Korisnik, key: SortKey, sumarije: readonly Sumarija[]): string {
  switch (key) {
    case "ime": return k.fullName || k.ime;
    case "korisnik": return k.ime;
    case "uloga": return ulogaLabel(k, sumarije);
    case "online": return k.lastOnlineAt ?? k.lastLoginAt ?? "";
  }
}

const poImenu = (a: Korisnik, b: Korisnik) => (a.fullName || a.ime).localeCompare(b.fullName || b.ime, "bs");

function TabelaZaglavlje({ sort, onChange }: { sort: SortStanje<SortKey>; onChange: (s: SortStanje<SortKey>) => void }) {
  return (
    <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <tr>
        <SortTh label="Radnik" col="ime" tekst stanje={sort} onChange={onChange} className={th} />
        <SortTh label="Korisničko ime" col="korisnik" tekst stanje={sort} onChange={onChange} className={th} />
        <SortTh label="Uloga" col="uloga" tekst stanje={sort} onChange={onChange} className={th} />
        <SortTh label="Zadnji online" col="online" stanje={sort} onChange={onChange} className={th} />
        <th className={th}></th>
      </tr>
    </thead>
  );
}

/** Jedan red tabele; vodeći projektant je istaknut i može izgubiti ulogu */
function RadnikRed({ k, sumarije, akcije, vodeci = false }: {
  k: Korisnik;
  sumarije: readonly Sumarija[];
  akcije: Akcije;
  vodeci?: boolean;
}) {
  const { zauzeto, radi, onResetPin, onArhiviraj, onVrati } = akcije;
  return (
    <tr className={`border-t border-gray-100 dark:border-gray-800 ${k.arhiviran ? "opacity-60" : ""} ${vodeci ? "bg-green-50/70 dark:bg-green-950/30" : ""}`}>
      <td className={`px-3 py-2 font-medium text-gray-800 dark:text-gray-100 border-l-4 ${vodeci ? "border-green-600" : "border-transparent"}`}>
        {k.fullName || "–"}{k.arhiviran && <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">arhiviran</span>}
      </td>
      <td className="px-3 py-2 font-mono text-xs">{k.ime}</td>
      <td className="px-3 py-2">
        <div className={`text-xs ${vodeci ? "font-semibold text-green-800 dark:text-green-300" : "text-gray-700 dark:text-gray-200"}`}>{ulogaLabel(k, sumarije)}</div>
        {k.role === "worker" && (k.operater || k.sihter || k.izvjestaji) && (
          <div className="mt-0.5 flex gap-1">
            {k.operater && <Oznaka tekst="Operater" boja="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300" />}
            {k.sihter && <Oznaka tekst="Šihter" boja="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300" />}
            {k.izvjestaji && <Oznaka tekst="Izvještaji" boja="bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300" />}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtLastOnline(k.lastOnlineAt ?? k.lastLoginAt)}</td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <select aria-label={`Premjesti ${k.ime} u šumariju`} value={sumarijaOd(k)} disabled={zauzeto}
          onChange={(e) => radi(() => updateKorisnik(k.id, { sumarijaId: e.target.value }).then(() => undefined))}
          className="mr-3 max-w-[9rem] border border-gray-300 dark:border-gray-600 rounded-lg px-1.5 py-1 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
          {sumarije.filter((s) => !s.arhivirana || s.id === sumarijaOd(k)).map((s) => <option key={s.id} value={s.id}>{s.naziv}</option>)}
        </select>
        <button onClick={() => onResetPin(k)} className="text-amber-600 dark:text-amber-400 hover:underline text-xs mr-3">Reset PIN</button>
        {vodeci && (
          <button disabled={zauzeto} onClick={() => radi(() => updateKorisnik(k.id, { role: "worker" }).then(() => undefined))}
            className="text-amber-600 dark:text-amber-400 hover:underline text-xs mr-3">Ukloni ulogu</button>
        )}
        {k.arhiviran
          ? <button onClick={() => onVrati(k)} className="text-green-700 dark:text-green-400 hover:underline text-xs">Vrati</button>
          : <button onClick={() => onArhiviraj(k)} className="text-amber-600 dark:text-amber-400 hover:underline text-xs">Arhiviraj</button>}
      </td>
    </tr>
  );
}

/** Tabela radnika jedne šumarije s klikabilnim zaglavljima */
function RadniciTabela({ redovi, sumarije, akcije, prazno }: {
  redovi: readonly Korisnik[];
  sumarije: readonly Sumarija[];
  akcije: Akcije;
  prazno: string;
}) {
  const [sort, setSort] = useState<SortStanje<SortKey>>({ key: "ime", dir: "asc" });
  const poredani = sortiraj(redovi, sort, (k, key) => vrijednostSorta(k, key, sumarije));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <TabelaZaglavlje sort={sort} onChange={setSort} />
        <tbody>
          {poredani.map((k) => <RadnikRed key={k.id} k={k} sumarije={sumarije} akcije={akcije} />)}
          {poredani.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">{prazno}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/** Svi radnici: odjeljak za svaku šumariju, prvi red je vodeći projektant; sortiranje važi za radnike unutar odjeljka */
function SviRadniciTabela({ grupe, sumarije, akcije, skrijPrazne }: {
  grupe: readonly GrupaKorisnika<Korisnik>[];
  sumarije: readonly Sumarija[];
  akcije: Akcije;
  /** Pretraga je aktivna: odjeljci bez rezultata se ne prikazuju */
  skrijPrazne: boolean;
}) {
  const [sort, setSort] = useState<SortStanje<SortKey>>({ key: "ime", dir: "asc" });
  const vidljive = grupe.filter((g) => !skrijPrazne || g.vodeci.length + g.radnici.length > 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <TabelaZaglavlje sort={sort} onChange={setSort} />
        {vidljive.map(({ sumarija, vodeci, radnici }) => (
          <tbody key={sumarija.id}>
            <tr className="border-t-2 border-green-700/30 bg-green-100/70 dark:bg-green-950/50">
              <th colSpan={5} scope="colgroup" className="px-3 py-2 text-left">
                <span className="text-sm font-bold text-green-900 dark:text-green-200">{sumarija.naziv}</span>
                <span className="ml-3 text-xs font-normal text-green-800/80 dark:text-green-300/70 tabular-nums">
                  {vodeci.length === 0 ? "vodeći projektant nije postavljen" : `${vodeci.length} ${vodeci.length === 1 ? "vodeći projektant" : "vodeća projektanta"}`}
                  {" · "}{radnici.length} {radnici.length === 1 ? "radnik" : "radnika"}
                </span>
              </th>
            </tr>
            {[...vodeci].sort(poImenu).map((k) => <RadnikRed key={k.id} k={k} sumarije={sumarije} akcije={akcije} vodeci />)}
            {sortiraj(radnici, sort, (k, key) => vrijednostSorta(k, key, sumarije)).map((k) => <RadnikRed key={k.id} k={k} sumarije={sumarije} akcije={akcije} />)}
            {vodeci.length + radnici.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nema radnika u ovoj šumariji.</td></tr>
            )}
          </tbody>
        ))}
        {vidljive.length === 0 && <tbody><tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Nema radnika za prikaz.</td></tr></tbody>}
      </table>
    </div>
  );
}

function Oznaka({ tekst, boja }: { tekst: string; boja: string }) {
  return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${boja}`}>{tekst}</span>;
}

function SumarijaKartica({ sumarija, sumarije, radnici, ukupno, akcije, onPin, onSpisak }: {
  sumarija: Sumarija;
  sumarije: readonly Sumarija[];
  /** Radnici i vodeći projektanti nakon pretrage/filtra arhiviranih */
  radnici: readonly Korisnik[];
  /** Svi aktivni korisnici šumarije */
  ukupno: readonly Korisnik[];
  akcije: Akcije;
  onPin: (n: { ime: string; pin: string; novi: boolean; uloga?: string }) => void;
  onSpisak: (naslov: string, redovi: PinRed[]) => void;
}) {
  const { zauzeto, radi, toast } = akcije;
  const [naziv, setNaziv] = useState(sumarija.naziv);
  const [novi, setNovi] = useState({ ime: "", fullName: "" });
  const [postojeci, setPostojeci] = useState("");
  const [dodaje, setDodaje] = useState(false);
  const jeZadana = sumarija.id === DEFAULT_SUMARIJA_ID;
  const vodeci = ukupno.filter((k) => k.role === "admin");
  const kandidati = ukupno.filter((k) => k.role === "worker");
  const ulogaVodeci = `Vodeći projektant ${sumarija.naziv}`;

  const dodajVodeceg = () => radi(async () => {
    const ime = novi.ime.trim().toUpperCase();
    if (!ime) { toast("Upiši korisničko ime vodećeg projektanta!"); return; }
    // prijava traži jedinstveno ime u cijeloj aplikaciji, ne samo u ovoj šumariji
    if (await getKorisnikByIme(ime)) { toast("Korisnik s tim imenom već postoji (možda u arhivi)!"); return; }
    const pin = generatePin();
    await createKorisnik({
      ime, fullName: novi.fullName.trim() || ime, title: "", pin, role: "admin",
      sumarijaId: sumarija.id, avatar: "", odjeliIds: [],
    });
    setNovi({ ime: "", fullName: "" });
    onPin({ ime, pin, novi: true, uloga: ulogaVodeci });
  });

  const postaviPostojeceg = () => radi(async () => {
    if (!postojeci) return;
    await updateKorisnik(postojeci, { role: "admin", sumarijaId: sumarija.id });
    setPostojeci("");
  });

  return (
    <section className={`${kartica} p-5 space-y-5 ${sumarija.arhivirana ? "opacity-60" : ""}`}>
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

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Vodeći projektant</h3>
        {vodeci.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Nije postavljen — šumariju za sada vodi samo Šef sektora.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {vodeci.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-1.5 text-sm">
                <span className="font-medium">{a.fullName || a.ime}</span>
                <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{a.ime}</span>
                <span className="ml-auto flex items-center gap-3">
                  <button disabled={zauzeto} className="text-xs text-amber-600 dark:text-amber-400 hover:underline" onClick={() => akcije.onResetPin(a)}>Reset PIN</button>
                  <button disabled={zauzeto} className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                    onClick={() => radi(() => updateKorisnik(a.id, { role: "worker" }).then(() => undefined))}>
                    Ukloni ulogu
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 pt-1">
          <div>
            <label htmlFor={`vp-ime-${sumarija.id}`} className="sr-only">Korisničko ime vodećeg projektanta</label>
            <input id={`vp-ime-${sumarija.id}`} className={polje} placeholder="Korisničko ime" value={novi.ime} maxLength={30}
              onChange={(e) => setNovi({ ...novi, ime: e.target.value })} />
          </div>
          <div>
            <label htmlFor={`vp-pun-${sumarija.id}`} className="sr-only">Puno ime i prezime</label>
            <input id={`vp-pun-${sumarija.id}`} className={polje} placeholder="Puno ime i prezime" value={novi.fullName} maxLength={60}
              onChange={(e) => setNovi({ ...novi, fullName: e.target.value })} />
          </div>
          <button disabled={zauzeto} className={dugme} onClick={dodajVodeceg}>+ Novi vodeći projektant</button>
        </div>

        {kandidati.length > 0 && (
          <div className="flex gap-2">
            <label htmlFor={`vp-post-${sumarija.id}`} className="sr-only">Postojeći radnik kao vodeći projektant</label>
            <select id={`vp-post-${sumarija.id}`} className={polje} value={postojeci} onChange={(e) => setPostojeci(e.target.value)}>
              <option value="">Ili postavi postojećeg radnika za vodećeg projektanta…</option>
              {kandidati.map((k) => <option key={k.id} value={k.id}>{k.fullName || k.ime}</option>)}
            </select>
            <button disabled={zauzeto || !postojeci} className={dugme} onClick={postaviPostojeceg}>Postavi</button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Radnici <span className="tabular-nums">({kandidati.length})</span>
          </h3>
          <button onClick={() => setDodaje((v) => !v)} className={`${dugme} ml-auto`}>{dodaje ? "Zatvori" : "+ Dodaj radnike"}</button>
        </div>
        {dodaje && (
          <DodajRadnike sumarija={sumarija} akcije={akcije}
            onGotovo={(redovi) => onSpisak(`Radnici dodani u šumariju ${sumarija.naziv}`, redovi)} />
        )}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <RadniciTabela redovi={radnici.filter((k) => k.role === "worker")} sumarije={sumarije} akcije={akcije} prazno="Nema radnika u ovoj šumariji." />
        </div>
      </div>
    </section>
  );
}

interface RedUnosa { ime: string; fullName: string }
const prazanRed = (): RedUnosa => ({ ime: "", fullName: "" });

/** Spisak radnika: tabela s dva stupca (korisničko ime, puno ime); višelinijsko lijepljenje popunjava redove */
function DodajRadnike({ sumarija, akcije, onGotovo }: {
  sumarija: Sumarija;
  akcije: Akcije;
  onGotovo: (redovi: PinRed[]) => void;
}) {
  const { zauzeto, radi, toast } = akcije;
  const [redovi, setRedovi] = useState<RedUnosa[]>(() => [prazanRed(), prazanRed(), prazanRed()]);
  const [greske, setGreske] = useState<Record<number, string>>({});

  const postavi = (i: number, dio: Partial<RedUnosa>) =>
    setRedovi((r) => r.map((x, j) => (j === i ? { ...x, ...dio } : x)));

  /** true = zalijepljen spisak je obrađen, preglednik ne smije umetnuti tekst u polje */
  function zalijepi(od: number, tekst: string): boolean {
    const linije = tekst.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (linije.length < 2 && !/[\t;]/.test(tekst)) return false;
    const novi = linije.map((l) => {
      const [ime, ...ostalo] = l.split(/\t|;/);
      return { ime: ime.trim(), fullName: ostalo.join(" ").trim() };
    });
    setRedovi((r) => [...r.slice(0, od), ...novi, ...r.slice(od + novi.length)]);
    setGreske({});
    return true;
  }

  const popunjeni = redovi.filter((r) => r.ime.trim() || r.fullName.trim()).length;

  const dodaj = () => radi(async () => {
    const unos = redovi
      .map((r, i) => ({ i, ime: r.ime.trim().toUpperCase(), fullName: r.fullName.trim() }))
      .filter((r) => r.ime || r.fullName);
    if (!unos.length) { toast("Upiši bar jednog radnika."); return; }

    const err: Record<number, string> = {};
    const vidjeni = new Set<string>();
    for (const r of unos) {
      if (!r.ime) err[r.i] = "Upiši korisničko ime.";
      else if (vidjeni.has(r.ime)) err[r.i] = "Ime se ponavlja u spisku.";
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
    for (const r of unos) {
      try {
        const pin = generatePin();
        await createKorisnik({ ime: r.ime, fullName: r.fullName || r.ime, title: "", pin, role: "worker", sumarijaId: sumarija.id, avatar: "", odjeliIds: [] });
        gotovi.push({ ime: r.ime, fullName: r.fullName || r.ime, pin, sumarija: sumarija.naziv });
      } catch {
        neuspjeli.push(r.i);
      }
    }
    if (gotovi.length) onGotovo(gotovi);
    if (neuspjeli.length) {
      setRedovi(neuspjeli.map((i) => redovi[i]));
      setGreske(Object.fromEntries(neuspjeli.map((_, k) => [k, "Greška pri snimanju — pokušaj ponovo."])));
      toast(`Dodano ${gotovi.length}, neuspjelo ${neuspjeli.length}.`);
    } else {
      setRedovi([prazanRed(), prazanRed(), prazanRed()]);
      setGreske({});
    }
  });

  return (
    <div className="rounded-lg border border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20 p-3 space-y-2">
      <p className="text-xs text-gray-600 dark:text-gray-300">
        Upiši korisničko ime i puno ime, ili zalijepi spisak iz Excela (dva stupca). PIN se dodjeljuje automatski.
      </p>
      <div className="space-y-1.5">
        {redovi.map((r, i) => (
          <div key={i}>
            <div className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
              <input aria-label={`Korisničko ime, red ${i + 1}`} className={polje} placeholder="Korisničko ime" maxLength={30} value={r.ime}
                onChange={(e) => postavi(i, { ime: e.target.value })}
                onPaste={(e) => { if (zalijepi(i, e.clipboardData.getData("text"))) e.preventDefault(); }} />
              <input aria-label={`Puno ime i prezime, red ${i + 1}`} className={polje} placeholder="Puno ime i prezime" maxLength={60} value={r.fullName}
                onChange={(e) => postavi(i, { fullName: e.target.value })}
                onPaste={(e) => { if (zalijepi(i, e.clipboardData.getData("text"))) e.preventDefault(); }} />
              <button type="button" aria-label={`Ukloni red ${i + 1}`} disabled={redovi.length === 1}
                onClick={() => { setRedovi((x) => x.filter((_, j) => j !== i)); setGreske({}); }}
                className="px-2 text-gray-400 hover:text-red-600 disabled:opacity-30">✕</button>
            </div>
            {greske[i] && <p role="alert" className="mt-0.5 text-xs text-red-600 dark:text-red-400">{greske[i]}</p>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button type="button" onClick={() => setRedovi((r) => [...r, prazanRed()])} className="text-xs font-medium text-green-700 dark:text-green-400 hover:underline">+ red</button>
        <button disabled={zauzeto || popunjeni === 0} onClick={dodaj} className={`${dugme} ml-auto`}>
          Dodaj {popunjeni > 0 ? popunjeni : ""} {popunjeni === 1 ? "radnika" : "radnika"}
        </button>
      </div>
    </div>
  );
}
