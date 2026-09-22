"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const ELABORAT_URL = "https://pogonboskrupa.github.io/Pregled_po_odsjecima/";

export default function ElaboratPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !session) router.replace("/login/");
  }, [session, authLoading]);

  if (authLoading || !session) return null;

  return (
    <div className="-mx-4 -my-6 flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      <div className="flex items-center justify-between px-4 py-2 bg-green-50 border-b border-green-200 flex-shrink-0">
        <span className="text-sm font-medium text-green-800">
          Elaborat — Drvna masa, sjekored i prirast po odsjecima
        </span>
        <a
          href={ELABORAT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-green-700 hover:text-green-900 underline underline-offset-2"
        >
          Otvori u novom tabu ↗
        </a>
      </div>
      <iframe
        src={ELABORAT_URL}
        title="Elaborat — Unsko Pogon gospodarenja Bos.Krupa"
        className="flex-1 w-full border-0"
        allow="fullscreen"
      />
    </div>
  );
}
