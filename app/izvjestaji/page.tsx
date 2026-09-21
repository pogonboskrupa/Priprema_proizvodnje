"use client";
import { useEffect, useState } from "react";
import { getIzvjestaj } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { exportXlsx } from "@/lib/export";

type Period = "sedmicno" | "mjesecno" | "godisnje";
type Tip = "odjel" | "inzinjer";

type OdjelRow = {
  odjel: { id: unknown; naziv: string; broj: string; povrsina: number };
  ukupnoHektara: number;
  ukupnoStabala: number;
  ukupnoKm: number;
  preostalo: number;
  postotak: number;
  brojUnosa: number;
};

type InzinjerRow = {
  inzinjer: { id: unknown; ime: string; prezime: string; odjel: { naziv: string; broj: string } };
  ukupnoHektara: number;
  ukupnoStabala: number;
  ukupnoKm: number;
  danaGodisnji: number;
  danaKancelarija: number;
  danaBolovanje: number;
  brojUnosa: number;
};

type IzvjestajData = {
  period: Period;
  od: string;
  do_?: string;
  tip: Tip;
  data: OdjelRow[] | InzinjerRow[];
};

export default function IzvjestajiPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("mjesecno");
  const [tip, setTip] = useState<Tip>("odjel");
  const [data, setData] = useState<IzvjestajData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !session) router.replace("/login/");
  }, [session, authLoading]);

  async function load(p: Period = period, t: Tip = tip) {
    setLoading(true);
    const json = await getIzvjestaj(p, t);
    setData(json as IzvjestajData);
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading || !session) return null;

  function handlePeriod(p: Period) {
    setPeriod(p);
    load(p, tip);
  }

  function handleTip(t: Tip) {
    setTip(t);
    load(period, t);
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("bs-BA", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Izvještaji</h1>

      <div className="bg-white rounded-xl border p-4 mb-6 flex flex-wrap gap-4">
        <div>
          <span className="block text-xs text-gray-500 mb-1 font-medium">Period</span>
          <div className="flex gap-2">
            {(["sedmicno", "mjesecno", "godisnje"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  period === p
                    ? "bg-green-700 text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                {p === "sedmicno" ? "Sedmično" : p === "mjesecno" ? "Mjesečno" : "Godišnje"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="block text-xs text-gray-500 mb-1 font-medium">Grupiranje</span>
          <div className="flex gap-2">
            {(["odjel", "inzinjer"] as Tip[]).map((t) => (
              <button
                key={t}
                onClick={() => handleTip(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tip === t
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                {t === "odjel" ? "🗺️ Po odjelu" : "👷 Po inžinjeru"}
              </button>
            ))}
          </div>
        </div>

        {data && (
          <div className="ml-auto flex items-end">
            <span className="text-xs text-gray-500">
              Period: {formatDate(data.od)} – {data.do_ ? formatDate(data.do_) : ""}
            </span>
          </div>
        )}
      </div>

      {loading && <div className="text-center py-16 text-gray-500">Učitavam...</div>}

      {!loading && data?.tip === "odjel" && (
        <OdjelIzvjestaj rows={data.data as OdjelRow[]} period={data.period} />
      )}

      {!loading && data?.tip === "inzinjer" && (
        <InzinjerIzvjestaj rows={data.data as InzinjerRow[]} period={data.period} />
      )}
    </div>
  );
}

function OdjelIzvjestaj({ rows, period }: { rows: OdjelRow[]; period: Period }) {
  const ukupnoHa = rows.reduce((s, r) => s + r.ukupnoHektara, 0);
  const ukupnoSt = rows.reduce((s, r) => s + r.ukupnoStabala, 0);
  const ukupnoKm = rows.reduce((s, r) => s + r.ukupnoKm, 0);
  const ukupnoPovrsina = rows.reduce((s, r) => s + r.odjel.povrsina, 0);
  const aktivni = rows.filter((r) => r.ukupnoHektara > 0 || r.ukupnoKm > 0);

  function handleExport() {
    const data = rows.map((r) => ({
      Odjel: r.odjel.broj,
      Naziv: r.odjel.naziv,
      "Površina (ha)": r.odjel.povrsina,
      "Obrađeno (ha)": r.ukupnoHektara,
      "Preostalo (ha)": r.preostalo,
      Stabala: r.ukupnoStabala,
      "Vlake (km)": r.ukupnoKm,
      "Napredak (%)": r.postotak,
    }));
    exportXlsx(data, `izvjestaj-odjeli-${period}`);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Ukupno obrađeno" value={`${ukupnoHa.toFixed(2)} ha`} color="green" />
        <StatCard label="Ukupna površina" value={`${ukupnoPovrsina.toFixed(2)} ha`} color="blue" />
        <StatCard label="Doznačenih stabala" value={ukupnoSt.toString()} color="emerald" />
        <StatCard label="Vlake projektovano" value={`${ukupnoKm.toFixed(2)} km`} color="amber" />
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50 flex justify-between items-center">
          <h2 className="font-semibold text-gray-700">Pregled po odjelima</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{aktivni.length} odjela sa aktivnošću</span>
            <button onClick={handleExport} className="bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-800">
              Export XLSX
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left">
                <th className="px-4 py-3 text-gray-600 font-medium">Odjel</th>
                <th className="px-4 py-3 text-gray-600 font-medium text-right">Površina (ha)</th>
                <th className="px-4 py-3 text-gray-600 font-medium text-right">Obrađeno (ha)</th>
                <th className="px-4 py-3 text-gray-600 font-medium text-right">Preostalo (ha)</th>
                <th className="px-4 py-3 text-gray-600 font-medium text-right">Stabala</th>
                <th className="px-4 py-3 text-gray-600 font-medium text-right">Vlake (km)</th>
                <th className="px-4 py-3 text-gray-600 font-medium">Napredak</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium">{r.odjel.broj}</span>
                    <span className="text-gray-500 ml-2 text-xs">{r.odjel.naziv}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{r.odjel.povrsina.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">
                    {r.ukupnoHektara.toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${r.preostalo <= 0 ? "text-green-600" : "text-gray-700"}`}>
                    {r.preostalo <= 0 ? "✓ Završeno" : r.preostalo.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">{r.ukupnoStabala > 0 ? r.ukupnoStabala : "–"}</td>
                  <td className="px-4 py-3 text-right">{r.ukupnoKm > 0 ? r.ukupnoKm.toFixed(2) : "–"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5 min-w-[80px]">
                        <div
                          className={`h-1.5 rounded-full ${r.postotak >= 100 ? "bg-green-500" : r.postotak >= 50 ? "bg-amber-500" : "bg-blue-500"}`}
                          style={{ width: `${Math.min(r.postotak, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-10 text-right">{r.postotak}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InzinjerIzvjestaj({ rows, period }: { rows: InzinjerRow[]; period: Period }) {
  const aktivni = rows.filter((r) => r.ukupnoHektara > 0 || r.ukupnoKm > 0 || r.ukupnoStabala > 0);
  const ukupnoHa = rows.reduce((s, r) => s + r.ukupnoHektara, 0);
  const ukupnoSt = rows.reduce((s, r) => s + r.ukupnoStabala, 0);
  const ukupnoKm = rows.reduce((s, r) => s + r.ukupnoKm, 0);
  const ukupnoOdsustvo = rows.reduce((s, r) => s + (r.danaGodisnji ?? 0) + (r.danaKancelarija ?? 0) + (r.danaBolovanje ?? 0), 0);

  function handleExport() {
    const data = rows.map((r) => ({
      Inžinjer: `${r.inzinjer.prezime} ${r.inzinjer.ime}`,
      Odjel: r.inzinjer.odjel.broj,
      "Hektara (ha)": r.ukupnoHektara,
      Stabala: r.ukupnoStabala,
      "Vlake (km)": r.ukupnoKm,
      "God. odmor": r.danaGodisnji ?? 0,
      Kancelarija: r.danaKancelarija ?? 0,
      Bolovanje: r.danaBolovanje ?? 0,
      "Ukupno unosa": r.brojUnosa,
    }));
    exportXlsx(data, `izvjestaj-inzinjeri-${period}`);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Ukupno obrađeno" value={`${ukupnoHa.toFixed(2)} ha`} color="green" />
        <StatCard label="Doznačenih stabala" value={ukupnoSt.toString()} color="emerald" />
        <StatCard label="Vlake projektovano" value={`${ukupnoKm.toFixed(2)} km`} color="amber" />
        <StatCard label="Dana odsustva" value={ukupnoOdsustvo.toString()} color="blue" />
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50 flex justify-between items-center">
          <h2 className="font-semibold text-gray-700">Pregled po inžinjerima</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{aktivni.length} inžinjera sa aktivnošću</span>
            <button onClick={handleExport} className="bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-800">
              Export XLSX
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left">
                <th className="px-4 py-3 text-gray-600 font-medium">Inžinjer</th>
                <th className="px-4 py-3 text-gray-600 font-medium">Odjel</th>
                <th className="px-4 py-3 text-gray-600 font-medium text-right">Hektara (ha)</th>
                <th className="px-4 py-3 text-gray-600 font-medium text-right">Stabala</th>
                <th className="px-4 py-3 text-gray-600 font-medium text-right">Vlake (km)</th>
                <th className="px-4 py-3 text-gray-600 font-medium text-right">God.</th>
                <th className="px-4 py-3 text-gray-600 font-medium text-right">Kanc.</th>
                <th className="px-4 py-3 text-gray-600 font-medium text-right">Bol.</th>
                <th className="px-4 py-3 text-gray-600 font-medium text-right">Unosa</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr
                  key={idx}
                  className={`border-t hover:bg-gray-50 ${r.brojUnosa === 0 ? "opacity-40" : ""}`}
                >
                  <td className="px-4 py-3 font-medium">
                    {r.inzinjer.prezime} {r.inzinjer.ime}
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                      {r.inzinjer.odjel.broj}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">
                    {r.ukupnoHektara > 0 ? r.ukupnoHektara.toFixed(2) : "–"}
                  </td>
                  <td className="px-4 py-3 text-right">{r.ukupnoStabala > 0 ? r.ukupnoStabala : "–"}</td>
                  <td className="px-4 py-3 text-right">{r.ukupnoKm > 0 ? r.ukupnoKm.toFixed(2) : "–"}</td>
                  <td className="px-4 py-3 text-right text-sky-600">{(r.danaGodisnji ?? 0) > 0 ? r.danaGodisnji : "–"}</td>
                  <td className="px-4 py-3 text-right text-violet-600">{(r.danaKancelarija ?? 0) > 0 ? r.danaKancelarija : "–"}</td>
                  <td className="px-4 py-3 text-right text-red-500">{(r.danaBolovanje ?? 0) > 0 ? r.danaBolovanje : "–"}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{r.brojUnosa}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "green" | "blue" | "emerald" | "amber";
}) {
  const colors = {
    green: "bg-green-50 border-green-200 text-green-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-xs font-medium opacity-80 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
