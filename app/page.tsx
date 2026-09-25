"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getMjesecniRezime, getMjesecniRezimeMoj, getInzinjeriByKorisnikId, getMjesecniRezimePoOdjelima, type OdjelMjesecRezime, type MjesecniRezime } from "@/lib/db";
import { mesecLabel, fmtDateLong, localDateStr } from "@/lib/format";
import { fmtBroj } from "@/lib/sihtarica";
import { navFor } from "@/lib/nav";
import { Icon } from "@/components/Icon";
import { vrsta } from "@/lib/vrste";

type Rezime = MjesecniRezime;

export default function Home() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [rezime, setRezime] = useState<Rezime | null>(null);
  const [myRezime, setMyRezime] = useState<Rezime | null>(null);
  const [odjeliRezime, setOdjeliRezime] = useState<OdjelMjesecRezime[]>([]);
  const isWorker = session?.role === "worker";

  useEffect(() => {
    if (!loading && !session) router.replace("/login/");
  }, [session, loading]);

  useEffect(() => {
    if (!session) return;
    if (!isWorker) {
      getMjesecniRezime().then(setRezime).catch(() => {});
      getMjesecniRezimePoOdjelima().then(setOdjeliRezime).catch(() => {});
    } else {
      // unosi.inzinjerId = korisnik.id; legacy unosi mogu imati inzinjer.id
      getInzinjeriByKorisnikId(session.userId)
        .catch(() => [])
        .then((inz) => {
          const ids = [session.userId, ...inz.map((i) => i.id)];
          getMjesecniRezimeMoj(ids).then(setMyRezime).catch(() => {});
          getMjesecniRezimePoOdjelima(ids).then(setOdjeliRezime).catch(() => {});
        });
    }
  }, [session, isWorker]);

  if (loading || !session) return null;

  const danas = new Date();
  const mesec = mesecLabel(danas);
  const nav = navFor(session);
  const ime = (session.fullName || session.ime).split(" ")[0];
  const sat = danas.getHours();
  const pozdrav = sat < 11 ? "Dobro jutro" : sat < 18 ? "Dobar dan" : "Dobro veče";
  const uloga = session.role === "admin" ? "Administrator" : session.operater ? "Projektant · operater" : "Projektant";

  const displayRezime = isWorker ? myRezime : rezime;
  const statsLabel = isWorker ? "Moj učinak" : "Svi projektanti";
  const linkovi = nav.all.filter((l) => l.href !== "/" && l.href !== nav.cta.href);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-green-700 dark:text-green-400 first-letter:uppercase">
          {fmtDateLong(localDateStr(danas))}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50 text-balance">
          {pozdrav}, {ime}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{uloga} · Priprema proizvodnje</p>
      </header>

      <Link href={nav.cta.href}
        className="group flex items-center gap-4 rounded-2xl bg-green-800 hover:bg-green-900 text-white p-5 shadow-sm transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-green-600/40">
        <span className="w-12 h-12 flex-shrink-0 rounded-xl bg-white/15 flex items-center justify-center">
          <Icon name={nav.cta.icon} className="w-6 h-6" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-lg font-semibold leading-tight">
            {session.role === "admin" ? "Unos učinka za danas" : "Upiši današnji rad"}
          </span>
          <span className="block text-sm text-white/70 mt-0.5">{nav.cta.desc}</span>
        </span>
        <Icon name="arrow" className="w-5 h-5 text-white/70 transition-transform group-hover:translate-x-1" />
      </Link>

      <section aria-labelledby="rezime-naslov">
        <SectionTitle id="rezime-naslov" title={statsLabel} meta={mesec} />
        {displayRezime ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-200 dark:bg-gray-800">
            <Stat label="Doznaka" value={fmtBroj(displayRezime.ha)} unit="ha" tone="text-green-700 dark:text-green-400" />
            <Stat label="Stabala" value={fmtBroj(displayRezime.stabala, 0)} unit="st." tone="text-emerald-700 dark:text-emerald-400" />
            <Stat label="Vlake" value={fmtBroj(displayRezime.km)} unit="km" tone="text-amber-600 dark:text-amber-400" />
            <Stat label="Radni dani" value={String(displayRezime.radniDani)} unit="dana" tone="text-gray-900 dark:text-gray-50" />
            <Stat label="Odsustva" value={String(displayRezime.godisnji + displayRezime.bolovanje)} unit="dana"
              tone="text-sky-700 dark:text-sky-400" note={`GO ${displayRezime.godisnji} · bol. ${displayRezime.bolovanje}`} />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => <div key={i} className="h-[92px] rounded-2xl bg-gray-200/70 dark:bg-gray-800/70 animate-pulse" />)}
          </div>
        )}
      </section>

      {odjeliRezime.length > 0 && (
        <section aria-labelledby="odjeli-naslov">
          <SectionTitle id="odjeli-naslov" title={isWorker ? "Moji odjeli" : "Aktivnost po odjelima"} meta={mesec} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {odjeliRezime.map((o) => (
              <OdjelCard key={o.odjelId} odjel={o} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="stranice-naslov">
        <SectionTitle id="stranice-naslov" title="Sve stranice" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {linkovi.map((l) => (
            <Link key={l.href} href={l.href}
              className="group flex items-start gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-green-600/60 hover:shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600">
              <span className="w-10 h-10 flex-shrink-0 rounded-xl bg-green-50 dark:bg-green-950/60 text-green-800 dark:text-green-300 flex items-center justify-center group-hover:bg-green-100 dark:group-hover:bg-green-900/60 transition-colors">
                <Icon name={l.icon} className="w-5 h-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-gray-800 dark:text-gray-100">{l.label}</span>
                <span className="block text-sm text-gray-500 dark:text-gray-400 mt-0.5">{l.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ id, title, meta }: { id: string; title: string; meta?: string }) {
  return (
    <h2 id={id} className="mb-3 flex items-baseline gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
      {title}
      {meta && <span className="text-xs font-normal text-gray-400 dark:text-gray-500 capitalize">{meta}</span>}
    </h2>
  );
}

function Stat({ label, value, unit, tone, note }: { label: string; value: string; unit: string; tone: string; note?: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>
        {value}<span className="ml-1 text-sm font-medium text-gray-400 dark:text-gray-500">{unit}</span>
      </div>
      {note && <div className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">{note}</div>}
    </div>
  );
}

function OdjelCard({ odjel }: { odjel: OdjelMjesecRezime }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 flex flex-col gap-2">
      <div className="font-semibold text-sm text-gray-800 dark:text-gray-100 leading-tight truncate">
        {odjel.gj} / {odjel.broj}
      </div>
      <div className="flex flex-wrap gap-1">
        {odjel.vrste.map((v) => {
          const s = vrsta(v);
          return (
            <span key={v} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.badge}`}>{s.abbr}</span>
          );
        })}
      </div>
      {(odjel.ha > 0 || odjel.stabala > 0 || odjel.km > 0) && (
        <div className="text-[11px] text-gray-500 dark:text-gray-400 space-y-0.5 tabular-nums">
          {odjel.ha > 0 && <div>{odjel.ha.toFixed(2)} ha</div>}
          {odjel.stabala > 0 && <div>{odjel.stabala} st</div>}
          {odjel.km > 0 && <div>{odjel.km.toFixed(2)} km</div>}
        </div>
      )}
    </div>
  );
}
