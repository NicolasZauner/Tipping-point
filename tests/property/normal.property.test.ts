import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { normalCdf, normalQuantile } from "../../src/model/normal";

const z = fc.double({ min: -7, max: 7, noNaN: true });

describe("normal distribution (property)", () => {
  it("Φ is symmetric: Φ(z) + Φ(−z) = 1", () => {
    fc.assert(
      fc.property(z, (x) => {
        expect(Math.abs(normalCdf(x) + normalCdf(-x) - 1)).toBeLessThan(1e-14);
      }),
      { numRuns: 2000 },
    );
  });

  it("Φ never decreases", () => {
    fc.assert(
      fc.property(z, z, (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(normalCdf(lo)).toBeLessThanOrEqual(normalCdf(hi));
      }),
      { numRuns: 2000 },
    );
  });

  it("Φ⁻¹ inverts Φ", () => {
    fc.assert(
      fc.property(fc.double({ min: -6, max: 6, noNaN: true }), (x) => {
        expect(Math.abs(normalQuantile(normalCdf(x)) - x)).toBeLessThan(1e-8);
      }),
      { numRuns: 2000 },
    );
  });
});
