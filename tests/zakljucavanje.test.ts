import { describe, expect, it } from "vitest";
import { jeZakljucan, prviOtkljucaniDan } from "../lib/zakljucavanje";

describe("zaključavanje mjeseci", () => {
  it("zaključava odabrani i sve starije mjesece", () => {
    expect(jeZakljucan("2026-08-31", "2026-09")).toBe(true);
    expect(jeZakljucan("2026-09-15", "2026-09")).toBe(true);
    expect(jeZakljucan("2026-10-01", "2026-09")).toBe(false);
  });

  it("ispravno prelazi u novu godinu", () => {
    expect(prviOtkljucaniDan("2026-12")).toBe("2027-01-01");
  });
});
