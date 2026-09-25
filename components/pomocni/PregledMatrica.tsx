"use client";
import type { PomocniRadnik, VrstaPomocnog } from "@/lib/types";
import { POMOCNI, VRSTE_POMOCNI, rezimeSihte, punoIme, type DaniSihte, type DanMjeseca } from "@/lib/pomocni";
import { useCetkaPotez, type Cetka } from "./Cetka";

const DOW = ["P", "U", "S", "Č", "P", "S", "N"];

interface Props {
  radnici: PomocniRadnik[];
  kalendar: DanMjeseca[];
  sihte: Record<string, DaniSihte>;
  danas: string;
  cetka: Cetka;
  disabled: boolean;
  projektantIme: (id: string | null | undefined) => string | null;
  onPostavi: (radnikId: string, dan: number, v: VrstaPomocnog | null) => void;
  onOtvori: (radnikId: string) => void;
}

export function PregledMatrica({ radnici, kalendar, sihte, danas, cetka, disabled, projektantIme, onPostavi, onOtvori }: Props) {
  const potez = useCetkaPotez<[string, number]>(cetka, ([id, dan], v) => onPostavi(id, dan, v));

  const colTone = (d: DanMjeseca) =>
    d.datum === danas ? "bg-green-50 dark:bg-green-950/40"
    : d.praznik ? "bg-rose-50/70 dark:bg-rose-950/25"
    : d.vikend ? "bg-gray-50 dark:bg-gray-800/50" : "";

  const naTerenu = kalendar.map((d) => radnici.filter((r) => sihte[r.id]?.[String(d.dan)] === "TEREN").length);
  const stickyCell = "sticky left-0 z-10 bg-white dark:bg-gray-900 border-r border-r-gray-200 dark:border-r-gray-700";

  return (
    <div className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-x-auto select-none ${disabled ? "opacity-60 pointer-events-none" : ""}`}>
      <table className="border-separate border-spacing-0 text-xs tabular-nums">
        <thead>
          <tr>
            <th scope="col" className={`${stickyCell} z-20 min-w-[8.5rem] max-w-[8.5rem] sm:min-w-[11.5rem] sm:max-w-none px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-b-gray-200 dark:border-b-gray-700`}>
              Radnik
            </th>
            {kalendar.map((d) => (
              <th key={d.dan} scope="col" title={d.praznik ?? undefined}
                className={`w-7 min-w-[1.75rem] px-0 py-1.5 text-center font-normal border-b border-gray-200 dark:border-gray-700 ${colTone(d)}`}>
                <span className={`block text-[9px] leading-none ${d.vikend || d.praznik ? "text-rose-500 dark:text-rose-400" : "text-gray-400 dark:text-gray-500"}`}>{DOW[d.dow]}</span>
                <span className={`block mt-1 text-[11px] leading-none ${d.datum === danas ? "font-bold text-green-700 dark:text-green-400" : "font-semibold text-gray-700 dark:text-gray-300"}`}>{d.dan}</span>
              </th>
            ))}
            {VRSTE_POMOCNI.map((v, i) => (
              <th key={v} scope="col" title={POMOCNI[v].label}
                className={`w-8 min-w-[2rem] px-1 py-1.5 text-center text-[11px] font-semibold border-b border-gray-200 dark:border-gray-700 ${POMOCNI[v].text} ${i === 0 ? "border-l" : ""}`}>
                {POMOCNI[v].kod}
              </th>
            ))}
            <th scope="col" title="Ukupno upisanih dana" className="w-10 min-w-[2.5rem] px-1.5 py-1.5 text-center text-[11px] font-semibold text-gray-700 dark:text-gray-200 border-b border-l border-gray-200 dark:border-gray-700">
              Σ
            </th>
          </tr>
        </thead>
        <tbody>
          {radnici.map((r) => {
            const dani = sihte[r.id] ?? {};
            const rez = rezimeSihte(dani, kalendar, danas);
            const proj = projektantIme(r.projektantId);
            return (
              <tr key={r.id} className="group">
                <th scope="row" className={`${stickyCell} max-w-[8.5rem] sm:max-w-none px-3 py-1 text-left font-normal border-b border-b-gray-100 dark:border-b-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-800`}>
                  <button type="button" onClick={() => onOtvori(r.id)} className="block w-full text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600">
                    <span className="block text-[13px] font-semibold text-gray-800 dark:text-gray-100 truncate hover:underline">{punoIme(r)}</span>
                    <span className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500 truncate">
                      {proj ?? "bez projektanta"}
                      {rez.nepopunjeno > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-medium" title="Radni dani bez upisa">· {rez.nepopunjeno} praznih</span>
                      )}
                    </span>
                  </button>
                </th>
                {kalendar.map((d) => {
                  const v = dani[String(d.dan)];
                  const prazanRadni = !v && d.radni && d.datum <= danas;
                  return (
                    <td key={d.dan} className={`p-0.5 border-b border-gray-100 dark:border-gray-800 ${colTone(d)}`}>
                      <button type="button"
                        aria-label={`${punoIme(r)}, ${d.dan}. — ${v ? POMOCNI[v].label : "prazno"}`}
                        onPointerDown={(e) => potez.onPointerDown([r.id, d.dan], v, e)}
                        onPointerEnter={(e) => potez.onPointerEnter([r.id, d.dan], e)}
                        onClick={() => potez.onClick([r.id, d.dan], v)}
                        className={`w-6 h-7 mx-auto flex items-center justify-center rounded text-[10px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${
                          v ? POMOCNI[v].badge
                          : prazanRadni ? "border border-dashed border-amber-300 dark:border-amber-700/70 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}>
                        {v ? POMOCNI[v].kod : ""}
                      </button>
                    </td>
                  );
                })}
                {VRSTE_POMOCNI.map((v, i) => (
                  <td key={v} className={`px-1 text-center border-b border-gray-100 dark:border-gray-800 ${i === 0 ? "border-l border-l-gray-200 dark:border-l-gray-700" : ""} ${rez.po[v] ? "font-semibold text-gray-700 dark:text-gray-200" : "text-gray-300 dark:text-gray-600"}`}>
                    {rez.po[v] || "·"}
                  </td>
                ))}
                <td className="px-1.5 text-center font-bold text-gray-900 dark:text-gray-50 border-b border-l border-gray-100 border-l-gray-200 dark:border-gray-800 dark:border-l-gray-700">
                  {rez.ukupno || "–"}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 dark:bg-gray-800/60">
            <th scope="row" className={`${stickyCell} !bg-gray-50 dark:!bg-gray-800 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400`}>
              Na terenu
            </th>
            {naTerenu.map((n, i) => (
              <td key={i} className={`py-2 text-center text-[11px] ${n ? `font-bold ${POMOCNI.TEREN.text}` : "text-gray-300 dark:text-gray-600"}`}>
                {n || "·"}
              </td>
            ))}
            <td colSpan={VRSTE_POMOCNI.length + 1} className="border-l border-gray-200 dark:border-gray-700" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
