import { describe, expect, it } from "vitest";
import { jeKonflikt, zabranaUpisa } from "../lib/sihtarica";

describe("pravila dnevnog unosa", () => {
  it("dopušta više doznaka i vlaka istog dana", () => {
    expect(zabranaUpisa("2026-09-01", [{ vrsta: "DOZNAKA" }], "DOZNAKA")).toBeNull();
    expect(zabranaUpisa("2026-09-01", [{ vrsta: "DOZNAKA" }], "VLAKA")).toBeNull();
  });

  it("ne miješa prisustvo s drugim aktivnostima", () => {
    expect(zabranaUpisa("2026-09-01", [{ vrsta: "DOZNAKA" }], "TEREN")).toContain("doznaka ili vlaka");
    expect(zabranaUpisa("2026-09-01", [{ vrsta: "GODISNJI" }], "DOZNAKA")).toContain("jedan tip aktivnosti");
    expect(jeKonflikt([{ vrsta: "GODISNJI" }, { vrsta: "TEREN" }])).toBe(true);
  });
});
