"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getMjesecniRezime } from "@/lib/db";

type Rezime = {
  ha: number; stabala: number; km: number;
  godisnji: number; kancelarija: number; bolovanje: number; teren: number; ukupno: number;
};

export default function Home() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [rezime, setRezime] = useState<Rezime | null>(null);

  useEffect(() => {
    if (!loading && !session) router.replace("/login/");
  }, [session, loading]);

  useEffect(() => {
    if (session) getMjesecniRezime().then((r) => setRezime(r as Rezime)).catch(() => {});
  }, [session]);

  if (loading || !session) return null;

  const odsustva = rezime ? (rezime.godisnji + rezime.kancelarija + rezime.bolovanje) : 0;
  const mesec = new Date().toLocaleString("bs-BA", { month: "long", year: "numeric" });

  return (
    <div className="py-8">
      <div className="mb-6">
        <h1
          className="inline-block text-3xl font-extrabold tracking-tight mb-1"
          style={{
            background: "linear-gradient(135deg, #14532d 0%, #166534 60%, #15803d 100%)",
            color: "#fff",
            padding: "6px 20px 8px",
            borderRadius: 10,
            letterSpacing: "-0.01em",
          }}
        >
          Priprema Proizvodnje
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Evidencija učinka projektanata po odjelima</p>
      </div>

      {rezime && (
        <div className="mb-8">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 capitalize">
            {mesec}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <MiniStat label="Hektara" value={rezime.ha.toFixed(2)} unit="ha" color="green" />
            <MiniStat label="Stabala" value={rezime.stabala.toString()} unit="st" color="emerald" />
            <MiniStat label="Vlake" value={rezime.km.toFixed(2)} unit="km" color="amber" />
            <MiniStat label="Teren" value={rezime.teren.toString()} unit="dana" color="orange" />
            <MiniStat label="Odsustva" value={odsustva.toString()} unit="dana" color="sky" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickCard
          href="/unos"
          icon="📋"
          title="Unos rada"
          desc="Doznaka stabala ili projektovanje vlaka"
          color="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900"
        />
        <QuickCard
          href="/izvjestaji"
          icon="📊"
          title="Izvještaji"
          desc="Sedmično, mjesečno i godišnje po projektantu i odjelu"
          color="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900"
        />
        {session.role === "admin" && (
          <>
            <QuickCard
              href="/odjeli"
              icon="🗺️"
              title="Odjeli"
              desc="Upravljanje odjelima i površinama"
              color="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900"
            />
            <QuickCard
              href="/inzinjeri"
              icon="👷"
              title="Projektanti"
              desc="Upravljanje projektantima i nalozima"
              color="bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900"
            />
            <QuickCard
              href="/plan"
              icon="📅"
              title="Plan sječe"
              desc="Godišnji plan i realizacija po odjelima"
              color="bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900"
            />
            <QuickCard
              href="/realizacija"
              icon="📈"
              title="Realizacija"
              desc="Praćenje napretka realizacije plana"
              color="bg-teal-50 dark:bg-teal-950 border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900"
            />
          </>
        )}
        <QuickCard
          href="/postavke"
          icon="⚙️"
          title="Postavke"
          desc="Profil, PIN i upravljanje korisnicima"
          color="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
        />
      </div>
    </div>
  );
}

function MiniStat({
  label, value, unit, color,
}: {
  label: string; value: string; unit: string;
  color: "green" | "emerald" | "amber" | "sky" | "orange";
}) {
  const styles = {
    green:   { card: "bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-800",   label: "text-green-800 dark:text-green-200",   value: "text-green-900 dark:text-green-100",   unit: "text-green-700 dark:text-green-300" },
    emerald: { card: "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800", label: "text-emerald-800 dark:text-emerald-200", value: "text-emerald-900 dark:text-emerald-100", unit: "text-emerald-700 dark:text-emerald-300" },
    amber:   { card: "bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800",   label: "text-amber-900 dark:text-amber-200",   value: "text-amber-950 dark:text-amber-100",   unit: "text-amber-800 dark:text-amber-300" },
    sky:     { card: "bg-sky-50 dark:bg-sky-950 border-sky-300 dark:border-sky-800",       label: "text-sky-800 dark:text-sky-200",     value: "text-sky-900 dark:text-sky-100",     unit: "text-sky-700 dark:text-sky-300" },
    orange:  { card: "bg-orange-50 dark:bg-orange-950 border-orange-300 dark:border-orange-800", label: "text-orange-800 dark:text-orange-200",  value: "text-orange-900 dark:text-orange-100",  unit: "text-orange-700 dark:text-orange-300" },
  }[color];
  return (
    <div className={`rounded-xl border p-4 ${styles.card}`}>
      <div className={`text-xs font-semibold mb-1 ${styles.label}`}>{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${styles.value}`}>{value}</div>
      <div className={`text-xs mt-0.5 font-medium ${styles.unit}`}>{unit}</div>
    </div>
  );
}

function QuickCard({
  href,
  icon,
  title,
  desc,
  color,
}: {
  href: string;
  icon: string;
  title: string;
  desc: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-xl border-2 shadow-sm p-5 transition-colors ${color}`}
    >
      <div className="text-3xl mb-2">{icon}</div>
      <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">{title}</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300">{desc}</p>
    </Link>
  );
}
