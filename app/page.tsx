"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function Home() {
  const { session, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !session) router.replace("/login/");
  }, [session, loading]);

  if (loading || !session) return null;

  return (
    <div className="py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">
        Šumska Priprema Proizvodnje
      </h1>
      <p className="text-gray-500 mb-10">
        Evidencija učinka inžinjera po šumskim odjelima
      </p>

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
          desc="Sedmično, mjesečno i godišnje po radniku i odjelu"
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
              desc="Upravljanje radnicima"
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
