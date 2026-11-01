"use client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { getRadSvihSumarija } from "@/lib/db";
import { saberi, type RedSumarije, type Zbir } from "@/lib/po-sumarijama";
import { godineEvidencije, mjeseciEvidencije } from "@/lib/godine";
import { monthName } from "@/lib/format";
import { fmtBroj } from "@/lib/sihtarica";
import { kratkiNaziv } from "@/lib/sumarija";
import { exportXlsx, preuzmiFajl } from "@/lib/export";
import { useIzvjestajPostavke } from "@/hooks/useIzvjestajPostavke";
import { imeUIzvjestaju } from "@/lib/izvjestaj-postavke";
import { Icon } from "@/components/Icon";

type Period = "mjesec" | "godina";

const selectCls = "h-9 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm px-3 pr-8 focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer";
const segCls = (aktivan: boolean) =>
  `inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
    aktivan ? "bg-white dark:bg-gray-900 text-green-800 dark:text-green-300 shadow-sm" : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
  }`;
const dugme = "inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium";

const broj = (n: number, dec = 2) => (n > 0 ? fmtBroj(n, dec) : "–");

const KOLONE: readonly { naziv: string; vrijednost: (z: Zbir) => string }[] = [
  { naziv: "Radni dani", vrijednost: (z) => broj(z.radniDani, 0) },
  { naziv: "Teren", vrijednost: (z) => broj(z.teren, 0) },
  { naziv: "Kanc.", vrijednost: (z) => broj(z.kancelarija, 0) },
  { naziv: "GO", vrijednost: (z) => broj(z.godisnji, 0) },
  { naziv: "Bolov.", vrijednost: (z) => broj(z.bolovanje, 0) },
  { naziv: "Stabala", vrijednost: (z) => broj(z.stabala, 0) },
  { naziv: "ha", vrijednost: (z) => broj(z.ha) },
  { naziv: "km", vrijednost: (z) => broj(z.km) },
];

function izvoziRedove(redovi: readonly RedSumarije[]): Record<string, unknown>[] {
  const red = (sumarija: string, projektant: string, uloga: string, z: Zbir) => ({
    "Šumarija": sumarija, "Projektant": projektant, "Uloga": uloga,
    "Radni dani": z.radniDani, "Teren": z.teren, "Kancelarija": z.kancelarija, "Godišnji odmor": z.godisnji,
    "Bolovanje": z.bolovanje, "Stabala": z.stabala, "Hektara": Number(z.ha.toFixed(2)), "Kilometara": Number(z.km.toFixed(2)),
  });
  return [
    ...redovi.flatMap((r) => [
      ...r.projektanti.map((p) => red(r.sumarija.naziv, p.korisnik.fullName || p.korisnik.ime, p.korisnik.role === "admin" ? "Vodeći projektant" : "Projektant", p.zbir)),
      red(r.sumarija.naziv, "UKUPNO", "", r.zbir),
    ]),
    red("SVE ŠUMARIJE", "UKUPNO", "", saberi(redovi.map((r) => r.zbir))),
  ];
}

/** Pregled i izvoz zbirova po šumarijama (mjesečno i godišnje) — samo za Šefa sektora */
export function PoSumarijama() {
  const [mjeseci] = useState(mjeseciEvidencije);
  const [godine] = useState(() => godineEvidencije());
  const [period, setPeriod] = useState<Period>("mjesec");
  const [mjesec, setMjesec] = useState(() => mjeseciEvidencije()[0].value);
  const [godina, setGodina] = useState(() => godineEvidencije()[0]);
  const [redovi, setRedovi] = useState<RedSumarije[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [otvorene, setOtvorene] = useState<ReadonlySet<string>>(new Set());
  const [izvozi, setIzvozi] = useState(false);
  const genRef = useRef(0);
  const { postavke } = useIzvjestajPostavke();

  const opseg = useMemo(() => {
    if (period === "godina") return { od: new Date(godina, 0, 1), do_: new Date(godina, 11, 31, 23, 59, 59, 999) };
    const [g, m] = mjesec.split("-").map(Number);
    return { od: new Date(g, m - 1, 1), do_: new Date(g, m, 0, 23, 59, 59, 999) };
  }, [period, mjesec, godina]);

  useEffect(() => {
    const gen = ++genRef.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- učitavanje pri promjeni perioda
    setLoading(true);
    setErr("");
    getRadSvihSumarija(opseg.od, opseg.do_)
      .then((r) => { if (gen === genRef.current) setRedovi(r); })
      .catch(() => { if (gen === genRef.current) setErr("Greška pri učitavanju — provjeri internet i pokušaj ponovo."); })
      .finally(() => { if (gen === genRef.current) setLoading(false); });
  }, [opseg]);

  const ukupno = useMemo(() => saberi((redovi ?? []).map((r) => r.zbir)), [redovi]);
  const oznaka = period === "godina" ? `${godina}` : (mjeseci.find((m) => m.value === mjesec)?.label ?? mjesec);
  const imeFajla = period === "godina" ? `Po_sumarijama_${godina}` : `Po_sumarijama_${mjesec}`;

  function prebaci(id: string) {
    setOtvorene((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function izvezi(vrsta: "xlsx" | "docx") {
    if (!redovi) return;
    setIzvozi(true);
    try {
      if (vrsta === "xlsx") {
        await exportXlsx(izvoziRedove(redovi), imeFajla);
      } else {
        const { poSumarijamaDocx } = await import("@/lib/word-izvjestaj");
        const [g, m] = mjesec.split("-").map(Number);
        const blob = await poSumarijamaDocx({
          redovi, postavke, orijentacija: "landscape",
          naslov: period === "godina"
            ? ["ZBIRNI GODIŠNJI IZVJEŠTAJ O RADU PO ŠUMARIJAMA", `${godina}. GODINE`]
            : [`ZBIRNI MJESEČNI IZVJEŠTAJ O RADU PO ŠUMARIJAMA – ${monthName(m).toUpperCase()}`, `${g}. GODINE`],
        });
        preuzmiFajl(blob, `${imeFajla}.docx`);
      }
    } catch {
      setErr("Izvoz nije uspio — pokušaj ponovo.");
    } finally {
      setIzvozi(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 flex flex-wrap gap-4 items-end print:hidden">
        <div>
          <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">Period</span>
          <div className="inline-flex gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800">
            <button onClick={() => setPeriod("mjesec")} aria-pressed={period === "mjesec"} className={segCls(period === "mjesec")}>Mjesečno</button>
            <button onClick={() => setPeriod("godina")} aria-pressed={period === "godina"} className={segCls(period === "godina")}>Godišnje</button>
          </div>
        </div>
        <div>
          <label htmlFor="po-sum-period" className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">{period === "godina" ? "Godina" : "Mjesec"}</label>
          {period === "godina" ? (
            <select id="po-sum-period" value={godina} onChange={(e) => setGodina(Number(e.target.value))} className={selectCls}>
              {godine.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          ) : (
            <select id="po-sum-period" value={mjesec} onChange={(e) => setMjesec(e.target.value)} className={selectCls}>
              {mjeseci.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          )}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={() => izvezi("xlsx")} disabled={!redovi || izvozi} className={`${dugme} bg-green-700 text-white hover:bg-green-800 disabled:opacity-50`}>
            <Icon name="download" className="w-3.5 h-3.5" />Excel
          </button>
          <button onClick={() => izvezi("docx")} disabled={!redovi || izvozi} className={`${dugme} border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50`}>
            <Icon name="download" className="w-3.5 h-3.5" />Word
          </button>
        </div>
      </div>

      {err && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50 px-4 py-2.5 text-sm text-red-700 dark:text-red-300">{err}</div>}

      <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-opacity ${loading ? "opacity-60" : ""}`}>
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200">Ukupno po šumarijama — {oznaka}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-2.5 font-medium">Šumarija</th>
                <th className="px-3 py-2.5 font-medium text-right">Projektanata</th>
                {KOLONE.map((k) => <th key={k.naziv} className="px-3 py-2.5 font-medium text-right whitespace-nowrap">{k.naziv}</th>)}
              </tr>
            </thead>
            <tbody>
              {redovi === null && !err && (
                <tr><td colSpan={KOLONE.length + 2} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">Učitavanje…</td></tr>
              )}
              {(redovi ?? []).map((r) => {
                const sirenje = otvorene.has(r.sumarija.id);
                const imaPodataka = r.projektanti.length > 0;
                return (
                  <Fragment key={r.sumarija.id}>
                    <tr className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                        <button onClick={() => prebaci(r.sumarija.id)} aria-expanded={sirenje} disabled={!imaPodataka}
                          className="inline-flex items-center gap-2 text-left hover:text-green-700 dark:hover:text-green-400 disabled:cursor-default disabled:hover:text-inherit">
                          <span aria-hidden className={`inline-block text-gray-400 transition-transform ${sirenje ? "rotate-90" : ""} ${imaPodataka ? "" : "opacity-30"}`}>›</span>
                          {kratkiNaziv(r.sumarija.naziv)}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-300">{r.projektanti.length}</td>
                      {KOLONE.map((k) => <td key={k.naziv} className="px-3 py-2.5 text-right text-gray-800 dark:text-gray-200">{k.vrijednost(r.zbir)}</td>)}
                    </tr>
                    {sirenje && r.projektanti.map((p) => (
                      <tr key={p.korisnik.id} className="bg-gray-50/70 dark:bg-gray-800/40 text-gray-600 dark:text-gray-300">
                        <td className="pl-10 pr-4 py-2 whitespace-nowrap">
                          {imeUIzvjestaju(p.korisnik, postavke)}
                          {p.korisnik.role === "admin" && <span className="ml-2 text-[11px] font-medium text-green-700 dark:text-green-400">vodeći</span>}
                        </td>
                        <td />
                        {KOLONE.map((k) => <td key={k.naziv} className="px-3 py-2 text-right">{k.vrijednost(p.zbir)}</td>)}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
            {redovi && redovi.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 font-semibold text-gray-900 dark:text-gray-100">
                  <td className="px-4 py-2.5">Ukupno — sve šumarije</td>
                  <td className="px-3 py-2.5 text-right">{redovi.reduce((s, r) => s + r.projektanti.length, 0)}</td>
                  {KOLONE.map((k) => <td key={k.naziv} className="px-3 py-2.5 text-right">{k.vrijednost(ukupno)}</td>)}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Radni dani = teren, kancelarija, doznaka ili vlaka (dan s više unosa se broji jednom). Klikni na šumariju da vidiš projektante; vodeći projektant je prvi.
      </p>
    </div>
  );
}
