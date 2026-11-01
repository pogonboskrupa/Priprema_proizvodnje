import { jeRadniDan } from "@/lib/praznici";
import { localDateStr } from "@/lib/format";

/**
 * Radni dani tekućeg mjeseca prije danas koji nemaju nijedan unos (najstariji prvi).
 * Današnji dan se ne računa — još se može upisati.
 */
export function nedostajuciRadniDani(unosi: readonly { datum: string }[], danas: Date): string[] {
  const upisani = new Set(unosi.map((u) => u.datum.slice(0, 10)));
  const danasStr = localDateStr(danas);
  const brojDana = new Date(danas.getFullYear(), danas.getMonth() + 1, 0).getDate();
  return Array.from({ length: brojDana }, (_, i) => localDateStr(new Date(danas.getFullYear(), danas.getMonth(), i + 1)))
    .filter((d) => d < danasStr && jeRadniDan(d) && !upisani.has(d));
}
