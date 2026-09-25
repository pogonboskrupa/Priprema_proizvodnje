"use client";
import { useEffect, useRef, useState } from "react";
import { useNetStatus } from "@/hooks/useNetStatus";

type Phase = "offline" | "syncing" | "synced" | "idle";

export default function OfflineBanner() {
  const { online, pending } = useNetStatus();
  const [phase, setPhase] = useState<Phase>("idle");
  const wasSyncingRef = useRef(false);

  useEffect(() => {
    if (!online) {
      setPhase("offline");
      wasSyncingRef.current = false;
      return;
    }
    if (pending > 0) {
      setPhase("syncing");
      wasSyncingRef.current = true;
      return;
    }
    // pending === 0 && online
    if (wasSyncingRef.current) {
      wasSyncingRef.current = false;
      setPhase("synced");
      const t = setTimeout(() => setPhase("idle"), 3000);
      return () => clearTimeout(t);
    }
    setPhase("idle");
  }, [online, pending]);

  if (phase === "idle") return null;

  const configs = {
    offline: {
      bg: "bg-amber-500",
      icon: "⚡",
      text: "Offline — unosi se čuvaju lokalno",
    },
    syncing: {
      bg: "bg-blue-600",
      icon: "↻",
      text: "Slanje podataka...",
    },
    synced: {
      bg: "bg-green-600",
      icon: "✓",
      text: "Sinhronizovano",
    },
  } as const;

  const cfg = configs[phase as keyof typeof configs];

  return (
    <div
      className={`
        fixed z-[80]
        bottom-[calc(3.6rem+env(safe-area-inset-bottom,0px))]
        md:bottom-5 md:right-5 md:left-auto md:translate-x-0
        left-1/2 -translate-x-1/2
        ${cfg.bg} text-white
        px-4 py-2 rounded-xl shadow-lg
        flex items-center gap-2.5 text-sm font-medium
        whitespace-nowrap
        transition-all duration-300
      `}
    >
      <span className={phase === "syncing" ? "inline-block animate-spin" : ""}>{cfg.icon}</span>
      <span>{cfg.text}</span>
      {pending > 1 && phase === "syncing" && (
        <span className="bg-white/20 rounded-full px-1.5 py-0 text-xs">{pending}</span>
      )}
    </div>
  );
}
