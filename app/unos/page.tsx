"use client";
import { useEffect, useState } from "react";
import { getOdjeli, getKorisnici, getUnosi, createUnos, deleteUnos } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { Odjel, Korisnik, UnosRada, VrstaRada } from "@/lib/types";
import { ConfirmModal } from "@/components/ConfirmModal";
import { exportXlsx } from "@/lib/export";
import { fmtDate, mesecLabel, localDateStr, parseDecimal, parseCount } from "@/lib/format";
import { recentOdjelIdsByInzinjer, splitOdjeliByRecent } from "@/lib/recent";

const today = () => localDateStr();

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function getDayOfWeek(dateStr: string): number {
  return parseLocalDate(dateStr).getDay();
}
const currentMonth = () => localDateStr().slice(0, 7);

function getMonthOptions() {
  const opts: { val: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    opts.push({ val, label: mesecLabel(d) });
  }
  return opts;
}

function displayProjectant(u: UnosRada): string {
  if (u.korisnik) return u.korisnik.fullName || u.korisnik.ime;
  if (u.inzinjer) return `${u.inzinjer.prezime} ${u.inzinjer.ime}`.trim();
  return "–";
}

export default function UnosPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const isWorker = session?.role === "worker";
  const [odjeli, setOdjeli] = useState<Odjel[]>([]);
  const [korisnici, setKorisnici] = useState<Korisnik[]>([]);
  const [unosi, setUnosi] = useState<UnosRada[]>([]);
  const [filterMjesec, setFilterMjesec] = useState(currentMonth);
  const [filterOdjel, setFilterOdjel] = useState("");
  const [confirmState, setConfirmState] = useState<{ msg: string; onOk: () => void } | null>(null);
  const [form, setForm] = useState({
    datum: today(),
    vrsta: "DOZNAKA" as VrstaRada,
    inzinjerId: "",
    odjelId: "",
    brojStabala: "",
    hektari: "",
    kilometri: "",
    napomena: "",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [multiDay, setMultiDay] = useState(false);
  const [datumDo, setDatumDo] = useState("");

  const dayOfWeek = getDayOfWeek(form.datum);
  const isSunday = dayOfWeek === 0;
  const isSaturday = dayOfWeek === 6;

  function getWorkDays(od: string, do_: string): string[] {
    const days: string[] = [];
    const end = parseLocalDate(do_);
    const cur = parseLocalDate(od);
    while (cur <= end) {
      if (cur.getDay() !== 0) days.push(localDateStr(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }

  const multiDayDates =
    multiDay && datumDo && datumDo >= form.datum ? getWorkDays(form.datum, datumDo) : [];

  useEffect(() => {
    if (!authLoading && !session) router.replace("/login/");
  }, [session, authLoading]);

  useEffect(() => {
    if (!session || !isWorker) return;
    setForm((f) => ({ ...f, inzinjerId: session.userId }));
  }, [session]);

  async function load() {
    const [od, kor, un] = await Promise.all([getOdjeli(), getKorisnici(), getUnosi()]);
    setOdjeli(od);
    setKorisnici(kor.filter((k) => k.role === "worker"));
    setUnosi(un);
  }

  useEffect(() => {
    load();
  }, []);

  if (authLoading || !session) return null;

  function handleKorisnikChange(id: string) {
    const kor = korisnici.find((k) => k.id === id);
    const odjelId = kor?.odjeliIds?.length === 1 ? kor.odjeliIds[0] : "";
    setForm((f) => ({ ...f, inzinjerId: id, odjelId }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const brojStabala = form.vrsta === "DOZNAKA" ? parseCount(form.brojStabala) : null;
    const hektari = form.vrsta === "DOZNAKA" ? parseDecimal(form.hektari) : null;
    const kilometri = form.vrsta === "VLAKA" ? parseDecimal(form.kilometri) : null;
    if ([brojStabala, hektari, kilometri].some((n) => Number.isNaN(n))) {
      setMsg("Greška: neispravan broj (npr. 12,5 ha ili 1234 stabala).");
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      const base = {
        vrsta: form.vrsta,
        inzinjerId: form.inzinjerId,
        odjelId: form.odjelId,
        brojStabala: brojStabala ?? undefined,
        hektari: hektari ?? undefined,
        kilometri: kilometri ?? undefined,
        napomena: form.napomena || undefined,
        createdById: session!.userId,
        createdByRole: session!.role,
      };
      const dates = multiDay && multiDayDates.length > 0 ? multiDayDates : [form.datum];
      await Promise.all(dates.map((datum) => createUnos({ ...base, datum })));
      setMsg(dates.length > 1 ? `Sačuvano ${dates.length} unosa!` : "Unos je sačuvan!");
      setForm((f) => ({
        ...f,
        datum: today(),
        brojStabala: "",
        hektari: "",
        kilometri: "",
        napomena: "",
      }));
      setMultiDay(false);
      setDatumDo("");
      load();
    } catch {
      setMsg("Greška pri unosu.");
    }
    setLoading(false);
    setTimeout(() => setMsg(""), 3000);
  }

  function handleDelete(id: string) {
    setConfirmState({
      msg: "Obrisati ovaj unos?",
      onOk: async () => {
        setConfirmState(null);
        await deleteUnos(id);
        load();
      },
    });
  }

  const filteredUnosi = unosi.filter((u) => {
    if (u.datum.slice(0, 7) !== filterMjesec) return false;
    if (isWorker && u.inzinjerId !== session!.userId) return false;
    if (filterOdjel && u.odjelId !== filterOdjel) return false;
    return true;
  });

  const currentInzinjerId = isWorker ? session.userId : form.inzinjerId;
  const { recent: formOdjeliRecent, rest: formOdjeliRest } = splitOdjeliByRecent(
    odjeli,
    recentOdjelIdsByInzinjer(unosi).get(currentInzinjerId) ?? []
  );

  const filterSummary = filteredUnosi.reduce(
    (acc, u) => {
      if (u.vrsta === "DOZNAKA") {
        acc.ha += u.hektari ?? 0;
        acc.stabala += u.brojStabala ?? 0;
      } else if (u.vrsta === "VLAKA") {
        acc.km += u.kilometri ?? 0;
      }
      return acc;
    },
    { ha: 0, stabala: 0, km: 0 }
  );

  function handleExport() {
    const rows = filteredUnosi.map((u) => ({
      Datum: fmtDate(u.datum),
      Projektant: displayProjectant(u),
      Odjel: u.odjel?.broj ?? "",
      Vrsta: u.vrsta,
      "Hektari (ha)": u.hektari ?? "",
      Stabala: u.brojStabala ?? "",
      "Vlake (km)": u.kilometri ?? "",
      Napomena: u.napomena ?? "",
    }));
    exportXlsx(rows, `unosi-${filterMjesec}`);
  }

  const inputCls =
    "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100";
  const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1";

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Unos rada</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-4"
          >
            <h2 className="font-semibold text-gray-700 dark:text-gray-200">Novi unos</h2>

            <div>
              <label className={labelCls}>Datum</label>
              <input
                type="date"
                className={inputCls}
                value={form.datum}
                onChange={(e) => setForm({ ...form, datum: e.target.value })}
                required
              />
              {isSunday && (
                <div className="mt-1.5 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
                  ⛔ Nedjelja je neradni dan — unos nije moguć.
                </div>
              )}
              {isSaturday && (
                <div className="mt-1.5 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-300">
                  ℹ️ Subota je inače neradni dan — unos je moguć ako je bila radna subota.
                </div>
              )}
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={multiDay}
                  onChange={(e) => {
                    setMultiDay(e.target.checked);
                    if (!e.target.checked) setDatumDo("");
                  }}
                  className="w-4 h-4 accent-green-700"
                />
                Ponovi za više dana
              </label>
              {multiDay && (
                <div className="mt-2 space-y-2">
                  <div>
                    <label className={labelCls}>Datum do</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={datumDo}
                      min={form.datum}
                      onChange={(e) => setDatumDo(e.target.value)}
                    />
                  </div>
                  {multiDayDates.length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                      Kreiraće se <strong>{multiDayDates.length}</strong> unosa (nedjelje preskočene)
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className={labelCls}>Vrsta rada</label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                {(["DOZNAKA", "VLAKA"] as VrstaRada[]).map((v) => (
                  <label
                    key={v}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg border-2 cursor-pointer text-sm font-medium transition-colors ${
                      form.vrsta === v
                        ? "border-green-600 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                        : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500"
                    }`}
                  >
                    <input
                      type="radio"
                      className="hidden"
                      value={v}
                      checked={form.vrsta === v}
                      onChange={() => setForm({ ...form, vrsta: v })}
                    />
                    {v === "DOZNAKA" ? "🌳 Doznaka" : "🛤️ Vlake"}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["TEREN", "GODISNJI", "KANCELARIJA", "BOLOVANJE"] as VrstaRada[]).map((v) => (
                  <label
                    key={v}
                    className={`flex items-center justify-center gap-1 py-2 rounded-lg border-2 cursor-pointer text-xs font-medium transition-colors text-center ${
                      form.vrsta === v
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                        : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500"
                    }`}
                  >
                    <input
                      type="radio"
                      className="hidden"
                      value={v}
                      checked={form.vrsta === v}
                      onChange={() => setForm({ ...form, vrsta: v, odjelId: "" })}
                    />
                    {v === "TEREN"
                      ? "🥾 Teren"
                      : v === "GODISNJI"
                      ? "🏖️ God. odmor"
                      : v === "KANCELARIJA"
                      ? "🏢 Kancelarija"
                      : "🏥 Bolovanje"}
                  </label>
                ))}
              </div>
            </div>

            {!isWorker && (
              <div>
                <label className={labelCls}>Projektant</label>
                <select
                  className={inputCls}
                  value={form.inzinjerId}
                  onChange={(e) => handleKorisnikChange(e.target.value)}
                  required
                >
                  <option value="">Odaberi projektanta...</option>
                  {korisnici.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.fullName || k.ime}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(form.vrsta === "DOZNAKA" || form.vrsta === "VLAKA") && (
              <div>
                <label className={labelCls}>Odjel</label>
                <select
                  className={inputCls}
                  value={form.odjelId}
                  onChange={(e) => setForm({ ...form, odjelId: e.target.value })}
                  required
                >
                  <option value="">Odaberi odjel...</option>
                  {formOdjeliRecent.length > 0 && (
                    <optgroup label="Nedavno rađeni">
                      {formOdjeliRecent.map((o) => (
                        <option key={o.id} value={o.id}>{o.gj} / {o.broj}</option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label={formOdjeliRecent.length > 0 ? "Ostali odjeli" : "Odjeli"}>
                    {formOdjeliRest.map((o) => (
                      <option key={o.id} value={o.id}>{o.gj} / {o.broj}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            )}

            {form.vrsta === "DOZNAKA" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Broj stabala</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={inputCls}
                    value={form.brojStabala}
                    onChange={(e) => setForm({ ...form, brojStabala: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Hektari (ha)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={inputCls}
                    value={form.hektari}
                    onChange={(e) => setForm({ ...form, hektari: e.target.value })}
                    required
                  />
                </div>
              </div>
            )}
            {form.vrsta === "VLAKA" && (
              <div>
                <label className={labelCls}>Kilometri vlaka (km)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  className={inputCls}
                  value={form.kilometri}
                  onChange={(e) => setForm({ ...form, kilometri: e.target.value })}
                  required
                />
              </div>
            )}

            <div>
              <label className={labelCls}>Napomena (opciono)</label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={2}
                value={form.napomena}
                onChange={(e) => setForm({ ...form, napomena: e.target.value })}
              />
            </div>

            <button
              type="submit"
              disabled={loading || isSunday}
              className="w-full bg-green-700 text-white py-2.5 rounded-lg font-medium hover:bg-green-800 disabled:opacity-50 transition-colors"
            >
              {loading
                ? "Čuvanje..."
                : multiDay && multiDayDates.length > 1
                ? `Sačuvaj ${multiDayDates.length} unosa`
                : "Sačuvaj unos"}
            </button>

            {msg && (
              <div
                className={`text-sm text-center py-2 rounded-lg ${
                  msg.includes("Greška")
                    ? "bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300"
                    : "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                }`}
              >
                {msg}
              </div>
            )}
          </form>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-wrap items-center gap-3">
              <h2 className="font-semibold text-gray-700 dark:text-gray-200 mr-auto">Unosi</h2>
              <select
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                value={filterMjesec}
                onChange={(e) => setFilterMjesec(e.target.value)}
              >
                {getMonthOptions().map((o) => (
                  <option key={o.val} value={o.val}>
                    {o.label}
                  </option>
                ))}
              </select>
              {!isWorker && (
                <select
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  value={filterOdjel}
                  onChange={(e) => setFilterOdjel(e.target.value)}
                >
                  <option value="">Svi odjeli</option>
                  {odjeli.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.gj}/{o.broj}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={handleExport}
                disabled={filteredUnosi.length === 0}
                className="bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-800 disabled:opacity-40"
              >
                Export XLSX
              </button>
            </div>
            {filterOdjel && filteredUnosi.length > 0 && (
              <div className="px-5 py-2 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900 flex gap-4 text-xs text-blue-700 dark:text-blue-300">
                <span>Odjel {odjeli.find((o) => o.id === filterOdjel)?.broj}:</span>
                {filterSummary.ha > 0 && (
                  <span>
                    <b>{filterSummary.ha.toFixed(2)}</b> ha
                  </span>
                )}
                {filterSummary.stabala > 0 && (
                  <span>
                    <b>{filterSummary.stabala}</b> stabala
                  </span>
                )}
                {filterSummary.km > 0 && (
                  <span>
                    <b>{filterSummary.km.toFixed(2)}</b> km vlaka
                  </span>
                )}
                <span className="text-blue-500 dark:text-blue-400">{filteredUnosi.length} unosa</span>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-600 dark:text-gray-300 font-medium">Datum</th>
                    {!isWorker && (
                      <th className="text-left px-4 py-2 text-gray-600 dark:text-gray-300 font-medium">Projektant</th>
                    )}
                    <th className="text-left px-4 py-2 text-gray-600 dark:text-gray-300 font-medium">Odjel</th>
                    <th className="text-left px-4 py-2 text-gray-600 dark:text-gray-300 font-medium">Vrsta</th>
                    <th className="text-right px-4 py-2 text-gray-600 dark:text-gray-300 font-medium">Količina</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUnosi.length === 0 && (
                    <tr>
                      <td
                        colSpan={isWorker ? 5 : 6}
                        className="text-center py-10 text-gray-500 dark:text-gray-400"
                      >
                        {unosi.length === 0
                          ? "Nema unosa. Dodajte prvi unos."
                          : "Nema unosa za odabrani mjesec."}
                      </td>
                    </tr>
                  )}
                  {filteredUnosi.map((u) => (
                    <tr
                      key={u.id}
                      className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <td className="px-4 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">
                        {fmtDate(u.datum)}
                      </td>
                      {!isWorker && (
                        <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {displayProjectant(u)}
                            {u.createdById && u.createdById === u.inzinjerId && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                                ↑ sam/a
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs">
                        {u.odjel?.broj}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${vrstaBadgeClass(u.vrsta)}`}
                          >
                            {vrstaLabel(u.vrsta)}
                          </span>
                          {isWorker && u.createdById && u.createdById !== u.inzinjerId && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                              {u.creator
                                ? u.creator.fullName?.split(" ")[0] || u.creator.ime
                                : "admin"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-gray-600 dark:text-gray-300">
                        {u.vrsta === "DOZNAKA" ? (
                          <span>
                            <span className="font-semibold text-gray-800 dark:text-gray-100">
                              {u.brojStabala}
                            </span>{" "}
                            st /{" "}
                            <span className="font-semibold text-gray-800 dark:text-gray-100">
                              {u.hektari?.toFixed(2)}
                            </span>{" "}
                            ha
                          </span>
                        ) : u.vrsta === "VLAKA" ? (
                          <span>
                            <span className="font-semibold text-gray-800 dark:text-gray-100">
                              {u.kilometri?.toFixed(2)}
                            </span>{" "}
                            km
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">–</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs"
                        >
                          Obriši
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {confirmState && (
        <ConfirmModal
          msg={confirmState.msg}
          onOk={confirmState.onOk}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}

function vrstaLabel(vrsta: string): string {
  const map: Record<string, string> = {
    DOZNAKA: "🌳 Doznaka",
    VLAKA: "🛤️ Vlake",
    TEREN: "🥾 Teren",
    GODISNJI: "🏖️ God. odmor",
    KANCELARIJA: "🏢 Kancelarija",
    BOLOVANJE: "🏥 Bolovanje",
  };
  return map[vrsta] ?? vrsta;
}

function vrstaBadgeClass(vrsta: string): string {
  const map: Record<string, string> = {
    DOZNAKA: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
    VLAKA: "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200",
    TEREN: "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200",
    GODISNJI: "bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200",
    KANCELARIJA: "bg-violet-100 dark:bg-violet-900 text-violet-800 dark:text-violet-200",
    BOLOVANJE: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
  };
  return map[vrsta] ?? "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200";
}
