import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAPPINGS,
  applyPremiumOverride,
  checkWeights,
  reconcile,
  type MappingRow,
} from "../../src/model/classMapping";

const row = (source: string, weights: MappingRow["weights"]): MappingRow => ({
  source,
  weights,
  reason: "",
  confidence: "high",
  origin: "default",
});

describe("default mappings", () => {
  it("maps every KBA segment, with utilities and motorhomes out of scope", () => {
    const kba = DEFAULT_MAPPINGS.kba.rows;
    const of = (s: string) => kba.find((r) => r.source === s)?.weights;
    expect(of("Kleinwagen")).toEqual({ small: 1 });
    expect(of("Mittelklasse")).toEqual({ medium: 1 });
    expect(of("SUVs")).toEqual({ large: 1 });
    expect(of("Oberklasse")).toEqual({ premium: 1 });
    expect(of("Wohnmobile")).toEqual({ "out-of-scope": 1 });
    expect(kba).toHaveLength(14);
  });

  it("every default row passes the weight check", () => {
    for (const m of Object.values(DEFAULT_MAPPINGS))
      for (const r of m.rows) expect(checkWeights(r.weights)).toBeNull();
  });
});

describe("checkWeights", () => {
  it("needs weights in [0, 1] that sum to 1", () => {
    expect(checkWeights({ large: 0.8, premium: 0.2 })).toBeNull();
    expect(checkWeights({ large: 0.8, premium: 0.1 })).toMatch(/sum/);
    expect(checkWeights({ large: 1.2, premium: -0.2 })).toMatch(/between 0 and 1/);
    expect(checkWeights({})).toMatch(/sum/);
  });
});

describe("premium override", () => {
  it("moves a premium brand or a price of €60,000 or more to premium, Tesla by price only", () => {
    const rows = [
      row("BMW iX1 xDrive30", { large: 1 }),
      row("Tesla Model Y", { large: 1 }),
      row("Tesla Model S Plaid", { premium: 0.5, large: 0.5 }),
      row("VW ID.3", { medium: 1 }),
      row("Wohnmobile", { "out-of-scope": 1 }),
    ];
    const info = new Map([
      ["Tesla Model Y", { price: 44990 }],
      ["Tesla Model S Plaid", { price: 109990 }],
      ["VW ID.3", { price: 59999 }],
    ]);
    const out = applyPremiumOverride(rows, info);
    expect(out.map((r) => r.weights)).toEqual([
      { premium: 1 },
      { large: 1 },
      { premium: 1 },
      { medium: 1 },
      { "out-of-scope": 1 },
    ]);
    expect(out[0]?.override).toBe("brand");
    expect(out[2]?.override).toBe("price");
    expect(out[1]?.override).toBeUndefined();
  });

  it("is exactly at the threshold: €60,000 counts as premium", () => {
    const out = applyPremiumOverride(
      [row("Skoda Enyaq", { large: 1 })],
      new Map([["Skoda Enyaq", { price: 60000 }]]),
    );
    expect(out[0]?.weights).toEqual({ premium: 1 });
  });

  it("doesn't take a brand name out of a longer word", () => {
    const out = applyPremiumOverride([row("Audience Van", { medium: 1 })], new Map());
    expect(out[0]?.weights).toEqual({ medium: 1 });
  });
});

describe("reconcile", () => {
  it("splits volumes by weight, keeps out-of-scope apart, and matches the input total", () => {
    const rows = [
      row("SUVs", { large: 0.8, premium: 0.2 }),
      row("Wohnmobile", { "out-of-scope": 1 }),
    ];
    const r = reconcile(
      rows,
      new Map([
        ["SUVs", 1000],
        ["Wohnmobile", 50],
      ]),
    );
    expect(r.byClass).toEqual({ small: 0, medium: 0, large: 800, premium: 200 });
    expect(r.outOfScope).toBe(50);
    expect(r.inputTotal).toBe(1050);
    expect(r.ok).toBe(true);
  });

  it("fails when a row with volume has no mapping", () => {
    const r = reconcile(
      [row("SUVs", { large: 1 })],
      new Map([
        ["SUVs", 1000],
        ["Pick-ups", 40],
      ]),
    );
    expect(r.ok).toBe(false);
    expect(r.unmapped).toEqual(["Pick-ups"]);
  });
});
