"use client";
import { useEffect, useMemo, useState } from "react";
import { getSviKorisnici } from "@/lib/db";
import { fmtLastOnline } from "@/lib/format";
import { grupisiPoSumarijama, jeSuperAdmin, ulogaLabel, type Sumarija } from "@/lib/sumarija";
import type { Korisnik } from "@/lib/types";
import { SortTh, sortiraj, type SortStanje } from "@/components/SortTh";
import { useSumarije } from "@/hooks/useSumarije";

type SortKey = "ime" | "prijava" | "online";

const th = "text-left px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300";
const punoVrijeme = (iso?: string) => (iso ? new Date(iso).toLocaleString("bs-BA", { dateStyle: "medium", timeStyle: "short" }) : "");

function vrijednost(k: Korisnik, key: SortKey): string {
  if (key === "ime") return k.fullName || k.ime;
  return (key === "prijava" ? k.lastLoginAt : k.lastOnlineAt) ?? "";
}

/**
 * Kad su se korisnici svih šumarija zadnji put prijavili. Samo za vodećeg projektanta PG Bosanska Krupa
 * (poziva se isključivo uz provjeru vidiZadnjuPrijavu); Šef sektora i ostali ovo ne vide.
 */
export function ZadnjePrijave() {
  const sumarije = useSumarije();
  const [korisnici, setKorisnici] = useState<Korisnik[] | null>(null);
  const [greska, setGreska] = useState(false);
  const [trazi, setTrazi] = useState("");
  const [arhivirani, setArhivirani] = useState(false);
  const [sort, setSort] = useState<SortStanje<SortKey>>({ key: "prijava", dir: "desc" });

  useEffect(() => {
    let otkazano = false;
    getSviKorisnici()
      .then((k) => { if (!otkazano) setKorisnici(k); })
      .catch(() => { if (!otkazano) setGreska(true); });
    return () => { otkazano = true; };
  }, []);

  const grupe = useMemo(() => {
    const t = trazi.trim().toLowerCase();
    const prikaz = (korisnici ?? []).filter((k) =>
      !jeSuperAdmin(k) && (arhivirani || !k.arhiviran) &&
      (!t || k.ime.toLowerCase().includes(t) || (k.fullName ?? "").toLowerCase().includes(t)));
    return grupisiPoSumarijama(prikaz, sumarije).filter((g) => g.vodeci.length + g.radnici.length > 0);
  }, [korisnici, sumarije, trazi, arhivirani]);

  if (greska) return <p className="py-10 text-center text-sm text-red-600 dark:text-red-400">Greška pri učitavanju korisnika. Provjeri internet.</p>;
  if (!korisnici) return <p className="py-10 text-center text-sm text-gray-400">Učitavam…</p>;

  const celija = (iso?: string) => (
    <td className="px-3 py-2 text-xs whitespace-nowrap tabular-nums" title={punoVrijeme(iso)}>
      {iso ? <span className="text-gray-700 dark:text-gray-200">{fmtLastOnline(iso)}</span> : <span className="text-gray-400 dark:text-gray-500">nikad</span>}
    </td>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200">Zadnje prijave korisnika</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Sve šumarije; ovaj pregled vidi samo vodeći projektant PG Bosanska Krupa.</p>
        </div>
        <label htmlFor="prijave-trazi" className="sr-only">Pretraga korisnika</label>
        <input id="prijave-trazi" type="search" value={trazi} onChange={(e) => setTrazi(e.target.value)} placeholder="Traži korisnika…"
          className="w-56 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={arhivirani} onChange={(e) => setArhivirani(e.target.checked)} /> Arhivirani
        </label>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <tr>
                <SortTh label="Korisnik" col="ime" tekst stanje={sort} onChange={setSort} className={th} />
                <th className={th}>Korisničko ime</th>
                <th className={th}>Uloga</th>
                <SortTh label="Zadnja prijava" col="prijava" stanje={sort} onChange={setSort} className={th} />
                <SortTh label="Zadnje online" col="online" stanje={sort} onChange={setSort} className={th} />
              </tr>
            </thead>
            {grupe.map(({ sumarija, vodeci, radnici }: { sumarija: Sumarija; vodeci: Korisnik[]; radnici: Korisnik[] }) => (
              <tbody key={sumarija.id}>
                <tr className="border-t-2 border-green-700/30 bg-green-100/70 dark:bg-green-950/50">
                  <th colSpan={5} scope="colgroup" className="px-3 py-2 text-left text-sm font-bold text-green-900 dark:text-green-200">
                    {sumarija.naziv}
                    <span className="ml-3 text-xs font-normal text-green-800/80 dark:text-green-300/70">{vodeci.length + radnici.length} korisnika</span>
                  </th>
                </tr>
                {[...vodeci.sort((a, b) => vrijednost(a, "ime").localeCompare(vrijednost(b, "ime"), "bs")), ...sortiraj(radnici, sort, vrijednost)].map((k) => {
                  const jeVodeci = k.role === "admin";
                  return (
                    <tr key={k.id} className={`border-t border-gray-100 dark:border-gray-800 ${k.arhiviran ? "opacity-60" : ""} ${jeVodeci ? "bg-green-50/70 dark:bg-green-950/30" : ""}`}>
                      <td className={`px-3 py-2 font-medium text-gray-800 dark:text-gray-100 border-l-4 ${jeVodeci ? "border-green-600" : "border-transparent"}`}>
                        {k.fullName || "–"}{k.arhiviran && <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">arhiviran</span>}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{k.ime}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-200">{ulogaLabel(k, sumarije, true)}</td>
                      {celija(k.lastLoginAt)}
                      {celija(k.lastOnlineAt)}
                    </tr>
                  );
                })}
              </tbody>
            ))}
            {grupe.length === 0 && <tbody><tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Nema korisnika za prikaz.</td></tr></tbody>}
          </table>
        </div>
      </div>
    </div>
  );
}
