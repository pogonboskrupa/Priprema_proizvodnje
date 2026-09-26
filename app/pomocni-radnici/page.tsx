"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getPomocniRadnici, getKorisnici } from "@/lib/db";
import type { Korisnik, PomocniRadnik, VrstaPomocnog } from "@/lib/types";
import { monthYearLabel, localDateStr } from "@/lib/format";
import { jePrviMjesecEvidencije } from "@/lib/godine";
import { POMOCNI, VRSTE_POMOCNI, daniUMjesecu, rezimeSihte, punoIme } from "@/lib/pomocni";
import { useSihtePomocnih } from "@/hooks/useSihtePomocnih";
import { Icon } from "@/components/Icon";
import { CetkaTraka, type Cetka } from "@/components/pomocni/Cetka";
import { PregledMatrica } from "@/components/pomocni/PregledMatrica";
import { SihtaKalendar } from "@/components/pomocni/SihtaKalendar";
import { Evidencija } from "@/components/pomocni/Evidencija";
import { useZakljucavanje } from "@/hooks/useZakljucavanje";

type View = "pregled" | "sihtarica" | "evidencija";
const VIEWS: { id: View; label: string }[] = [
  { id: "pregled", label: "Pregled" },
  { id: "sihtarica", label: "Šihtarica" },
  { id: "evidencija", label: "Radnici" },
];

const TIPKE: Record<string, Cetka> = { t: "TEREN", k: "KANCELARIJA", g: "GODISNJI", b: "BOLOVANJE", o: "OSTALO", Delete: "BRISI", Backspace: "BRISI" };

interface Mjesec { year: number; month: number }

const ucitaj = () => Promise.all([getPomocniRadnici(), getKorisnici()]);

function pomjeri(m: Mjesec, delta: number): Mjesec {
  const d = new Date(m.year, m.month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export default function PomocniRadniciPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const canAccess = !!session && (session.role === "admin" || !!session.operater);

  const tekuci = useMemo<Mjesec>(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() + 1 }; }, []);
  const [view, setView] = useState<View>("pregled");
  const [mjesec, setMjesec] = useState<Mjesec>(tekuci);
  const [cetka, setCetka] = useState<Cetka>("TEREN");
  const [odabraniId, setOdabraniId] = useState("");
  const [radnici, setRadnici] = useState<PomocniRadnik[]>([]);
  const [korisnici, setKorisnici] = useState<Korisnik[]>([]);
  const [init, setInit] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((text: string, error = false) => {
    setMsg({ text, error });
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(null), error ? 5000 : 2500);
  }, []);
  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current); }, []);

  const onSaveError = useCallback(() => toast("Upis šihte nije sačuvan. Provjeri internet i pokušaj ponovo.", true), [toast]);
  const { sihte, loading: sihteLoading, error: sihteError, postavi } = useSihtePomocnih(mjesec.year, mjesec.month, onSaveError);
  const { zakljucan } = useZakljucavanje();
  const mjesecZakljucan = zakljucan(`${mjesec.year}-${String(mjesec.month).padStart(2, "0")}-01`);

  useEffect(() => {
    if (authLoading) return;
    if (!session) router.replace("/login/");
    else if (!canAccess) router.replace("/");
  }, [authLoading, session, canAccess, router]);

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    ucitaj()
      .then(([r, k]) => { if (!cancelled) { setRadnici(r); setKorisnici(k); } })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setInit(false); });
    return () => { cancelled = true; };
  }, [canAccess]);

  // Baca grešku — pozivalac odlučuje kako je prikazati
  const refresh = useCallback(async () => {
    const [r, k] = await ucitaj();
    setRadnici(r);
    setKorisnici(k);
    setLoadError(false);
  }, []);

  // Tipke T/K/G/B/O biraju četku, Delete briše — samo kad fokus nije u polju za unos
  useEffect(() => {
    if (view === "evidencija") return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || el.closest("input, select, textarea")) return;
      const c = TIPKE[e.key] ?? TIPKE[e.key.toLowerCase()];
      if (c) { e.preventDefault(); setCetka(c); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);

  const aktivni = useMemo(() => radnici.filter((r) => r.aktivan), [radnici]);
  const projektanti = useMemo(() => korisnici.filter((k) => !k.arhiviran && k.role === "worker"), [korisnici]);
  const projMap = useMemo(() => new Map(korisnici.map((k) => [k.id, k.fullName || k.ime])), [korisnici]);
  const projektantIme = useCallback((id: string | null | undefined) => (id ? projMap.get(id) ?? null : null), [projMap]);
  const kalendar = useMemo(() => daniUMjesecu(mjesec.year, mjesec.month), [mjesec]);
  const danas = localDateStr();

  const odabrani = aktivni.find((r) => r.id === odabraniId) ?? aktivni[0];

  const ukupno = useMemo(() => {
    const t = { TEREN: 0, KANCELARIJA: 0, GODISNJI: 0, BOLOVANJE: 0, OSTALO: 0, nepopunjeno: 0 };
    for (const r of aktivni) {
      const rez = rezimeSihte(sihte[r.id] ?? {}, kalendar, danas);
      for (const v of VRSTE_POMOCNI) t[v] += rez.po[v];
      t.nepopunjeno += rez.nepopunjeno;
    }
    return t;
  }, [aktivni, sihte, kalendar, danas]);

  const otvori = (id: string) => { setOdabraniId(id); setView("sihtarica"); };
  const postaviDan = useCallback((radnikId: string, dan: number, v: VrstaPomocnog | null) => postavi(radnikId, { [dan]: v }), [postavi]);

  const popuniSveTerenom = useCallback(() => {
    const buduci = (kalendar[0]?.datum ?? "") > danas;
    for (const r of aktivni) {
      const dani = sihte[r.id] ?? {};
      const izmjene: Record<number, VrstaPomocnog> = {};
      for (const d of kalendar) {
        if (d.radni && !dani[String(d.dan)] && (buduci || d.datum <= danas)) {
          izmjene[d.dan] = "TEREN";
        }
      }
      if (Object.keys(izmjene).length > 0) postavi(r.id, izmjene);
    }
    toast("Svi prazni radni dani popunjeni — Teren");
  }, [aktivni, kalendar, sihte, danas, postavi, toast]);

  // Ukupno praznih radnih dana svih radnika (za tekući/prošli: do danas; za budući: svi)
  const prazniSvi = useMemo(() => {
    const buduci = (kalendar[0]?.datum ?? "") > danas;
    let n = 0;
    for (const r of aktivni) {
      const dani = sihte[r.id] ?? {};
      for (const d of kalendar) {
        if (d.radni && !dani[String(d.dan)] && (buduci || d.datum <= danas)) n++;
      }
    }
    return n;
  }, [aktivni, sihte, kalendar, danas]);

  async function exportExcel() {
    const { exportXlsx } = await import("@/lib/export");
    const rows = aktivni.map((r) => {
      const dani = sihte[r.id] ?? {};
      const rez = rezimeSihte(dani, kalendar, danas);
      return {
        Radnik: punoIme(r),
        Projektant: projektantIme(r.projektantId) ?? "",
        ...Object.fromEntries(kalendar.map((d) => [String(d.dan), dani[String(d.dan)] ? POMOCNI[dani[String(d.dan)]].kod : ""])),
        ...Object.fromEntries(VRSTE_POMOCNI.map((v) => [POMOCNI[v].label, rez.po[v]])),
        Ukupno: rez.ukupno,
      };
    });
    exportXlsx(rows, `Pomocni_radnici_${mjesec.year}-${String(mjesec.month).padStart(2, "0")}`);
  }

  const naPrvom = jePrviMjesecEvidencije(mjesec.year, mjesec.month);
  const maxMjesec = pomjeri(tekuci, 1);
  const naZadnjem = mjesec.year > maxMjesec.year || (mjesec.year === maxMjesec.year && mjesec.month >= maxMjesec.month);
  const btnNav = "w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-30 disabled:hover:bg-transparent text-lg";

  if (authLoading || !canAccess || init) {
    return (
      <div className="space-y-4 animate-pulse" aria-busy="true">
        <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="h-8 w-56 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="h-20 rounded-xl bg-gray-100 dark:bg-gray-800/60" />
        <div className="h-72 rounded-xl bg-gray-100 dark:bg-gray-800/60" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="mr-auto min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-green-700 dark:text-green-400">Pomoćni radnici</p>
          <div className="flex items-center gap-1 mt-0.5">
            <button type="button" className={btnNav} disabled={naPrvom} onClick={() => setMjesec((m) => pomjeri(m, -1))} aria-label="Prethodni mjesec">‹</button>
            <h1 className="min-w-[10.5rem] text-center text-2xl font-bold capitalize tabular-nums text-gray-800 dark:text-gray-100">
              {monthYearLabel(mjesec.year, mjesec.month)}
            </h1>
            <button type="button" className={btnNav} disabled={naZadnjem} onClick={() => setMjesec((m) => pomjeri(m, 1))} aria-label="Sljedeći mjesec">›</button>
          </div>
        </div>

        <div role="tablist" aria-label="Prikaz" className="flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 gap-1">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${
                view === v.id ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-50 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}>
              {v.label}
              {v.id === "evidencija" && <span className="ml-1.5 text-xs tabular-nums text-gray-400">{aktivni.length}</span>}
            </button>
          ))}
        </div>
      </header>

      {msg && (
        <div role="status" className={`fixed bottom-24 md:bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${
          msg.error ? "bg-red-600 text-white" : "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
        }`}>
          {msg.text}
        </div>
      )}

      {(loadError || sihteError) && (
        <div role="alert" className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-2.5 text-sm text-red-800 dark:text-red-200 flex items-center gap-3">
          {loadError ? "Spisak radnika nije učitan." : "Šihte za ovaj mjesec nisu učitane."} Provjeri internet.
          {loadError && <button type="button" onClick={() => refresh().catch(() => toast("Učitavanje nije uspjelo.", true))} className="ml-auto underline font-medium">Pokušaj ponovo</button>}
        </div>
      )}

      {view === "pregled" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-700">
          <Kpi label="Aktivnih radnika" value={aktivni.length} />
          <Kpi label="Teren" value={ukupno.TEREN} suffix="dana" tone={POMOCNI.TEREN.text} />
          <Kpi label="Godišnji · bolovanje" value={ukupno.GODISNJI + ukupno.BOLOVANJE} suffix="dana" tone={POMOCNI.GODISNJI.text} />
          <Kpi label="Prazni radni dani" value={ukupno.nepopunjeno}
            tone={ukupno.nepopunjeno ? "text-amber-600 dark:text-amber-400" : "text-green-700 dark:text-green-400"}
            hint={ukupno.nepopunjeno ? "označeni isprekidano" : "sve popunjeno"} />
        </div>
      )}

      {view !== "evidencija" && aktivni.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <CetkaTraka value={cetka} onChange={setCetka} />
          <p className="text-xs text-gray-400 dark:text-gray-500 hidden md:block">Klikni ili prevuci preko dana. Ponovni klik briše.</p>
          {view === "pregled" && (
            <>
              {prazniSvi > 0 && !mjesecZakljucan && (
                <button type="button" onClick={popuniSveTerenom} disabled={sihteLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-700 text-sm font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors disabled:opacity-50">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${POMOCNI.TEREN.dot}`} aria-hidden />
                  Popuni sve terenom
                  <span className="rounded-full bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 text-[10px] tabular-nums">{prazniSvi}</span>
                </button>
              )}
              <button type="button" onClick={exportExcel}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <Icon name="download" className="w-4 h-4" /> Excel
              </button>
            </>
          )}
        </div>
      )}

      {view !== "evidencija" && aktivni.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 py-14 text-center">
          <Icon name="hardhat" className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-300">Nema aktivnih pomoćnih radnika</p>
          <button type="button" onClick={() => setView("evidencija")} className="mt-3 text-sm font-medium text-green-700 dark:text-green-400 hover:underline">
            Dodaj radnika →
          </button>
        </div>
      )}

      {view === "pregled" && aktivni.length > 0 && (
        <PregledMatrica
          radnici={aktivni}
          kalendar={kalendar}
          sihte={sihte}
          danas={danas}
          cetka={cetka}
          disabled={sihteLoading || mjesecZakljucan}
          projektantIme={projektantIme}
          onPostavi={postaviDan}
          onOtvori={otvori}
        />
      )}

      {view === "sihtarica" && odabrani && (
        <SihtaKalendar
          radnik={odabrani}
          radnici={aktivni}
          kalendar={kalendar}
          dani={sihte[odabrani.id] ?? {}}
          danas={danas}
          cetka={cetka}
          disabled={sihteLoading || mjesecZakljucan}
          projektant={projektantIme(odabrani.projektantId)}
          onPostavi={(izmjene) => postavi(odabrani.id, izmjene)}
          onOdaberi={setOdabraniId}
        />
      )}

      {view === "evidencija" && (
        <Evidencija
          radnici={radnici}
          projektanti={projektanti}
          sihte={sihte}
          kalendar={kalendar}
          danas={danas}
          onRefresh={refresh}
          onOtvori={otvori}
          toast={toast}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, suffix, tone = "text-gray-800 dark:text-gray-100", hint }: {
  label: string; value: number; suffix?: string; tone?: string; hint?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 p-4">
      <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>
        {value}{suffix && <span className="text-base font-medium text-gray-400"> {suffix}</span>}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-gray-400">{hint}</div>}
    </div>
  );
}
