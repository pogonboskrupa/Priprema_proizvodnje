"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getMjesecniRezime } from "@/lib/db";

type Rezime = {
  ha: number; stabala: number; km: number;
  godisnji: number; kancelarija: number; bolovanje: number; ukupno: number;
};

export default function Home() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [rezime, setRezime] = useState<Rezime | null>(null);

  useEffect(() => {
    if (!loading && !session) router.replace("/login/");
  }, [session, loading]);

  useEffect(() => {
    if (session) getMjesecniRezime().then((r) => setRezime(r as Rezime));
  }, [session]);

  if (loading || !session) return null;

  const odsustva = rezime ? (rezime.godisnji + rezime.kancelarija + rezime.bolovanje) : 0;
  const mesec = new Date().toLocaleString("bs-BA", { month: "long", year: "numeric" });

  return (
    <div className="py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">
        Šumska Priprema Proizvodnje
      </h1>
      <p className="text-gray-500 mb-6">
        Evidencija učinka inžinjera po šumskim odjelima
      </p>

      {rezime && (
        <div className="mb-8">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 capitalize">
            {mesec}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat label="Hektara" value={rezime.ha.toFixed(2)} unit="ha" color="green" />
            <MiniStat label="Stabala" value={rezime.stabala.toString()} unit="st" color="emerald" />
            <MiniStat label="Vlake" value={rezime.km.toFixed(2)} unit="km" color="amber" />
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
          color="bg-blue-50 border-blue-200 hover:bg-blue-100"
        />
        <QuickCard
          href="/izvjestaji"
          icon="📊"
          title="Izvještaji"
          desc="Sedmično, mjesečno i godišnje po projektantu i odjelu"
          color="bg-green-50 border-green-200 hover:bg-green-100"
        />
        {session.role === "admin" && (
          <>
            <QuickCard
              href="/odjeli"
              icon="🗺️"
              title="Šumski odjeli"
              desc="Upravljanje odjelima i površinama"
              color="bg-yellow-50 border-yellow-200 hover:bg-yellow-100"
            />
            <QuickCard
              href="/inzinjeri"
              icon="👷"
              title="Inžinjeri"
              desc="Upravljanje projektantima"
              color="bg-purple-50 border-purple-200 hover:bg-purple-100"
            />
            <QuickCard
              href="/plan"
              icon="📅"
              title="Plan sječe"
              desc="Godišnji plan i realizacija po odjelima"
              color="bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
            />
            <QuickCard
              href="/realizacija"
              icon="📈"
              title="Realizacija"
              desc="Praćenje napretka realizacije plana"
              color="bg-teal-50 border-teal-200 hover:bg-teal-100"
            />
          </>
        )}
        <QuickCard
          href="/postavke"
          icon="⚙️"
          title="Postavke"
          desc="Profil, PIN i upravljanje korisnicima"
          color="bg-gray-50 border-gray-200 hover:bg-gray-100"
        />
      </div>
    </div>
  );
}

function MiniStat({
  label, value, unit, color,
}: {
  label: string; value: string; unit: string;
  color: "green" | "emerald" | "amber" | "sky";
}) {
  const c = {
    green: "bg-green-50 border-green-200 text-green-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    sky: "bg-sky-50 border-sky-200 text-sky-700",
  }[color];
  return (
    <div className={`rounded-xl border p-4 ${c}`}>
      <div className="text-xs font-medium opacity-75 mb-1">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs opacity-60 mt-0.5">{unit}</div>
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
      className={`block rounded-xl border-2 p-5 transition-colors ${color}`}
    >
      <div className="text-3xl mb-2">{icon}</div>
      <h2 className="font-semibold text-gray-800 mb-1">{title}</h2>
      <p className="text-sm text-gray-600">{desc}</p>
    </Link>
  );
}
