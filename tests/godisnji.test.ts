import { describe, expect, it } from "vitest";
import { goPeriod, iskoristenoDanaGO } from "../lib/godisnji";
import type { UnosRada } from "../lib/types";

const unos = (datum: string, vrsta: UnosRada["vrsta"] = "GODISNJI") => ({ datum, vrsta } as UnosRada);

describe("godišnji odmor", () => {
  it("koristi period juli–juni", () => {
    expect(goPeriod(2026, 6)).toMatchObject({ godina: 2025, od: "2025-07-01", do: "2026-06-30" });
    expect(goPeriod(2026, 7)).toMatchObject({ godina: 2026, od: "2026-07-01", do: "2027-06-30" });
  });

  it("broji svaki datum samo jednom, uključujući vikend", () => {
    const period = goPeriod(2026, 9);
    expect(iskoristenoDanaGO([
      unos("2026-09-05T08:00:00.000Z"),
      unos("2026-09-05T12:00:00.000Z"),
      unos("2026-09-06T08:00:00.000Z", "TEREN"),
    ], period)).toBe(1);
  });
});
