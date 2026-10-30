"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  getRezimeZaPeriod, getRezimePoOdjelima, getInzinjeriByKorisnikId, getGodisnjePlanPoProjektantu,
  getZadnjiDanPoProjektantu, getKorisnici, getKorisnik, getUnosiZaMjesec, getGodisnjiUnosi, tekuciMjesec,
  type OdjelMjesecRezime, type MjesecniRezime, type PlanProjektantRed, type ZadnjiDan,
} from "@/lib/db";
import type { Korisnik, UnosRada } from "@/lib/types";
import { mesecLabel, fmtDateLong, fmtDateShort, localDateStr } from "@/lib/format";
import { fmtBroj, ucinakLabel } from "@/lib/sihtarica";
import { prosliMjesecDoDanas } from "@/lib/usporedba";
import { navFor } from "@/lib/nav";
import { useSumarije } from "@/hooks/useSumarije";
import { ulogaLabel, jeProjektant } from "@/lib/sumarija";
import { Icon, type IconName } from "@/components/Icon";
import { Delta } from "@/components/Delta";
import { useUnosiRefresh } from "@/hooks/useUnosiRefresh";
import { vrsta } from "@/lib/vrste";
import { jeRadniDan, praznik } from "@/lib/praznici";
import { goPeriod, iskoristenoDanaGO, type GoPeriod } from "@/lib/godisnji";

export default function Home() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [rezime, setRezime] = useState<MjesecniRezime | null>(null);
  const [prosli, setProsli] = useState<MjesecniRezime | null>(null);
  const [odjeliRezime, setOdjeliRezime] = useState<OdjelMjesecRezime[]>([]);
  const [plan, setPlan] = useState<PlanProjektantRed[] | null>(null);
  const [zadnji, setZadnji] = useState<Record<string, ZadnjiDan> | null>(null);
  const [projektanti, setProjektanti] = useState<Korisnik[]>([]);
  const [korisnik, setKorisnik] = useState<Korisnik | null>(null);
  const [mjesecUnosi, setMjesecUnosi] = useState<UnosRada[] | null>(null);
  const [goUnosi, setGoUnosi] = useState<UnosRada[] | null>(null);
  const [greska, setGreska] = useState(false);
  const sumarije = useSumarije();
  const isWorker = session?.role === "worker";
  const [refreshTick, setRefreshTick] = useState(0);
  useUnosiRefresh(() => setRefreshTick((t) => t + 1));

  useEffect(() => {
    if (!loading && !session) router.replace("/login/");
  }, [session, loading, router]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const now = new Date();
    const mj = tekuciMjesec(now);
    const pr = prosliMjesecDoDanas(now);
    const pad = () => { if (!cancelled) setGreska(true); };
    const kad = <T,>(set: (v: T) => void) => (v: T) => { if (!cancelled) set(v); };

    // unosi.inzinjerId = korisnik.id; legacy unosi mogu imati inzinjer.id
    const idsP: Promise<string[] | undefined> = isWorker
      ? getInzinjeriByKorisnikId(session.userId).catch(() => []).then((inz) => [session.userId, ...inz.map((i) => i.id)])
      : Promise.resolve(undefined);

    idsP.then((ids) => {
      if (cancelled) return;
      setGreska(false);
      getRezimeZaPeriod(mj.od, mj.do_, ids).then(kad(setRezime)).catch(pad);
      getRezimeZaPeriod(pr.od, pr.do_, ids).then(kad(setProsli)).catch(pad);
      getRezimePoOdjelima(mj.od, mj.do_, ids).then(kad(setOdjeliRezime)).catch(pad);
      getGodisnjePlanPoProjektantu(now.getFullYear()).then(kad(setPlan)).catch(pad);
      getZadnjiDanPoProjektantu(ids).then(kad(setZadnji)).catch(pad);
      if (isWorker && ids) {
        const idSet = new Set(ids);
        getUnosiZaMjesec(now.getFullYear(), now.getMonth() + 1)
          .then((u) => kad(setMjesecUnosi)(u.filter((x) => idSet.has(x.inzinjerId)))).catch(pad);
        getGodisnjiUnosi(session.userId).then(kad(setGoUnosi)).catch(pad);
      }
    });
    getKorisnik(session.userId).then(kad(setKorisnik)).catch(pad);
    if (!isWorker) {
      getKorisnici().then((k) => kad(setProjektanti)(k.filter(jeProjektant))).catch(pad);
    }
    return () => { cancelled = true; };
  }, [session, isWorker, refreshTick]);

  if (loading || !session) return null;

  const danasD = new Date();
  const mesec = mesecLabel(danasD);
  const nav = navFor(session);
  const uloga = ulogaLabel(session, sumarije);
  const linkovi = nav.all.filter((l) => l.href !== "/");
  const { doDana } = prosliMjesecDoDanas(danasD);
  const mojPlan = plan?.find((r) => r.korisnikId === session.userId);
  const danasStr = localDateStr(danasD);
  const goPer = goPeriod(danasD.getFullYear(), danasD.getMonth() + 1);
  const imaGoUgovor = !!(korisnik?.goDanaPoUgovoru?.[String(goPer.godina)] ?? 0);
  const danasUpisan = isWorker && zadnji
    ? Object.values(zadnji).some((z) => z.datum === danasStr)
    : null;
  const granicaKasni = prethodniRadniDan(danasD);
  const kasniBroj = !isWorker && zadnji && projektanti.length > 0
    ? projektanti.filter((k) => (zadnji[k.id]?.datum ?? "") < granicaKasni).length
    : null;

  const sekcijaRezime = (
    <section aria-labelledby="rezime-naslov">
      <SectionTitle id="rezime-naslov" title={isWorker ? "Moj učinak" : "Svi projektanti"} meta={mesec} />
      {rezime ? (
        <>
          <div className={`grid ${isWorker ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : "grid-cols-3"} gap-3`}>
            <Stat label="Doznaka" icon="tree" tint="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400" value={fmtBroj(rezime.ha)} unit="ha" tone="text-green-700 dark:text-green-400"
              delta={prosli && <Delta cur={rezime.ha} prev={prosli.ha} />} />
            <Stat label="Stabala" icon="chart" tint="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" value={fmtBroj(rezime.stabala, 0)} unit="st." tone="text-emerald-700 dark:text-emerald-400"
              delta={prosli && <Delta cur={rezime.stabala} prev={prosli.stabala} dec={0} />} />
            <Stat label="Vlake" icon="map" tint="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" value={fmtBroj(rezime.km)} unit="km" tone="text-amber-600 dark:text-amber-400"
              delta={prosli && <Delta cur={rezime.km} prev={prosli.km} />} />
            {isWorker && <>
              <Stat label="Radni dani" icon="calendar" tint="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" value={String(rezime.radniDani)} unit="dana" tone="text-gray-900 dark:text-gray-50"
                delta={prosli && <Delta cur={rezime.radniDani} prev={prosli.radniDani} dec={0} />} />
              <Stat label="Odsustva" icon="user" tint="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400" value={String(rezime.godisnji + rezime.bolovanje)} unit="dana"
                tone="text-sky-700 dark:text-sky-400" note={`GO ${rezime.godisnji} · bol. ${rezime.bolovanje}`}
                className="col-span-2 lg:col-span-1" />
            </>}
          </div>
          {prosli && (
            <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
              Strelice: razlika u odnosu na 1.–{doDana}. prošlog mjeseca (isti dio mjeseca).
            </p>
          )}
        </>
      ) : (
        <div className={`grid ${isWorker ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : "grid-cols-3"} gap-3`} aria-hidden>
          {Array.from({ length: isWorker ? 5 : 3 }, (_, i) => <div key={i} className="h-[120px] rounded-2xl bg-gray-200/70 dark:bg-gray-800/70 animate-pulse" />)}
        </div>
      )}
    </section>
  );
  const sekcijaPlan = (
    plan && (isWorker
      ? <MojPlan red={mojPlan} godina={danasD.getFullYear()} />
      : <PlanTima redovi={plan} godina={danasD.getFullYear()} />)
  );
  const sekcijaOdjeli = (
    odjeliRezime.length > 0 && (
      <section aria-labelledby="odjeli-naslov">
        <SectionTitle id="odjeli-naslov" title={isWorker ? "Moji odjeli" : "Aktivnost po odjelima"} meta={mesec} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {odjeliRezime.map((o) => <OdjelCard key={o.odjelId} odjel={o} />)}
          <UkupnoOdjeliCard odjeli={odjeliRezime} />
        </div>
      </section>
    )
  );
  const sekcijaBrzi = (
    <section aria-labelledby="stranice-naslov">
      <SectionTitle id="stranice-naslov" title="Brzi pristup" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
        {linkovi.map((l) => (
          <Link key={l.href + l.label} href={l.href}
            className="group flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3.5 py-3 hover:border-green-600/60 hover:shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600">
            <span className="w-9 h-9 flex-shrink-0 rounded-xl bg-green-50 dark:bg-green-950/60 text-green-800 dark:text-green-300 flex items-center justify-center group-hover:bg-green-100 dark:group-hover:bg-green-900/60 transition-colors">
              <Icon name={l.icon} className="w-[18px] h-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{l.label}</span>
              <span className="block text-[11px] leading-snug text-gray-500 dark:text-gray-400 truncate">{l.desc}</span>
            </span>
            <Icon name="arrow" className="w-3.5 h-3.5 flex-shrink-0 text-gray-300 dark:text-gray-600 group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors" />
          </Link>
        ))}
      </div>
    </section>
  );

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-green-700 via-green-800 to-green-950 text-white shadow-sm ring-1 ring-green-950/20">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-14 h-56 w-56 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute right-28 -bottom-20 h-44 w-44 rounded-full bg-white/5" />
        <div className="relative flex flex-wrap items-end gap-x-6 gap-y-4 px-5 py-5 sm:px-7 sm:py-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-green-200/90">{fmtDateLong(localDateStr(danasD))}</p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">{session.fullName || session.ime}</h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-green-50 ring-1 ring-white/15">{uloga}</span>
              {isWorker && danasUpisan !== null && jeRadniDan(danasStr) && (
                danasUpisan
                  ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-2.5 py-1 text-xs font-medium text-emerald-50 ring-1 ring-emerald-300/30">✓ Današnji dan je upisan</span>
                  : <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-2.5 py-1 text-xs font-medium text-amber-50 ring-1 ring-amber-300/30">Današnji dan još nije upisan</span>
              )}
              {kasniBroj !== null && (
                kasniBroj === 0
                  ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-2.5 py-1 text-xs font-medium text-emerald-50 ring-1 ring-emerald-300/30">✓ Svi projektanti ažurni</span>
                  : <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-2.5 py-1 text-xs font-medium text-amber-50 ring-1 ring-amber-300/30">{kasniBroj} {kasniBroj === 1 ? "projektant kasni" : "projektanata kasni"} s unosom</span>
              )}
            </div>
          </div>
          <Link href={nav.cta.href}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-green-800 shadow-sm transition hover:bg-green-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-green-800">
            <Icon name={nav.cta.icon} className="h-4 w-4" />
            {nav.cta.label}
            <Icon name="arrow" className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {greska && (
        <div role="status" className="rounded-lg px-4 py-2.5 text-sm border bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
          Dio podataka nije učitan — provjeri internet. Stranica se osvježava sama kad veza proradi.
        </div>
      )}

      {isWorker && <ObavijestGO korisnik={korisnik} period={goPer} />}

      {isWorker
        ? <MojZadnjiDan zadnji={zadnji} />
        : <ZadnjiDanTim zadnji={zadnji} projektanti={projektanti} />}

      {isWorker && (
        <div className={`grid gap-6 ${imaGoUgovor ? "lg:grid-cols-[3fr_2fr]" : ""} items-start`}>
          <MojMjesec unosi={mjesecUnosi} danas={danasD} href={nav.cta.href} />
          {imaGoUgovor && korisnik && <MojGO korisnik={korisnik} unosi={goUnosi} period={goPer} />}
        </div>
      )}

      {isWorker ? (
        <>{sekcijaRezime}{sekcijaPlan}{sekcijaOdjeli}{sekcijaBrzi}</>
      ) : (
        // admin: aktivnost po odjelima odmah ispod zadnjih dana, plan doznake na kraju
        <>{sekcijaOdjeli}{sekcijaRezime}{sekcijaBrzi}{sekcijaPlan}</>
      )}
    </div>
  );
}

function SectionTitle({ id, title, meta, action }: { id: string; title: string; meta?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span aria-hidden className="h-4 w-1 rounded-full bg-green-600 dark:bg-green-500" />
      <h2 id={id} className="flex items-baseline gap-2 text-[15px] font-bold text-gray-800 dark:text-gray-100">
        {title}
        {meta && <span className="text-xs font-normal text-gray-400 dark:text-gray-500 first-letter:uppercase">{meta}</span>}
      </h2>
      {action && <span className="ml-auto">{action}</span>}
    </div>
  );
}

function DetaljnoLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 hover:underline">
      {children}<Icon name="arrow" className="w-3 h-3" />
    </Link>
  );
}

function Stat({ label, value, unit, tone, tint, icon, note, delta, className = "" }: {
  label: string; value: string; unit: string; tone: string; tint: string; icon: IconName; note?: string; delta?: ReactNode; className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 sm:p-4 shadow-sm ${className}`}>
      <div className="flex items-center gap-2">
        <span className={`hidden sm:flex h-7 w-7 items-center justify-center rounded-lg ${tint}`}><Icon name={icon} className="h-4 w-4" /></span>
        <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <div className={`mt-2.5 text-2xl sm:text-3xl font-bold tabular-nums leading-none ${tone}`}>
        {value}<span className="ml-1 text-sm font-medium text-gray-400 dark:text-gray-500">{unit}</span>
      </div>
      {note && <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">{note}</div>}
      {delta && <div className="mt-1.5 text-[11px] font-medium tabular-nums">{delta}</div>}
    </div>
  );
}

function VrstaBadge({ u }: { u: UnosRada }) {
  const s = vrsta(u.vrsta);
  const odjel = u.odjel ? `${u.odjel.gj}/${u.odjel.broj}` : "";
  const ucinak = ucinakLabel(u);
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${s.badge}`}>
      <span className="font-bold">{s.abbr}</span>
      {[odjel, ucinak].filter(Boolean).join(" · ")}
    </span>
  );
}

const DANI_KRATKO = ["ned", "pon", "uto", "sri", "čet", "pet", "sub"];

function uDatum(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "danas" / "jučer" / "pet 25.09." */
function danLabel(iso: string, danas: Date): string {
  const dt = uDatum(iso);
  const pocetak = new Date(danas.getFullYear(), danas.getMonth(), danas.getDate());
  // round: dan prelaska na ljetno/zimsko vrijeme ima 23 ili 25 sati
  const razlika = Math.round((pocetak.getTime() - dt.getTime()) / 86_400_000);
  if (razlika === 0) return "danas";
  if (razlika === 1) return "jučer";
  return `${DANI_KRATKO[dt.getDay()]} ${fmtDateShort(iso)}`;
}

/** Zadnji radni dan (pon–pet) prije `danas` */
function prethodniRadniDan(danas: Date): string {
  const d = new Date(danas.getFullYear(), danas.getMonth(), danas.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return localDateStr(d);
}

const DANA_UNAZAD = 60;

const inicijali = (k: Korisnik) => (k.fullName || k.ime).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function ZadnjiDanTim({ zadnji, projektanti }: { zadnji: Record<string, ZadnjiDan> | null; projektanti: Korisnik[] }) {
  if (!zadnji || projektanti.length === 0) return null;
  const danas = new Date();
  const granica = prethodniRadniDan(danas);
  const kasni = (k: Korisnik) => (zadnji[k.id]?.datum ?? "") < granica;
  // najstariji zadnji unos prvi — to su oni koje treba provjeriti
  const redovi = [...projektanti].sort((a, b) => (zadnji[a.id]?.datum ?? "").localeCompare(zadnji[b.id]?.datum ?? ""));
  const brojKasni = projektanti.filter(kasni).length;

  return (
    <section aria-labelledby="zadnji-naslov">
      <SectionTitle id="zadnji-naslov" title="Zadnji uneseni dan"
        meta={brojKasni > 0 ? `${brojKasni} od ${projektanti.length} kasni s unosom` : "svi ažurni"}
        action={<DetaljnoLink href="/unos-ucinka">Unos učinka</DetaljnoLink>} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {redovi.map((k) => {
          const z = zadnji[k.id];
          const zakasnio = kasni(k);
          return (
            <div key={k.id} className={`rounded-2xl border px-3 py-3 flex flex-col gap-2 shadow-sm ${
              zakasnio
                ? "border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
                : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
            }`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span aria-hidden className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  zakasnio ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200" : "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200"
                }`}>{inicijali(k)}</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{k.fullName || k.ime}</span>
                {z && (
                  <span className={`ml-auto flex-shrink-0 text-xs tabular-nums ${
                    zakasnio ? "font-semibold text-amber-700 dark:text-amber-400" : "text-gray-500 dark:text-gray-400"
                  }`}>{zakasnio && "⏱ "}{danLabel(z.datum, danas)}</span>
                )}
              </div>
              {z ? (
                <div className="flex flex-wrap gap-1">{z.unosi.map((u) => <VrstaBadge key={u.id} u={u} />)}</div>
              ) : (
                <div className="text-xs text-amber-700 dark:text-amber-400">Nema unosa u zadnjih {DANA_UNAZAD} dana</div>
              )}
            </div>
          );
        })}
      </div>
      {brojKasni > 0 && (
        <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
          Kasni: zadnji unos je stariji od prethodnog radnog dana ({fmtDateShort(granica)}).
        </p>
      )}
    </section>
  );
}

function MojZadnjiDan({ zadnji }: { zadnji: Record<string, ZadnjiDan> | null }) {
  if (!zadnji) return null;
  // legacy inzinjer id-evi daju više ključeva — uzima se najnoviji dan
  const z = Object.values(zadnji).reduce<ZadnjiDan | null>((a, b) => (!a || b.datum > a.datum ? b : a), null);
  return (
    <section aria-labelledby="zadnji-naslov">
      <SectionTitle id="zadnji-naslov" title="Zadnji uneseni dan" meta={z ? danLabel(z.datum, new Date()) : undefined} />
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
        {z ? (
          <div className="flex flex-wrap gap-1.5">{z.unosi.map((u) => <VrstaBadge key={u.id} u={u} />)}</div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">Nema unosa u zadnjih {DANA_UNAZAD} dana.</p>
        )}
      </div>
    </section>
  );
}

const bojaTrake = (pct: number) =>
  pct >= 100 ? "bg-green-700 dark:bg-green-500" : pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-orange-400";

function ProgressBar({ pct, visina = "h-2" }: { pct: number; visina?: string }) {
  return (
    <div className={`${visina} w-full rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden`}
      role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all duration-500 ${bojaTrake(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function postotak(odradjeno: number, plan: number) {
  return plan > 0 ? (odradjeno / plan) * 100 : 0;
}

function MojPlan({ red, godina }: { red?: PlanProjektantRed; godina: number }) {
  if (!red) return null;
  const pct = postotak(red.odradjeno, red.planHa);
  const preostalo = Math.max(red.planHa - red.odradjeno, 0);
  return (
    <section aria-labelledby="plan-naslov">
      <SectionTitle id="plan-naslov" title="Moj plan doznake" meta={String(godina)} />
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3 shadow-sm">
        {red.planHa > 0 ? (
          <>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold tabular-nums text-green-700 dark:text-green-400">{fmtBroj(red.odradjeno)}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">od {fmtBroj(red.planHa, 1)} ha</span>
              <span className="ml-auto text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-200">{Math.round(pct)}%</span>
            </div>
            <ProgressBar pct={pct} />
            <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
              {preostalo > 0 ? `Preostalo ${fmtBroj(preostalo)} ha` : "Plan ispunjen"}
              {red.odradjenoKm > 0 && ` · vlake ${fmtBroj(red.odradjenoKm)} km`}
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Plan za {godina}. nije postavljen · odrađeno <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-200">{fmtBroj(red.odradjeno)} ha</span>
          </p>
        )}
      </div>
    </section>
  );
}

function PlanTima({ redovi, godina }: { redovi: PlanProjektantRed[]; godina: number }) {
  const aktivni = redovi.filter((r) => r.planHa > 0 || r.odradjeno > 0);
  if (aktivni.length === 0) return null;
  const plan = aktivni.reduce((s, r) => s + r.planHa, 0);
  const odradjeno = aktivni.reduce((s, r) => s + r.odradjeno, 0);
  const pct = postotak(odradjeno, plan);

  return (
    <section aria-labelledby="plan-naslov">
      <SectionTitle id="plan-naslov" title="Plan doznake" meta={String(godina)}
        action={<DetaljnoLink href="/realizacija">Realizacija</DetaljnoLink>} />
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800 shadow-sm">
        <div className="p-4 space-y-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-bold tabular-nums text-green-700 dark:text-green-400">{fmtBroj(odradjeno)}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
              {plan > 0 ? `od ${fmtBroj(plan, 1)} ha` : "ha · plan nije postavljen"}
            </span>
            {plan > 0 && <span className="ml-auto text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-200">{Math.round(pct)}%</span>}
          </div>
          {plan > 0 && <ProgressBar pct={pct} />}
        </div>
        <ul className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
          {aktivni.map((r) => {
            const p = postotak(r.odradjeno, r.planHa);
            return (
              <li key={r.korisnikId} className="space-y-1">
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="font-medium text-gray-800 dark:text-gray-100 truncate">{r.ime}</span>
                  <span className="ml-auto text-xs tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {fmtBroj(r.odradjeno)}{r.planHa > 0 ? ` / ${fmtBroj(r.planHa, 1)} ha · ${Math.round(p)}%` : " ha · bez plana"}
                  </span>
                </div>
                {r.planHa > 0 && <ProgressBar pct={p} visina="h-1.5" />}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function UkupnoOdjeliCard({ odjeli }: { odjeli: OdjelMjesecRezime[] }) {
  const ha = odjeli.reduce((s, o) => s + o.ha, 0);
  const stabala = odjeli.reduce((s, o) => s + o.stabala, 0);
  const km = odjeli.reduce((s, o) => s + o.km, 0);
  return (
    <div className="rounded-2xl border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/60 p-3 flex flex-col gap-2">
      <div>
        <div className="text-[10px] text-green-700 dark:text-green-400 leading-snug">{odjeli.length} {odjeli.length === 1 ? "odjel" : "odjela"}</div>
        <div className="font-bold text-sm text-green-900 dark:text-green-100 leading-snug">Ukupno</div>
      </div>
      <div className="text-[11px] space-y-0.5 tabular-nums font-semibold text-green-900 dark:text-green-100">
        {ha > 0 && <div>{fmtBroj(ha)} ha</div>}
        {stabala > 0 && <div>{fmtBroj(stabala, 0)} st</div>}
        {km > 0 && <div>{fmtBroj(km)} km</div>}
      </div>
    </div>
  );
}

const DANI_ZAGLAVLJE = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];

function MojMjesec({ unosi, danas, href }: { unosi: UnosRada[] | null; danas: Date; href: string }) {
  const god = danas.getFullYear();
  const mj = danas.getMonth();
  const danasStr = localDateStr(danas);
  const poDanu = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const u of unosi ?? []) {
      const d = u.datum.slice(0, 10);
      m.set(d, [...(m.get(d) ?? []), u.vrsta]);
    }
    return m;
  }, [unosi]);

  const brojDana = new Date(god, mj + 1, 0).getDate();
  const pomak = (new Date(god, mj, 1).getDay() + 6) % 7;
  const datumi = Array.from({ length: brojDana }, (_, i) => localDateStr(new Date(god, mj, i + 1)));
  const propusteno = datumi.filter((d) => d < danasStr && jeRadniDan(d) && !poDanu.has(d)).length;
  const prisutne = [...new Set([...poDanu.values()].flat())];

  return (
    <section aria-labelledby="mjesec-naslov">
      <SectionTitle id="mjesec-naslov" title="Moj mjesec" meta={mesecLabel(danas)} />
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
        {unosi === null ? (
          <div className="h-[220px] rounded-xl bg-gray-200/70 dark:bg-gray-800/70 animate-pulse" aria-hidden />
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {DANI_ZAGLAVLJE.map((d, i) => (
                <div key={d} className={`text-[10px] font-semibold uppercase tracking-wide ${i > 4 ? "text-gray-300 dark:text-gray-600" : "text-gray-400 dark:text-gray-500"}`}>{d}</div>
              ))}
              {Array.from({ length: pomak }, (_, i) => <div key={`p${i}`} aria-hidden />)}
              {datumi.map((d, i) => {
                const vrste = poDanu.get(d);
                const radni = jeRadniDan(d);
                const jeDanas = d === danasStr;
                const fali = !vrste && radni && d < danasStr;
                const stil = vrste
                  ? vrsta(vrste[0]).badge
                  : fali
                    ? "border border-dashed border-amber-400 text-amber-700 dark:text-amber-400"
                    : radni
                      ? "text-gray-600 dark:text-gray-300"
                      : "text-gray-300 dark:text-gray-600";
                const opis = [
                  `${i + 1}.`,
                  praznik(d),
                  vrste?.map((v) => vrsta(v).label).join(", "),
                  fali ? "nema unosa" : null,
                ].filter(Boolean).join(" — ");
                return (
                  <div key={d} title={opis} aria-label={opis}
                    className={`flex aspect-square sm:aspect-auto sm:h-10 items-center justify-center rounded-lg text-xs font-semibold tabular-nums ${stil} ${
                      jeDanas ? "ring-2 ring-green-600 dark:ring-green-400 ring-offset-1 ring-offset-white dark:ring-offset-gray-900" : ""
                    }`}>
                    {i + 1}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {prisutne.map((v) => {
                const s = vrsta(v);
                return (
                  <span key={v} className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                    <span className={`h-2.5 w-2.5 rounded-sm ${s.dot}`} />{s.label}
                  </span>
                );
              })}
              <span className="ml-auto text-xs tabular-nums">
                {propusteno > 0 ? (
                  <Link href={href} className="font-semibold text-amber-700 dark:text-amber-400 hover:underline">
                    Nedostaje {propusteno} {propusteno === 1 ? "radni dan" : "radnih dana"} →
                  </Link>
                ) : (
                  <span className="text-green-700 dark:text-green-400 font-medium">✓ Svi radni dani su upisani</span>
                )}
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function MojGO({ korisnik, unosi, period }: { korisnik: Korisnik; unosi: UnosRada[] | null; period: GoPeriod }) {
  const ugovor = korisnik.goDanaPoUgovoru?.[String(period.godina)] ?? 0;
  const iskoristeno = unosi ? iskoristenoDanaGO(unosi, period) : null;
  const preostalo = iskoristeno === null ? null : ugovor - iskoristeno;
  const pct = iskoristeno === null || ugovor <= 0 ? 0 : (iskoristeno / ugovor) * 100;
  return (
    <section aria-labelledby="go-naslov">
      <SectionTitle id="go-naslov" title="Godišnji odmor" meta={period.label}
        action={<DetaljnoLink href="/sihtarica">Šihtarica</DetaljnoLink>} />
      <div className="rounded-2xl border border-sky-200 dark:border-sky-900 bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/40 dark:to-gray-900 p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <GoBroj label="Po ugovoru" value={String(ugovor)} tone="text-gray-800 dark:text-gray-100" />
          <GoBroj label="Iskorišteno" value={iskoristeno === null ? "…" : String(iskoristeno)} tone="text-sky-700 dark:text-sky-300" />
          <GoBroj label="Preostalo" value={preostalo === null ? "…" : String(preostalo)}
            tone={preostalo !== null && preostalo < 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"} />
        </div>
        <div className="h-2 rounded-full bg-sky-100 dark:bg-sky-900/50 overflow-hidden" role="progressbar"
          aria-valuemin={0} aria-valuemax={ugovor} aria-valuenow={iskoristeno ?? 0}>
          <div className={`h-full rounded-full transition-all duration-500 ${preostalo !== null && preostalo < 0 ? "bg-red-500" : "bg-sky-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          {preostalo !== null && preostalo < 0
            ? `Prekoračeno za ${-preostalo} ${-preostalo === 1 ? "dan" : "dana"}.`
            : "Troše se samo radni dani; važi od 1. jula."}
        </p>
      </div>
    </section>
  );
}

function GoBroj({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

function ObavijestGO({ korisnik, period }: {
  korisnik: Korisnik | null;
  period: GoPeriod;
}) {
  const key = String(period.godina);
  const lijepo = period.label;

  if (!korisnik) return null;
  const ima = !!(korisnik.goDanaPoUgovoru?.[key] ?? 0);
  if (ima) return null;
  return (
    <div role="status" className="rounded-lg px-4 py-3 text-sm border bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-3">
      <span className="mt-0.5 text-base flex-shrink-0">📋</span>
      <div>
        <p className="font-medium">Upiši broj dana godišnjeg odmora po ugovoru</p>
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
          Za period GO {lijepo} još nisi upisao/la broj dana iz ugovora.{" "}
          <Link href="/sihtarica" className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100">
            Idi na šihtaricu
          </Link>{" "}
          i upiši u polju &quot;Dana po ugovoru&quot;.
        </p>
      </div>
    </div>
  );
}

function OdjelCard({ odjel }: { odjel: OdjelMjesecRezime }) {
  return (
    <Link href={`/odjel/?id=${encodeURIComponent(odjel.odjelId)}`}
      className="group rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 flex flex-col gap-2 shadow-sm hover:border-green-600/60 hover:shadow transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
      aria-label={`Pregled odjela ${odjel.gj} / ${odjel.broj}`}>
      <div className="flex items-start gap-1 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 truncate leading-snug">{odjel.gj}</div>
          <div className="text-xl font-extrabold font-mono tabular-nums leading-tight text-gray-900 dark:text-gray-50">{odjel.broj}</div>
        </div>
        <Icon name="arrow" className="mt-0.5 w-3.5 h-3.5 flex-shrink-0 text-gray-300 dark:text-gray-600 group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors" />
      </div>
      <div className="flex flex-wrap gap-1">
        {odjel.vrste.map((v) => {
          const s = vrsta(v);
          return <span key={v} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.badge}`}>{s.abbr}</span>;
        })}
      </div>
      <div className="text-[11px] text-gray-500 dark:text-gray-400 space-y-0.5 tabular-nums">
        {odjel.ha > 0 && <div className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">{fmtBroj(odjel.ha)} ha</div>}
        {odjel.stabala > 0 && <div>{fmtBroj(odjel.stabala, 0)} st</div>}
        {odjel.km > 0 && <div>{fmtBroj(odjel.km)} km</div>}
        <div className="text-gray-400 dark:text-gray-500">{odjel.dani} {odjel.dani === 1 ? "dan" : "dana"} rada</div>
      </div>
    </Link>
  );
}
