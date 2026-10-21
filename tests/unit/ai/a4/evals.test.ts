import { describe, expect, it } from "vitest";
import { parsePastedSegments } from "../../../../src/ai/a4/input";
import { defaultMapping } from "../../../../src/ai/a4/mapper";
import { A4_EVAL_CASES, dominantClass, scoreCase, summarise } from "../../../../src/ai/a4/evals";

const byId = (id: string) => {
  const c = A4_EVAL_CASES.find((x) => x.id === id);
  if (!c) throw new Error(`no case ${id}`);
  return c;
};

describe("A4 eval set", () => {
  it("every expected label is a row the parser produces", () => {
    for (const c of A4_EVAL_CASES) {
      const labels = parsePastedSegments(c.paste).rows.map((r) => r.label);
      expect(labels.sort()).toEqual(Object.keys(c.expected).sort());
    }
  });

  it("the KBA default mapping scores 14 of 14 (the fallback is right by construction)", () => {
    const c = byId("kba");
    const d = defaultMapping(parsePastedSegments(c.paste));
    expect(scoreCase(c, d.rows, null)).toMatchObject({ right: 14, total: 14, wrong: [] });
  });

  it("the premium override alone gets the BMW and the Plaid right in the model list", () => {
    const c = byId("models");
    const d = defaultMapping(parsePastedSegments(c.paste));
    const s = scoreCase(c, d.rows, null);
    expect(s.wrong.map((w) => w.label)).not.toContain("BMW iX1 xDrive30");
    expect(s.wrong.map((w) => w.label)).not.toContain("Tesla Model S Plaid");
  });

  it("picks the largest weight, ties to the first class in order", () => {
    expect(dominantClass({ large: 0.8, premium: 0.2 })).toBe("large");
    expect(dominantClass({ medium: 0.5, large: 0.5 })).toBe("medium");
    expect(dominantClass({})).toBeNull();
  });

  it("summarises with a Wilson interval and the 90% target", () => {
    const s = summarise([{ id: "a", right: 45, total: 46, reconciled: true, wrong: [] }]);
    expect(s.passed).toBe(true);
    expect(s.low).toBeGreaterThan(0.85);
    expect(summarise([{ id: "a", right: 40, total: 46, reconciled: true, wrong: [] }]).passed).toBe(
      false,
    );
    expect(
      summarise([{ id: "a", right: 46, total: 46, reconciled: false, wrong: [] }]).passed,
    ).toBe(false);
  });
});
