import type { Korisnik, UnosRada } from "./types";

export type VrstaStats = { days: Set<string>; ha: number; stabala: number; km: number };

export interface KalendarRezime {
  byVrsta: Record<string, VrstaStats>;
  totalDays: number;
}

export interface WorkerRecapRow {
  id: string;
  name: string;
  totalDays: number;
  doz: number;
  vl: number;
  ter: number;
  kan: number;
  god: number;
  bol: number;
  ha: number;
  stabala: number;
  km: number;
}

export function computeRecap(unosi: readonly UnosRada[]): KalendarRezime {
  const byVrsta: Record<string, VrstaStats> = {};
  const totalDates = new Set<string>();
  for (const u of unosi) {
    const datum = u.datum.slice(0, 10);
    if (!datum) continue;
    const stats = (byVrsta[u.vrsta] ??= { days: new Set(), ha: 0, stabala: 0, km: 0 });
    stats.days.add(datum);
    totalDates.add(datum);
    if (u.vrsta === "DOZNAKA") {
      stats.ha += Number(u.hektari) || 0;
      stats.stabala += Number(u.brojStabala) || 0;
    } else if (u.vrsta === "VLAKA") {
      stats.km += Number(u.kilometri) || 0;
    }
  }
  return { byVrsta, totalDays: totalDates.size };
}

export function computeAllWorkersRecap(
  allUnosi: readonly UnosRada[],
  workers: readonly Korisnik[],
): WorkerRecapRow[] {
  type Acc = {
    total: Set<string>; doz: Set<string>; vl: Set<string>; ter: Set<string>;
    kan: Set<string>; god: Set<string>; bol: Set<string>;
    ha: number; stabala: number; km: number;
  };
  const empty = (): Acc => ({
    total: new Set(), doz: new Set(), vl: new Set(), ter: new Set(),
    kan: new Set(), god: new Set(), bol: new Set(), ha: 0, stabala: 0, km: 0,
  });
  const map = Object.fromEntries(workers.map((worker) => [worker.id, empty()]));

  for (const u of allUnosi) {
    const acc = map[u.inzinjerId];
    if (!acc) continue;
    const datum = u.datum.slice(0, 10);
    if (!datum) continue;
    acc.total.add(datum);
    switch (u.vrsta) {
      case "DOZNAKA":
        acc.doz.add(datum);
        acc.ha += Number(u.hektari) || 0;
        acc.stabala += Number(u.brojStabala) || 0;
        break;
      case "VLAKA": acc.vl.add(datum); acc.km += Number(u.kilometri) || 0; break;
      case "TEREN": acc.ter.add(datum); break;
      case "KANCELARIJA": acc.kan.add(datum); break;
      case "GODISNJI": acc.god.add(datum); break;
      case "BOLOVANJE": acc.bol.add(datum); break;
    }
  }

  return workers
    .map((worker) => {
      const acc = map[worker.id];
      return {
        id: worker.id,
        name: worker.fullName || worker.ime,
        totalDays: acc.total.size,
        doz: acc.doz.size,
        vl: acc.vl.size,
        ter: acc.ter.size,
        kan: acc.kan.size,
        god: acc.god.size,
        bol: acc.bol.size,
        ha: acc.ha,
        stabala: acc.stabala,
        km: acc.km,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
