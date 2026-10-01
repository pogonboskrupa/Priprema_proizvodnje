import { describe, expect, it } from "vitest";
import { localDateStr, parseCount, parseDecimal } from "../lib/format";

describe("unos brojčanih vrijednosti", () => {
  it("prihvata domaći decimalni zapis", () => {
    expect(parseDecimal("1.234,5")).toBe(1234.5);
    expect(parseDecimal("12.5")).toBe(12.5);
    expect(parseDecimal("")).toBeNull();
  });

  it("odbija negativne i neispravne vrijednosti", () => {
    expect(parseDecimal("-1")).toBeNaN();
    expect(parseCount("12a")).toBeNaN();
  });

  it("formatira lokalni datum bez UTC pomaka", () => {
    expect(localDateStr(new Date(2026, 0, 2, 1, 30))).toBe("2026-01-02");
  });
});
