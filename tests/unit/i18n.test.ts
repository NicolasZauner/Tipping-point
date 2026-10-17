import { describe, expect, it } from "vitest";
import { de } from "../../src/i18n/de";
import { en } from "../../src/i18n/en";
import { formatNumber, translate } from "../../src/i18n";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("i18n", () => {
  it("German and English have exactly the same keys", () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  });

  it("every translation keeps the same placeholders", () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(de[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it("no string is empty", () => {
    for (const s of [...Object.values(en), ...Object.values(de)]) expect(s.trim()).not.toBe("");
  });

  it("fills placeholders and leaves unknown ones visible", () => {
    expect(translate("en", "spike.worker", { draws: 200 })).toBe("Seeded Monte Carlo, 200 draws");
    expect(translate("en", "spike.worker")).toContain("{draws}");
  });

  it("formats numbers per language", () => {
    expect(formatNumber("en", 0.84134, 4)).toBe("0.8413");
    expect(formatNumber("de", 0.84134, 4)).toBe("0,8413");
  });
});
