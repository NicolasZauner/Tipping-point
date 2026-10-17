import { describe, expect, it } from "vitest";
import { erfc, normalCdf, normalPdf, normalQuantile } from "../../src/model/normal";

// Reference values: mpmath at 30 digits, rounded to double.
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);

describe("normalCdf", () => {
  const cases: [number, number][] = [
    [0, 0.5],
    [0.5, 0.6914624612740131],
    [1, 0.8413447460685429],
    [1.96, 0.9750021048517795],
    [-1.96, 0.024997895148220435],
    [2.5, 0.9937903346742238],
    [3, 0.9986501019683699],
    [-3, 0.0013498980316300946],
    [-5, 2.866515718791939e-7],
    [-8, 6.220960574271786e-16],
  ];
  it.each(cases)("Φ(%d) matches the reference", (z, want) => {
    expect(rel(normalCdf(z), want)).toBeLessThan(1e-11);
  });

  it("saturates without NaN in the far tails", () => {
    expect(normalCdf(40)).toBe(1);
    expect(normalCdf(-40)).toBeGreaterThanOrEqual(0);
    expect(normalCdf(-40)).toBeLessThan(1e-300);
    expect(Number.isNaN(normalCdf(Number.NaN))).toBe(true);
  });
});

describe("erfc", () => {
  const cases: [number, number][] = [
    [0, 1],
    [0.5, 0.4795001221869535],
    [2, 0.004677734981047266],
    [2.999, 2.2230168599834058e-5],
    [3, 2.209049699858544e-5],
    [4, 1.541725790028002e-8],
    [-1, 1.8427007929497148],
  ];
  it.each(cases)("erfc(%d) matches the reference", (x, want) => {
    expect(rel(erfc(x), want)).toBeLessThan(1e-11);
  });
});

describe("normalPdf", () => {
  it("peaks at 1/√(2π) and is symmetric", () => {
    expect(normalPdf(0)).toBeCloseTo(0.3989422804014327, 15);
    expect(normalPdf(1.3)).toBe(normalPdf(-1.3));
  });
});

describe("normalQuantile", () => {
  const cases: [number, number][] = [
    [0.5, 0],
    [0.975, 1.959963984540054],
    [0.9, 1.2815515655446004],
    [0.01, -2.3263478740408408],
    [0.02425, -1.9729610513118849],
    [1e-10, -6.361340902404056],
  ];
  it.each(cases)("Φ⁻¹(%d) matches the reference", (p, want) => {
    expect(Math.abs(normalQuantile(p) - want)).toBeLessThan(1e-9);
  });

  it.each([0, 1, -0.1, 1.1, Number.NaN])("rejects p = %d", (p) => {
    expect(() => normalQuantile(p)).toThrow(RangeError);
  });
});
