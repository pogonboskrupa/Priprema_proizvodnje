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
    <div
      className="-mx-4 -my-6 flex flex-col"
      style={{ height: "calc(100dvh - 3.5rem)", minHeight: "calc(100vh - 3.5rem)" }}
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 bg-green-50 dark:bg-green-950/40 border-b border-green-200 dark:border-green-800 flex-shrink-0">
        <span className="text-sm font-medium text-green-800 dark:text-green-200 leading-snug">
          Elaborat — Drvna masa, sjekored i prirast po odsjecima
        </span>
        <a
          href={ELABORAT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-200 underline underline-offset-2 flex-shrink-0"
        >
          Otvori u novom tabu ↗
        </a>
      </div>

      {/* Iframe fills all remaining space */}
      <iframe
        src={ELABORAT_URL}
        title="Elaborat — Unsko Pogon gospodarenja Bos.Krupa"
        className="flex-1 w-full border-0 block"
        allow="fullscreen"
        style={{ minHeight: 0 }}
      />
    </div>
  );
}
