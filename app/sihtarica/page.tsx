"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getKorisnici, getKorisnik, getOdjeli, getSihtarica, getGodisnjiUnosi,
  createUnos, updateUnos, deleteUnos, setGoDanaPoUgovoru,
} from "@/lib/db";
import { isOffline } from "@/lib/firebase";
import { useUnosiRefresh } from "@/hooks/useUnosiRefresh";
import type { Korisnik, Odjel, UnosRada, VrstaRada } from "@/lib/types";
import type { UnosEditPayload } from "@/lib/unos-edit";
import { daniMjeseca, rezime, fmtBroj, DANI_KRATKO, ucinakLabel, prethodniPopunjen, unioDrugi } from "@/lib/sihtarica";
import { goPeriod, iskoristenoDanaGO } from "@/lib/godisnji";
import { jePrviMjesecEvidencije } from "@/lib/godine";
import { monthYearLabel, fmtDate } from "@/lib/format";
import { recentOdjelIdsByInzinjer } from "@/lib/recent";
import { VRSTA } from "@/lib/vrste";
import { ConfirmModal } from "@/components/ConfirmModal";
import { DanRed } from "@/components/sihtarica/DanRed";
import { DanEditor } from "@/components/sihtarica/DanEditor";
import { GoKartica } from "@/components/sihtarica/GoKartica";
import { PopuniPeriod } from "@/components/sihtarica/PopuniPeriod";
import { MjesecTraka } from "@/components/sihtarica/MjesecTraka";

interface Mjesec { year: number; month: number }

function tekuciMjesec(): Mjesec {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function pomjeri(m: Mjesec, delta: number): Mjesec {
  const d = new Date(m.year, m.month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

const ODSUSTVA: readonly VrstaRada[] = ["TEREN", "KANCELARIJA", "GODISNJI", "BOLOVANJE"];

export default function SihtaricaPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  // tuđu šihtaricu vidi samo admin; operater i projektant vide samo svoju
  const canPick = session?.role === "admin";

  const [korisnici, setKorisnici] = useState<Korisnik[]>([]);
  const [korisniciLoaded, setKorisniciLoaded] = useState(false);
  const [pickedId, setPickedId] = useState("");
  const [mjesec, setMjesec] = useState<Mjesec>(tekuciMjesec);
  const [odjeli, setOdjeli] = useState<Odjel[]>([]);
  const [unosi, setUnosi] = useState<UnosRada[]>([]);
  const [goUnosi, setGoUnosi] = useState<UnosRada[]>([]);
  const [loadedKey, setLoadedKey] = useState("");
  const [openDay, setOpenDay] = useState<{ key: string; datum: string } | null>(null);
  const [showPopuni, setShowPopuni] = useState(false);
  const [confirm, setConfirm] = useState<UnosRada | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedId = canPick ? pickedId || korisnici[0]?.id || "" : session?.userId ?? "";
  const viewKey = `${selectedId}|${mjesec.year}-${mjesec.month}`;
  const loading = loadedKey !== viewKey;

  useEffect(() => {
    if (!authLoading && !session) router.replace("/login/");
  }, [session, authLoading]);

  function toast(text: string, error = false) {
    setMsg({ text, error });
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(null), error ? 5000 : 2500);
  }

  useEffect(() => {
    if (!session) return;
    getOdjeli().then(setOdjeli).catch(() => toast("Greška pri učitavanju odjela.", true));
    const req = canPick
      ? getKorisnici().then((ks) => ks.filter((k) => k.role === "worker"))
      : getKorisnik(session.userId).then((k) => (k ? [k] : []));
    req
      .then(setKorisnici)
      .catch(() => toast("Greška pri učitavanju projektanata.", true))
      .finally(() => setKorisniciLoaded(true));
  }, [session, canPick]);

  const reqId = useRef(0);
  const load = useCallback((): Promise<void> => {
    if (!selectedId) return Promise.resolve();
    const id = ++reqId.current;
    const key = `${selectedId}|${mjesec.year}-${mjesec.month}`;
    return Promise.all([
      getSihtarica(selectedId, mjesec.year, mjesec.month),
      getGodisnjiUnosi(selectedId),
    ])
      .then(([mj, go]) => {
        if (id !== reqId.current) return;
        setUnosi(mj);
        setGoUnosi(go);
      })
      .catch(() => { if (id === reqId.current) toast("Greška pri učitavanju šihtarice.", true); })
      .finally(() => { if (id === reqId.current) setLoadedKey(key); });
  }, [selectedId, mjesec.year, mjesec.month]);

  useEffect(() => { load(); }, [load]);

  useUnosiRefresh(load);

  const korisnik = korisnici.find((k) => k.id === selectedId) ?? null;
  const dani = useMemo(() => daniMjeseca(mjesec.year, mjesec.month, unosi), [mjesec, unosi]);
  const rez = useMemo(() => rezime(dani), [dani]);
  const period = useMemo(() => goPeriod(mjesec.year, mjesec.month), [mjesec]);
  const iskoristeno = useMemo(() => iskoristenoDanaGO(goUnosi, period), [goUnosi, period]);
  const recentIds = useMemo(() => {
    const fromUnosi = recentOdjelIdsByInzinjer(unosi).get(selectedId) ?? [];
    return [...new Set([...fromUnosi, ...(korisnik?.odjeliIds ?? [])])];
  }, [unosi, selectedId, korisnik]);

  useEffect(() => {
    if (!openDay) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenDay(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openDay]);

  if (authLoading || !session) return null;

  const naPrvom = jePrviMjesecEvidencije(mjesec.year, mjesec.month);
  const tek = tekuciMjesec();
  const naTekucem = mjesec.year === tek.year && mjesec.month === tek.month;
  const imeProjektanta = korisnik ? (korisnik.fullName || korisnik.ime) : "";

  function otvoriDan(datum: string) {
    setOpenDay({ key: viewKey, datum });
    requestAnimationFrame(() =>
      document.getElementById(`dan-${datum}`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }

  const idxProjektanta = korisnici.findIndex((k) => k.id === selectedId);
  const prvaGreska = dani.find((d) => d.konflikt);

  const audit = { createdById: session.userId, createdByRole: session.role };
  const savedMsg = (n = 1) => {
    const base = n > 1 ? `Upisano ${n} dana ✓` : "Sačuvano ✓";
    return isOffline() ? `${base} (offline — šalje se kad bude signala)` : base;
  };

  async function handleCreate(datum: string, d: UnosEditPayload): Promise<boolean> {
    try {
      await createUnos({
        datum, vrsta: d.vrsta, inzinjerId: selectedId,
        odjelId: d.odjelId ?? undefined,
        brojStabala: d.brojStabala ?? undefined,
        hektari: d.hektari ?? undefined,
        kilometri: d.kilometri ?? undefined,
        napomena: d.napomena ?? undefined,
        ...audit,
      });
      toast(savedMsg());
      await load();
      return true;
    } catch {
      toast("Greška pri snimanju. Provjeri internet i pokušaj ponovo.", true);
      return false;
    }
  }

  async function handleUpdate(id: string, d: UnosEditPayload): Promise<boolean> {
    try {
      await updateUnos(id, { ...d, updatedById: session!.userId, updatedByRole: session!.role });
      toast(savedMsg());
      await load();
      return true;
    } catch {
      toast("Greška pri snimanju izmjene.", true);
      return false;
    }
  }

  async function handleDelete(u: UnosRada) {
    setConfirm(null);
    try {
      await deleteUnos(u.id);
      toast("Unos obrisan");
      await load();
    } catch {
      toast("Greška pri brisanju.", true);
    }
  }

  async function handlePopuni(vrsta: VrstaRada, datumi: string[]) {
    try {
      await Promise.all(datumi.map((datum) => createUnos({ datum, vrsta, inzinjerId: selectedId, ...audit })));
      toast(savedMsg(datumi.length));
      setShowPopuni(false);
      await load();
    } catch {
      toast("Dio dana nije upisan. Provjeri internet i pokušaj ponovo.", true);
      await load();
    }
  }

  async function handleUgovor(dana: number | null) {
    await setGoDanaPoUgovoru(selectedId, period.godina, dana);
    const key = String(period.godina);
    setKorisnici((ks) => ks.map((k) => {
      if (k.id !== selectedId) return k;
      const next = { ...k.goDanaPoUgovoru };
      if (dana === null) delete next[key];
      else next[key] = dana;
      return { ...k, goDanaPoUgovoru: next };
    }));
    toast("Broj dana po ugovoru sačuvan ✓");
  }

  async function exportExcel() {
    const { exportXlsx } = await import("@/lib/export");
    const rows = dani.flatMap((d) => {
      const base = { Datum: fmtDate(d.datum), Dan: DANI_KRATKO[d.weekday] };
      if (!d.unosi.length) return [{ ...base, Vrsta: d.praznik ?? (d.vikend ? "vikend" : ""), Odjel: "", Učinak: "", Napomena: "", Unio: "" }];
      return d.unosi.map((u) => ({
        ...base,
        Vrsta: VRSTA[u.vrsta]?.label ?? u.vrsta,
        Odjel: u.odjel ? `${u.odjel.gj} / ${u.odjel.broj}` : "",
        Učinak: ucinakLabel(u),
        Napomena: u.napomena ?? "",
        Unio: unioDrugi(u)?.puno ?? "",
      }));
    });
    const ime = (korisnik?.ime ?? "projektant").replace(/[^\w-]/g, "_");
    exportXlsx(rows, `Sihtarica_${ime}_${mjesec.year}-${String(mjesec.month).padStart(2, "0")}`);
  }

  const btnNav = "w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-30 disabled:hover:bg-transparent text-lg";
  const btnGhost = "px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors";
  const pctPopunjeno = rez.radnihDana ? Math.round((rez.popunjeno / rez.radnihDana) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Zaglavlje */}
      <header className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="mr-auto min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-green-700 dark:text-green-400">Šihtarica</p>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 truncate">
            {imeProjektanta || "—"}
          </h1>
          {korisnik?.title && <p className="text-sm text-gray-500 dark:text-gray-400">{korisnik.title}</p>}
        </div>

        {canPick && (
          <div className="flex items-center gap-1 print:hidden">
          <button type="button" className={btnNav} disabled={idxProjektanta <= 0}
            onClick={() => setPickedId(korisnici[idxProjektanta - 1].id)} aria-label="Prethodni projektant">‹</button>
          <select
            id="sihtarica-projektant"
            value={selectedId}
            onChange={(e) => setPickedId(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 max-w-[14rem]"
            aria-label="Projektant"
          >
            {korisnici.map((k) => <option key={k.id} value={k.id}>{k.fullName || k.ime}</option>)}
          </select>
          <button type="button" className={btnNav} disabled={idxProjektanta < 0 || idxProjektanta >= korisnici.length - 1}
            onClick={() => setPickedId(korisnici[idxProjektanta + 1].id)} aria-label="Sljedeći projektant">›</button>
          </div>
        )}

        <div className="flex items-center gap-1">
          <button type="button" className={`${btnNav} print:hidden`} disabled={naPrvom}
            onClick={() => setMjesec((m) => pomjeri(m, -1))} aria-label="Prethodni mjesec">‹</button>
          <span className="min-w-[9.5rem] text-center text-base font-semibold capitalize text-gray-800 dark:text-gray-100 tabular-nums">
            {monthYearLabel(mjesec.year, mjesec.month)}
          </span>
          <button type="button" className={`${btnNav} print:hidden`} disabled={naTekucem}
            onClick={() => setMjesec((m) => pomjeri(m, 1))} aria-label="Sljedeći mjesec">›</button>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button type="button" className={btnGhost} onClick={() => setShowPopuni((v) => !v)}>Popuni period</button>
          <button type="button" className={btnGhost} onClick={exportExcel}>Excel</button>
          <button type="button" className={btnGhost} onClick={() => window.print()}>Štampaj</button>
        </div>
      </header>

      {msg && (
        <div role="status" className={`fixed bottom-24 md:bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg print:hidden ${
          msg.error ? "bg-red-600 text-white" : "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
        }`}>
          {msg.text}
        </div>
      )}

      {/* Rezime + GO */}
      <div className="grid gap-3 lg:grid-cols-[1fr_22rem]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-700">
          <div className="bg-white dark:bg-gray-900 p-4">
            <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Popunjeno</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-gray-800 dark:text-gray-100">
              {rez.popunjeno}<span className="text-base font-medium text-gray-400"> / {rez.radnihDana}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div className={`h-full rounded-full ${pctPopunjeno === 100 ? "bg-green-600" : "bg-amber-500"}`} style={{ width: `${pctPopunjeno}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-gray-400">radnih dana{naTekucem ? " do danas" : ""}</div>
          </div>
          <div className="bg-white dark:bg-gray-900 p-4">
            <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Doznaka</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-green-700 dark:text-green-400">
              {fmtBroj(rez.ha)}<span className="text-base font-medium"> ha</span>
            </div>
            <div className="mt-1 text-xs tabular-nums text-gray-500 dark:text-gray-400">{fmtBroj(rez.stabala, 0)} stabala · {rez.daniPoVrsti.DOZNAKA} d</div>
          </div>
          <div className="bg-white dark:bg-gray-900 p-4">
            <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Vlake</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {fmtBroj(rez.km)}<span className="text-base font-medium"> km</span>
            </div>
            <div className="mt-1 text-xs tabular-nums text-gray-500 dark:text-gray-400">{rez.daniPoVrsti.VLAKA} d</div>
          </div>
          <div className="bg-white dark:bg-gray-900 p-4">
            <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Prisustvo (dana)</div>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {ODSUSTVA.map((v) => (
                <div key={v} className="flex items-center justify-between gap-1">
                  <dt className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                    <span className={`w-2 h-2 rounded-full ${VRSTA[v].dot}`} aria-hidden />{VRSTA[v].short}
                  </dt>
                  <dd className="font-semibold tabular-nums text-gray-800 dark:text-gray-100">{rez.daniPoVrsti[v]}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <GoKartica
          key={`${selectedId}-${period.godina}-${korisnik?.goDanaPoUgovoru?.[String(period.godina)] ?? ""}`}
          period={period}
          ugovor={korisnik?.goDanaPoUgovoru?.[String(period.godina)] ?? undefined}
          iskoristeno={iskoristeno}
          canEdit={canPick}
          onSave={handleUgovor}
        />
      </div>

      {!loading && <MjesecTraka dani={dani} onPick={otvoriDan} />}

      {!loading && prvaGreska && (
        <button type="button" onClick={() => otvoriDan(prvaGreska.datum)}
          className="w-full text-left rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-2.5 text-sm text-red-800 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-950/60 print:hidden">
          <b>⚠ {rez.konflikti} {rez.konflikti === 1 ? "dan ima" : "dana ima"} konflikt</b> — godišnji ili bolovanje upisan zajedno s drugom aktivnošću.
          <span className="underline ml-1">Otvori {prvaGreska.dan}.</span>
        </button>
      )}

      {showPopuni && <PopuniPeriod key={viewKey} dani={dani} onSubmit={handlePopuni} onClose={() => setShowPopuni(false)} />}

      {/* Dani */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="grid grid-cols-[3.25rem_1fr_auto] gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <span className="text-center">Dan</span>
          <span>Aktivnost · odjel · učinak</span>
          <span className="w-7" />
        </div>
        {!selectedId && korisniciLoaded ? (
          <div className="py-16 text-center text-sm text-gray-400">Nema aktivnih projektanata.</div>
        ) : loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Učitavam šihtaricu…</div>
        ) : (
          <ul>
            {dani.map((d) => (
              <DanRed
                key={d.datum}
                dan={d}
                open={openDay?.key === viewKey && openDay.datum === d.datum}
                canEdit
                onToggle={() => setOpenDay((cur) =>
                  cur?.key === viewKey && cur.datum === d.datum ? null : { key: viewKey, datum: d.datum })}
                editor={
                  <DanEditor
                    key={`${d.datum}-${selectedId}`}
                    dan={d}
                    prethodni={prethodniPopunjen(dani, d.datum)}
                    odjeli={odjeli}
                    recentIds={recentIds}
                    onCreate={(data) => handleCreate(d.datum, data)}
                    onUpdate={handleUpdate}
                    onDelete={setConfirm}
                  />
                }
              />
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 print:hidden">
        Šihtarica, Unos rada i Unos učinka dijele iste podatke — izmjena na jednom mjestu odmah se vidi na ostalim.
      </p>

      {confirm && (
        <ConfirmModal
          msg={`Obrisati unos „${VRSTA[confirm.vrsta]?.label ?? confirm.vrsta}“ za ${fmtDate(confirm.datum)}?`}
          okLabel="Obriši"
          okColor="red"
          onOk={() => handleDelete(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
