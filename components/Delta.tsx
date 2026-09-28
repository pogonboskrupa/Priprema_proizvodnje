import { fmtBroj } from "@/lib/sihtarica";

/** Razlika prema prethodnom periodu; za učinak — više je bolje */
export function Delta({ cur, prev, dec = 2 }: { cur: number; prev: number; dec?: number }) {
  const d = cur - prev;
  const naslov = `Prethodno: ${fmtBroj(prev, dec)}`;
  if (Math.abs(d) < 0.5 * 10 ** -dec) {
    return <span title={naslov} className="text-gray-400 dark:text-gray-500">= isto</span>;
  }
  const gore = d > 0;
  return (
    <span title={naslov} className={gore ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
      <span aria-hidden>{gore ? "▲" : "▼"}</span> {gore ? "+" : "−"}{fmtBroj(Math.abs(d), dec)}
    </span>
  );
}
