import type { VrstaRada } from "@/lib/types";

export interface VrstaStyle {
  label: string;
  short: string;
  abbr: string;
  emoji: string;
  dot: string;
  badge: string;
  btnActive: string;
  text: string;
  borderL: string;
  /** Pozadina ćelije po intenzitetu: [1–2, 3–5, 6+] */
  heat: readonly [string, string, string];
}

// Tailwind klase moraju biti pune literale da ih JIT pronađe
export const VRSTA: Record<VrstaRada, VrstaStyle> = {
  DOZNAKA: {
    label: "Doznaka", short: "Doz", abbr: "DOZ", emoji: "🌳",
    dot: "bg-green-500",
    badge: "bg-green-100 dark:bg-green-900/60 text-green-800 dark:text-green-200",
    btnActive: "bg-green-600 text-white border-green-600",
    text: "text-green-700 dark:text-green-300",
    borderL: "border-l-green-500",
    heat: ["bg-green-50 dark:bg-green-950/40", "bg-green-100 dark:bg-green-900/60", "bg-green-200 dark:bg-green-800/80"],
  },
  VLAKA: {
    label: "Vlaka", short: "Vl", abbr: "VLK", emoji: "🛤️",
    dot: "bg-amber-500",
    badge: "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200",
    btnActive: "bg-amber-500 text-white border-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    borderL: "border-l-amber-500",
    heat: ["bg-amber-50 dark:bg-amber-950/40", "bg-amber-100 dark:bg-amber-900/60", "bg-amber-200 dark:bg-amber-800/80"],
  },
  TEREN: {
    label: "Teren", short: "Ter", abbr: "TER", emoji: "🥾",
    dot: "bg-orange-500",
    badge: "bg-orange-100 dark:bg-orange-900/60 text-orange-800 dark:text-orange-200",
    btnActive: "bg-orange-500 text-white border-orange-500",
    text: "text-orange-700 dark:text-orange-300",
    borderL: "border-l-orange-500",
    heat: ["bg-orange-50 dark:bg-orange-950/40", "bg-orange-100 dark:bg-orange-900/60", "bg-orange-200 dark:bg-orange-800/80"],
  },
  KANCELARIJA: {
    label: "Kancelarija", short: "Kan", abbr: "KAN", emoji: "🏢",
    dot: "bg-violet-500",
    badge: "bg-violet-100 dark:bg-violet-900/60 text-violet-800 dark:text-violet-200",
    btnActive: "bg-violet-500 text-white border-violet-500",
    text: "text-violet-700 dark:text-violet-300",
    borderL: "border-l-violet-500",
    heat: ["bg-violet-50 dark:bg-violet-950/40", "bg-violet-100 dark:bg-violet-900/60", "bg-violet-200 dark:bg-violet-800/80"],
  },
  GODISNJI: {
    label: "Godišnji", short: "God", abbr: "GOD", emoji: "🏖️",
    dot: "bg-sky-500",
    badge: "bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200",
    btnActive: "bg-sky-500 text-white border-sky-500",
    text: "text-sky-700 dark:text-sky-300",
    borderL: "border-l-sky-500",
    heat: ["bg-sky-50 dark:bg-sky-950/40", "bg-sky-100 dark:bg-sky-900/60", "bg-sky-200 dark:bg-sky-800/80"],
  },
  BOLOVANJE: {
    label: "Bolovanje", short: "Bol", abbr: "BOL", emoji: "🏥",
    dot: "bg-red-500",
    badge: "bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200",
    btnActive: "bg-red-500 text-white border-red-500",
    text: "text-red-700 dark:text-red-300",
    borderL: "border-l-red-500",
    heat: ["bg-red-50 dark:bg-red-950/40", "bg-red-100 dark:bg-red-900/60", "bg-red-200 dark:bg-red-800/80"],
  },
};

export const VRSTE: readonly VrstaRada[] = ["DOZNAKA", "VLAKA", "TEREN", "KANCELARIJA", "GODISNJI", "BOLOVANJE"];

const FALLBACK: VrstaStyle = {
  label: "–", short: "?", abbr: "?", emoji: "",
  dot: "bg-gray-400",
  badge: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200",
  btnActive: "bg-gray-500 text-white border-gray-500",
  text: "text-gray-600 dark:text-gray-300",
  borderL: "border-l-gray-400",
  heat: ["bg-gray-50 dark:bg-gray-800/40", "bg-gray-100 dark:bg-gray-800/60", "bg-gray-200 dark:bg-gray-700/80"],
};

export function vrsta(v: string): VrstaStyle {
  return VRSTA[v as VrstaRada] ?? { ...FALLBACK, label: v, short: v, abbr: v };
}

export function heatClass(v: VrstaRada, n: number): string {
  if (n <= 0) return "";
  const [low, mid, high] = VRSTA[v].heat;
  return n <= 2 ? low : n <= 5 ? mid : high;
}
