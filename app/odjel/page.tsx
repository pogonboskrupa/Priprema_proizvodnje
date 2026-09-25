"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getOdjelPregled, type OdjelPregledData } from "@/lib/db";
import { statistikaOdjela, godineRada, type Faza } from "@/lib/odjel-pregled";
import { fmtBroj, ucinakLabel, unioDrugi, DANI_KRATKO } from "@/lib/sihtarica";
import { UnioOtkrij } from "@/components/UnioOtkrij";
import { fmtDate, fmtDateLong, monthYearLabel } from "@/lib/format";
import { VRSTA, vrsta as vrstaStyle } from "@/lib/vrste";
import { useUnosiRefresh } from "@/hooks/useUnosiRefresh";

export default function OdjelPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-gray-400">Učitavam odjel…</div>}>
      <OdjelPregled />
    </Suspense>
  );
}

type Godina = number | "sve";

function OdjelPregled() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";

  const [data, setData] = useState<OdjelPregledData | null>(null);
  const [err, setErr] = useState("");
  const [izbor, setIzbor] = useState<Godina | null>(null);
  const [sviDnevnik, setSviDnevnik] = useState(false);

  useEffect(() => {
    if (!authLoading && !session) router.replace("/login/");
  }, [session, authLoading]);

  const load = useCallback(() => {
    if (!id) return;
    getOdjelPregled(id)
      .then((d) => { setData(d); setErr(""); })
      .catch(() => setErr("Greška pri učitavanju odjela. Provjeri internet i pokušaj ponovo."));
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useUnosiRefresh(load);

  const godine = useMemo(() => godineRada(data?.unosi ?? []), [data]);
  const tekuca = new Date().getFullYear();
  const godina: Godina = izbor ?? (godine.includes(tekuca) ? tekuca : "sve");
  const unosi = useMemo(() => {
    const rad = (data?.unosi ?? []).filter((u) => u.vrsta === "DOZNAKA" || u.vrsta === "VLAKA");
    return godina === "sve" ? rad : rad.filter((u) => u.datum.startsWith(String(godina)));
  }, [data, godina]);
  const povrsina = Number(data?.odjel?.povrsina) || 0;
  const st = useMemo(() => statistikaOdjela(unosi, povrsina), [unosi, povrsina]);

  if (authLoading || !session) return null;
  if (!id) return <Poruka tekst="Odjel nije odabran." />;
  if (err && !data) return <Poruka tekst={err} />;
  if (!data) return <div className="py-16 text-center text-sm text-gray-400">Učitavam odjel…</div>;

  const o = data.odjel;
  const naziv = o ? `${o.gj} / ${o.broj}` : "Nepoznat odjel";
  const dnevnik = [...unosi].reverse();
  const prikazaniDnevnik = sviDnevnik ? dnevnik : dnevnik.slice(0, 20);

  async function exportExcel() {
    const { exportXlsx } = await import("@/lib/export");
    exportXlsx(dnevnik.map((u) => ({
      Datum: fmtDate(u.datum),
      Projektant: u.korisnik ? (u.korisnik.fullName || u.korisnik.ime) : "",
      Vrsta: VRSTA[u.vrsta]?.label ?? u.vrsta,
      Stabala: u.brojStabala ?? "",
      "Hektari (ha)": u.hektari ?? "",
      "Vlake (km)": u.kilometri ?? "",
      Napomena: u.napomena ?? "",
      Unio: unioDrugi(u)?.puno ?? "",
    })), `Odjel_${naziv.replace(/[^\w-]+/g, "_")}_${godina}`);
  }

  const chip = (active: boolean) => `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
    active ? "bg-green-700 text-white" : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
  }`;

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => (history.length > 1 ? router.back() : router.push("/"))}
        className="text-sm text-gray-500 dark:text-gray-400 hover:text-green-700 dark:hover:text-green-400 print:hidden">
        ‹ Nazad
      </button>

      <header className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="mr-auto min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-green-700 dark:text-green-400">Pregled odjela</p>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{naziv}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>Površina <b className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{povrsina ? `${fmtBroj(povrsina)} ha` : "nije upisana"}</b></span>
            <StatusPill gotovo={!!o?.doznaceno} faza={st.doznaka.faza} gotovoTekst="Doznaka završena" uTokuTekst="Doznaka u toku" nijeTekst="Doznaka nije počela" />
            <StatusPill gotovo={!!o?.vlakeProjektovane} faza={st.vlaka.faza} gotovoTekst="Vlake projektovane" uTokuTekst="Vlake u toku" nijeTekst="Vlake nisu počele" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 print:hidden">
          {godine.map((g) => (
            <button key={g} type="button" className={chip(godina === g)} onClick={() => setIzbor(g)}>{g}</button>
          ))}
          {godine.length > 1 && <button type="button" className={chip(godina === "sve")} onClick={() => setIzbor("sve")}>Sve</button>}
          {unosi.length > 0 && <button type="button" className={chip(false)} onClick={exportExcel}>Excel</button>}
        </div>
      </header>

      {err && <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">{err} Prikazani su zadnji učitani podaci.</div>}

      {unosi.length === 0 ? (
        <Poruka tekst={godina === "sve" ? "U ovom odjelu još nema upisane doznake ni vlaka." : `U ${godina}. nema upisane doznake ni vlaka.`} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <FazaKartica
              naslov="Doznaka"
              boja={VRSTA.DOZNAKA}
              faza={st.doznaka.faza}
              zavrseno={!!o?.doznaceno}
              brojke={[
                { label: "Stabala", value: fmtBroj(st.doznaka.stabala, 0), unit: "st." },
                { label: "Površina", value: fmtBroj(st.doznaka.ha), unit: "ha" },
              ]}
              prosjeci={[
                { label: "ha po radnom danu", value: fmtBroj(st.doznaka.haPoDanu) },
                { label: "stabala po radnom danu", value: fmtBroj(st.doznaka.stabalaPoDanu, 0) },
                { label: "stabala po ha", value: fmtBroj(st.doznaka.stabalaPoHa, 0) },
              ]}
            >
              {st.doznaka.pokrivenost !== null && st.doznaka.faza && (
                <Pokrivenost udio={st.doznaka.pokrivenost} ha={st.doznaka.ha} povrsina={povrsina} />
              )}
            </FazaKartica>
            <FazaKartica
              naslov="Vlake"
              boja={VRSTA.VLAKA}
              faza={st.vlaka.faza}
              zavrseno={!!o?.vlakeProjektovane}
              brojke={[{ label: "Dužina", value: fmtBroj(st.vlaka.km), unit: "km" }]}
              prosjeci={[{ label: "km po radnom danu", value: fmtBroj(st.vlaka.kmPoDanu) }]}
            />
          </div>

          <Sekcija naslov="Ko je šta radio" meta={`${st.projektanti.length} ${st.projektanti.length === 1 ? "projektant" : "projektanta"}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-gray-50 dark:bg-gray-800 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="text-left font-semibold px-4 py-2.5">Projektant</th>
                    <th className="text-right font-semibold px-3 py-2.5">Doz. dana</th>
                    <th className="text-right font-semibold px-3 py-2.5">Stabala</th>
                    <th className="text-right font-semibold px-3 py-2.5">ha</th>
                    <th className="text-left font-semibold px-3 py-2.5 w-36">Udio u doznaci</th>
                    <th className="text-right font-semibold px-3 py-2.5">Vl. dana</th>
                    <th className="text-right font-semibold px-3 py-2.5">km</th>
                    <th className="text-left font-semibold px-4 py-2.5">Period rada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 tabular-nums">
                  {st.projektanti.map((p) => {
                    const udio = st.doznaka.ha > 0 ? p.doznaka.ha / st.doznaka.ha : 0;
                    const period = racunajPeriod(p.doznaka.faza, p.vlaka.faza);
                    return (
                      <tr key={p.id}>
                        <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-100">{p.ime}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-300">{p.doznaka.dana || "–"}</td>
                        <td className="px-3 py-2.5 text-right text-gray-800 dark:text-gray-100">{p.doznaka.stabala ? fmtBroj(p.doznaka.stabala, 0) : "–"}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-gray-800 dark:text-gray-100">{p.doznaka.ha ? fmtBroj(p.doznaka.ha) : "–"}</td>
                        <td className="px-3 py-2.5">
                          {udio > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                <div className="h-full rounded-full bg-green-600" style={{ width: `${Math.max(3, udio * 100)}%` }} />
                              </div>
                              <span className="w-9 text-right text-xs text-gray-500 dark:text-gray-400">{Math.round(udio * 100)}%</span>
                            </div>
                          ) : <span className="text-gray-400">–</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-300">{p.vlaka.dana || "–"}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-gray-800 dark:text-gray-100">{p.vlaka.km ? fmtBroj(p.vlaka.km) : "–"}</td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">{period}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Sekcija>

          {st.poMjesecima.length > 1 && (
            <Sekcija naslov="Po mjesecima">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[420px]">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="text-left font-semibold px-4 py-2.5">Mjesec</th>
                      <th className="text-right font-semibold px-3 py-2.5">Stabala</th>
                      <th className="text-right font-semibold px-3 py-2.5">ha</th>
                      <th className="text-right font-semibold px-4 py-2.5">km</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 tabular-nums">
                    {st.poMjesecima.map((m) => (
                      <tr key={m.mjesec}>
                        <td className="px-4 py-2.5 capitalize text-gray-800 dark:text-gray-100">{monthYearLabel(Number(m.mjesec.slice(0, 4)), Number(m.mjesec.slice(5, 7)))}</td>
                        <td className="px-3 py-2.5 text-right">{m.stabala ? fmtBroj(m.stabala, 0) : "–"}</td>
                        <td className="px-3 py-2.5 text-right">{m.ha ? fmtBroj(m.ha) : "–"}</td>
                        <td className="px-4 py-2.5 text-right">{m.km ? fmtBroj(m.km) : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Sekcija>
          )}

          <Sekcija naslov="Dnevnik rada" meta={`${dnevnik.length} ${dnevnik.length === 1 ? "unos" : "unosa"}`}>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {prikazaniDnevnik.map((u) => {
                const vs = vrstaStyle(u.vrsta);
                const unio = unioDrugi(u);
                return (
                  <li key={u.id} className="px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="w-28 flex-shrink-0 tabular-nums text-gray-500 dark:text-gray-400">{danIDatum(u.datum)}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border-l-[3px] ${vs.borderL} ${vs.badge}`}>{vs.label}</span>
                    <span className="font-medium text-gray-800 dark:text-gray-100">{u.korisnik ? (u.korisnik.fullName || u.korisnik.ime) : "Nepoznat projektant"}</span>
                    <span className="ml-auto tabular-nums text-gray-700 dark:text-gray-200">{ucinakLabel(u) || "–"}</span>
                    {(u.napomena || unio) && (
                      <span className="basis-full sm:basis-auto text-xs text-gray-400 dark:text-gray-500 sm:order-last sm:w-full sm:pl-[7.75rem]">
                        {u.napomena && <span className="italic">„{u.napomena}“</span>}
                        {u.napomena && unio && " · "}
                        {unio && <UnioOtkrij>unio {unio.puno}</UnioOtkrij>}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            {dnevnik.length > prikazaniDnevnik.length && (
              <button type="button" onClick={() => setSviDnevnik(true)}
                className="w-full px-4 py-2.5 text-sm font-medium text-green-700 dark:text-green-400 hover:bg-gray-50 dark:hover:bg-gray-800 border-t border-gray-100 dark:border-gray-800">
                Prikaži sve ({dnevnik.length})
              </button>
            )}
          </Sekcija>
        </>
      )}

      {session.role === "admin" && (
        <p className="text-xs text-gray-400 dark:text-gray-500 print:hidden">
          Status „završena/projektovane“ se označava u <Link href="/odjeli" className="underline hover:text-green-700">Odjelima</Link>.
        </p>
      )}
    </div>
  );
}

function danIDatum(datum: string): string {
  const [y, m, d] = datum.slice(0, 10).split("-").map(Number);
  return `${DANI_KRATKO[new Date(y, m - 1, d).getDay()]} ${fmtDate(datum)}`;
}

function racunajPeriod(a: Faza | null, b: Faza | null): string {
  const svi = [a, b].filter((f): f is Faza => !!f);
  if (!svi.length) return "–";
  const od = svi.map((f) => f.od).sort()[0];
  const do_ = svi.map((f) => f.do_).sort().at(-1)!;
  return od === do_ ? fmtDate(od) : `${fmtDate(od).slice(0, 6)} – ${fmtDate(do_)}`;
}

function StatusPill({ gotovo, faza, gotovoTekst, uTokuTekst, nijeTekst }: {
  gotovo: boolean; faza: Faza | null; gotovoTekst: string; uTokuTekst: string; nijeTekst: string;
}) {
  const [cls, tekst] = gotovo
    ? ["bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200", `✓ ${gotovoTekst}`]
    : faza
    ? ["bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200", uTokuTekst]
    : ["bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400", nijeTekst];
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{tekst}</span>;
}

function FazaKartica({ naslov, boja, faza, zavrseno, brojke, prosjeci, children }: {
  naslov: string;
  boja: { dot: string };
  faza: Faza | null;
  zavrseno: boolean;
  brojke: { label: string; value: string; unit: string }[];
  prosjeci: { label: string; value: string }[];
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col gap-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
        <span className={`w-2.5 h-2.5 rounded-full ${boja.dot}`} aria-hidden />{naslov}
      </h2>

      {faza ? (
        <>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Početak</div>
              <div className="font-semibold tabular-nums text-gray-800 dark:text-gray-100">{fmtDate(faza.od)}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500 first-letter:uppercase">{fmtDateLong(faza.od).split(",")[0]}</div>
            </div>
            <div className="flex flex-col items-center text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
              <span className="tabular-nums">{faza.trajanje} {faza.trajanje === 1 ? "dan" : "dana"}</span>
              <span className="block w-16 h-px bg-gray-300 dark:bg-gray-700 my-1" aria-hidden />
              <span className="tabular-nums">rad {faza.radnihDana} {faza.radnihDana === 1 ? "dan" : "dana"}</span>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{zavrseno ? "Završeno" : "Zadnji dan rada"}</div>
              <div className="font-semibold tabular-nums text-gray-800 dark:text-gray-100">{fmtDate(faza.do_)}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500 first-letter:uppercase">{fmtDateLong(faza.do_).split(",")[0]}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-2">
            {brojke.map((b) => (
              <div key={b.label}>
                <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{b.label}</div>
                <div className="text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-50">
                  {b.value}<span className="ml-1 text-base font-medium text-gray-400 dark:text-gray-500">{b.unit}</span>
                </div>
              </div>
            ))}
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
            {prosjeci.map((p) => (
              <div key={p.label}>
                <dt className="text-[11px] text-gray-500 dark:text-gray-400">Prosjek · {p.label}</dt>
                <dd className="font-semibold tabular-nums text-gray-800 dark:text-gray-100">{p.value}</dd>
              </div>
            ))}
          </dl>
          {children}
        </>
      ) : (
        <p className="text-sm text-gray-400 dark:text-gray-500">Nema upisanog rada u ovom periodu.</p>
      )}
    </section>
  );
}

function Pokrivenost({ udio, ha, povrsina }: { udio: number; ha: number; povrsina: number }) {
  const pct = Math.round(udio * 100);
  const preko = udio > 1;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
        <span>Doznačeno od površine odjela</span>
        <span className="tabular-nums"><b className="text-sm text-gray-800 dark:text-gray-100">{pct}%</b> · {fmtBroj(ha)} od {fmtBroj(povrsina)} ha</span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Doznačeno od površine odjela">
        <div className={`h-full rounded-full ${preko ? "bg-red-500" : "bg-green-600"}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      {preko && <p className="mt-1 text-xs text-red-600 dark:text-red-400">Doznačeno više od površine odjela — provjeri unose ili površinu.</p>}
    </div>
  );
}

function Sekcija({ naslov, meta, children }: { naslov: string; meta?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      <h2 className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-baseline gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
        {naslov}
        {meta && <span className="text-xs font-normal text-gray-400 dark:text-gray-500">{meta}</span>}
      </h2>
      {children}
    </section>
  );
}

function Poruka({ tekst }: { tekst: string }) {
  return <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 py-12 text-center text-sm text-gray-500 dark:text-gray-400">{tekst}</div>;
}
