"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  getRezimeZaPeriod, getRezimePoOdjelima, getInzinjeriByKorisnikId, getGodisnjePlanPoProjektantu,
  getZadnjiDanPoProjektantu, getKorisnici, tekuciMjesec,
  type OdjelMjesecRezime, type MjesecniRezime, type PlanProjektantRed, type ZadnjiDan,
} from "@/lib/db";
import type { Korisnik, UnosRada } from "@/lib/types";
import { mesecLabel, fmtDateLong, fmtDateShort, localDateStr } from "@/lib/format";
import { fmtBroj, ucinakLabel } from "@/lib/sihtarica";
import { prosliMjesecDoDanas } from "@/lib/usporedba";
import { navFor } from "@/lib/nav";
import { Icon } from "@/components/Icon";
import { Delta } from "@/components/Delta";
import { useUnosiRefresh } from "@/hooks/useUnosiRefresh";
import { vrsta } from "@/lib/vrste";

export default function Home() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [rezime, setRezime] = useState<MjesecniRezime | null>(null);
  const [prosli, setProsli] = useState<MjesecniRezime | null>(null);
  const [odjeliRezime, setOdjeliRezime] = useState<OdjelMjesecRezime[]>([]);
  const [plan, setPlan] = useState<PlanProjektantRed[] | null>(null);
  const [zadnji, setZadnji] = useState<Record<string, ZadnjiDan> | null>(null);
  const [projektanti, setProjektanti] = useState<Korisnik[]>([]);
  const [greska, setGreska] = useState(false);
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
    });
    if (!isWorker) {
      getKorisnici().then((k) => kad(setProjektanti)(k.filter((x) => x.role === "worker"))).catch(pad);
    }
    return () => { cancelled = true; };
  }, [session, isWorker, refreshTick]);

  if (loading || !session) return null;

  const danasD = new Date();
  const mesec = mesecLabel(danasD);
  const nav = navFor(session);
  const uloga = session.role === "admin" ? "Administrator" : session.operater ? "Projektant · operater" : "Projektant";
  const linkovi = nav.all.filter((l) => l.href !== "/");
  const { doDana } = prosliMjesecDoDanas(danasD);
  const mojPlan = plan?.find((r) => r.korisnikId === session.userId);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Početna</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          <span className="capitalize">{fmtDateLong(localDateStr(danasD))}</span> · {uloga}
        </p>
      </header>

      {greska && (
        <div role="status" className="rounded-lg px-4 py-2.5 text-sm border bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
          Dio podataka nije učitan — provjeri internet. Stranica se osvježava sama kad veza proradi.
        </div>
      )}

      {isWorker
        ? <MojZadnjiDan zadnji={zadnji} />
        : <ZadnjiDanTim zadnji={zadnji} projektanti={projektanti} />}

      <section aria-labelledby="rezime-naslov">
        <SectionTitle id="rezime-naslov" title={isWorker ? "Moj učinak" : "Svi projektanti"} meta={mesec} />
        {rezime ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-200 dark:bg-gray-800">
              <Stat label="Doznaka" value={fmtBroj(rezime.ha)} unit="ha" tone="text-green-700 dark:text-green-400"
                delta={prosli && <Delta cur={rezime.ha} prev={prosli.ha} />} />
              <Stat label="Stabala" value={fmtBroj(rezime.stabala, 0)} unit="st." tone="text-emerald-700 dark:text-emerald-400"
                delta={prosli && <Delta cur={rezime.stabala} prev={prosli.stabala} dec={0} />} />
              <Stat label="Vlake" value={fmtBroj(rezime.km)} unit="km" tone="text-amber-600 dark:text-amber-400"
                delta={prosli && <Delta cur={rezime.km} prev={prosli.km} />} />
              <Stat label="Radni dani" value={String(rezime.radniDani)} unit="dana" tone="text-gray-900 dark:text-gray-50"
                delta={prosli && <Delta cur={rezime.radniDani} prev={prosli.radniDani} dec={0} />} />
              <Stat label="Odsustva" value={String(rezime.godisnji + rezime.bolovanje)} unit="dana"
                tone="text-sky-700 dark:text-sky-400" note={`GO ${rezime.godisnji} · bol. ${rezime.bolovanje}`}
                className="col-span-2 lg:col-span-1" />
            </div>
            {prosli && (
              <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
                Strelice: razlika u odnosu na 1.–{doDana}. prošlog mjeseca (isti dio mjeseca).
              </p>
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => <div key={i} className="h-[112px] rounded-2xl bg-gray-200/70 dark:bg-gray-800/70 animate-pulse" />)}
          </div>
        )}
      </section>

      {plan && (isWorker
        ? <MojPlan red={mojPlan} godina={danasD.getFullYear()} />
        : <PlanTima redovi={plan} godina={danasD.getFullYear()} />)}

      {odjeliRezime.length > 0 && (
        <section aria-labelledby="odjeli-naslov">
          <SectionTitle id="odjeli-naslov" title={isWorker ? "Moji odjeli" : "Aktivnost po odjelima"} meta={mesec} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {odjeliRezime.map((o) => <OdjelCard key={o.odjelId} odjel={o} />)}
          </div>
        </section>
      )}

      <section aria-labelledby="stranice-naslov">
        <SectionTitle id="stranice-naslov" title="Brzi pristup" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {linkovi.map((l) => (
            <Link key={l.href} href={l.href} title={l.desc}
              className="group flex items-center gap-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 hover:border-green-600/60 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600">
              <span className="w-8 h-8 flex-shrink-0 rounded-lg bg-green-50 dark:bg-green-950/60 text-green-800 dark:text-green-300 flex items-center justify-center">
                <Icon name={l.icon} className="w-4 h-4" />
              </span>
              <span className="min-w-0 text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{l.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ id, title, meta, action }: { id: string; title: string; meta?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <h2 id={id} className="flex items-baseline gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
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

function Stat({ label, value, unit, tone, note, delta, className = "" }: {
  label: string; value: string; unit: string; tone: string; note?: string; delta?: ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white dark:bg-gray-900 p-4 ${className}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>
        {value}<span className="ml-1 text-sm font-medium text-gray-400 dark:text-gray-500">{unit}</span>
      </div>
      {note && <div className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">{note}</div>}
      {delta && <div className="mt-0.5 text-[11px] font-medium tabular-nums">{delta}</div>}
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
            <div key={k.id} className={`rounded-xl border px-3 py-2.5 flex flex-col gap-1.5 ${
              zakasnio
                ? "border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
                : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
            }`}>
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{k.fullName || k.ime}</span>
                {z && (
                  <span className={`ml-auto flex-shrink-0 text-xs tabular-nums ${
                    zakasnio ? "font-semibold text-amber-700 dark:text-amber-400" : "text-gray-500 dark:text-gray-400"
                  }`}>{danLabel(z.datum, danas)}</span>
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

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden"
      role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-green-600 dark:bg-green-500" style={{ width: `${Math.min(pct, 100)}%` }} />
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
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
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
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
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
                {r.planHa > 0 && <ProgressBar pct={p} />}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function OdjelCard({ odjel }: { odjel: OdjelMjesecRezime }) {
  return (
    <Link href={`/odjel/?id=${encodeURIComponent(odjel.odjelId)}`}
      className="group rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 flex flex-col gap-2 hover:border-green-600/60 hover:shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
      aria-label={`Pregled odjela ${odjel.gj} / ${odjel.broj}`}>
      <div className="flex items-start gap-1 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate leading-snug">{odjel.gj}</div>
          <div className="font-semibold text-sm text-gray-800 dark:text-gray-100 leading-snug">Odj. {odjel.broj}</div>
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
        {odjel.ha > 0 && <div>{fmtBroj(odjel.ha)} ha</div>}
        {odjel.stabala > 0 && <div>{fmtBroj(odjel.stabala, 0)} st</div>}
        {odjel.km > 0 && <div>{fmtBroj(odjel.km)} km</div>}
        <div className="text-gray-400 dark:text-gray-500">{odjel.dani} {odjel.dani === 1 ? "dan" : "dana"} rada</div>
      </div>
    </Link>
  );
}
