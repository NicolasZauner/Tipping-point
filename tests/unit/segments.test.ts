import { describe, expect, it } from "vitest";
import { ADOPTER_GROUPS } from "../../src/domain/types";
import { TIMEFRAME_ANSWERS, type TimeframeCounts } from "../../src/domain/survey";
import { GROUP_MAPPINGS, groupSizes, wilson } from "../../src/model/segments";

// Germany, EAFO Consumer Monitor 2023, non-BEV drivers (n = 1,698 answered)
const de: TimeframeCounts = {
  "Yes, within 0-2 years": 157,
  "Yes, within 2-3 years": 240,
  "Yes, within 3-5 years": 226,
  "Yes, within 5-10 years": 145,
  "Yes, but without time frame in mind": 151,
  "I don’t know": 291,
  No: 488,
};

const inn = { value: 0.029, low: 0.0232, high: 0.033 };

describe("group mappings", () => {
  it.each(Object.entries(GROUP_MAPPINGS))("%s puts every answer in exactly one group", (_, m) => {
    const placed = Object.values(m.groups).flat();
    expect([...placed].sort()).toEqual([...TIMEFRAME_ANSWERS].sort());
    expect(Object.keys(m.groups)).toEqual(ADOPTER_GROUPS.slice(1));
  });
});

describe("wilson", () => {
  it("matches the textbook interval", () => {
    // 50 of 100 at 95%: 0.4038 to 0.5962
    const w = wilson(50, 100, 1);
    expect(w.low).toBeCloseTo(0.40383, 4);
    expect(w.high).toBeCloseTo(0.59617, 4);
  });

  it("stays inside [0, 1] at the edges and widens with a design effect", () => {
    expect(wilson(0, 40, 1).low).toBe(0);
    expect(wilson(40, 40, 1).high).toBe(1);
    const a = wilson(30, 100, 1);
    const b = wilson(30, 100, 1.5);
    expect(b.high - b.low).toBeGreaterThan(a.high - a.low);
  });

  it("rejects impossible counts", () => {
    expect(() => wilson(5, 0, 1)).toThrow();
    expect(() => wilson(6, 5, 1)).toThrow();
    expect(() => wilson(1, 5, 0.5)).toThrow();
  });
});

describe("groupSizes", () => {
  it("reproduces Germany under the timeframe ladder", () => {
    const g = groupSizes(de, inn, GROUP_MAPPINGS.ladder, 1.5);
    expect(g.n).toBe(1698);
    expect(g.sizes.innovators.value).toBe(0.029);
    expect(g.sizes["early-adopters"].value).toBeCloseTo((0.971 * 397) / 1698, 12);
    expect(g.sizes["early-majority"].value).toBeCloseTo((0.971 * 371) / 1698, 12);
    expect(g.sizes["late-majority"].value).toBeCloseTo((0.971 * 442) / 1698, 12);
    expect(g.sizes.laggards.value).toBeCloseTo((0.971 * 488) / 1698, 12);
  });

  it.each(Object.keys(GROUP_MAPPINGS) as (keyof typeof GROUP_MAPPINGS)[])(
    "sizes sum to 1 and every interval holds its value (%s)",
    (k) => {
      const g = groupSizes(de, inn, GROUP_MAPPINGS[k], 1.5);
      const sum = ADOPTER_GROUPS.reduce((s, a) => s + g.sizes[a].value, 0);
      expect(sum).toBeCloseTo(1, 12);
      for (const a of ADOPTER_GROUPS) {
        const s = g.sizes[a];
        expect(s.low).toBeLessThanOrEqual(s.value);
        expect(s.value).toBeLessThanOrEqual(s.high);
      }
    },
  );

  it("rejects an innovator share outside (0, 1) and an empty survey", () => {
    expect(() => groupSizes(de, { value: 1, low: 1, high: 1 }, GROUP_MAPPINGS.ladder, 1)).toThrow();
    expect(() =>
      groupSizes(de, { value: -0.1, low: -0.1, high: 0 }, GROUP_MAPPINGS.ladder, 1),
    ).toThrow();
    const empty = Object.fromEntries(TIMEFRAME_ANSWERS.map((a) => [a, 0])) as TimeframeCounts;
    expect(() =>
      groupSizes(de, { value: 0.04, low: 0.03, high: 0.035 }, GROUP_MAPPINGS.ladder, 1),
    ).toThrow();
    expect(() => groupSizes(empty, inn, GROUP_MAPPINGS.ladder, 1)).toThrow();
  });

  it("is the same answer whatever order the counts come in", () => {
    const reversed = Object.fromEntries(Object.entries(de).reverse()) as TimeframeCounts;
    expect(groupSizes(reversed, inn, GROUP_MAPPINGS.ladder, 1.5)).toEqual(
      groupSizes(de, inn, GROUP_MAPPINGS.ladder, 1.5),
    );
  });
});
