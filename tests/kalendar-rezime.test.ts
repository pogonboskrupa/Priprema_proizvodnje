import { describe, expect, it } from "vitest";
import { computeRecap } from "../lib/kalendar-rezime";
import type { UnosRada } from "../lib/types";

const unos = (vrijednosti: Partial<UnosRada>): UnosRada => ({
  id: "id",
  datum: "2026-09-01",
  vrsta: "DOZNAKA",
  inzinjerId: "radnik",
  odjelId: "odjel",
  createdAt: "2026-09-01",
  updatedAt: "2026-09-01",
  ...vrijednosti,
});

describe("rekapitulacija kalendara", () => {
  it("zbraja učinak, ali dane deduplicira", () => {
    const rezultat = computeRecap([
      unos({ id: "1", hektari: 1.5, brojStabala: 100 }),
      unos({ id: "2", hektari: 0.5, brojStabala: 50 }),
      unos({ id: "3", datum: "2026-09-02", vrsta: "VLAKA", kilometri: 1.2 }),
    ]);
    expect(rezultat.totalDays).toBe(2);
    expect(rezultat.byVrsta.DOZNAKA.days.size).toBe(1);
    expect(rezultat.byVrsta.DOZNAKA.ha).toBe(2);
    expect(rezultat.byVrsta.DOZNAKA.stabala).toBe(150);
    expect(rezultat.byVrsta.VLAKA.km).toBe(1.2);
  });
});
