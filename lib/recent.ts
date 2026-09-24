import type { Odjel, UnosRada } from "@/lib/types";
import { cmpOdjel } from "@/lib/format";

export function recentOdjelIdsByInzinjer(unosi: UnosRada[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const seen = new Set<string>();
  const sorted = [...unosi].sort((a, b) => b.datum.localeCompare(a.datum));
  for (const u of sorted) {
    if (!u.odjelId) continue;
    const key = `${u.inzinjerId}|${u.odjelId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const list = result.get(u.inzinjerId);
    if (list) list.push(u.odjelId);
    else result.set(u.inzinjerId, [u.odjelId]);
  }
  return result;
}


export function splitOdjeliByRecent(
  odjeli: Odjel[],
  recentIds: readonly string[]
): { recent: Odjel[]; rest: Odjel[] } {
  const byId = new Map(odjeli.map((o) => [o.id, o]));
  const recent = recentIds.flatMap((id) => byId.get(id) ?? []);
  const recentSet = new Set(recent.map((o) => o.id));
  const rest = odjeli.filter((o) => !recentSet.has(o.id)).sort(cmpOdjel);
  return { recent, rest };
}
