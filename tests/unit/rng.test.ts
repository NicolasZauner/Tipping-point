import { describe, expect, it } from "vitest";
import { createRng } from "../../src/model/rng";

const draw = (seed: number, n: number) => {
  const r = createRng(seed);
  return Array.from({ length: n }, () => r.next());
};

describe("seeded generator", () => {
  it("repeats exactly for the same seed", () => {
    expect(draw(42, 1000)).toEqual(draw(42, 1000));
  });

  it("differs for neighbouring seeds", () => {
    const a = draw(1, 50);
    const b = draw(2, 50);
    expect(a.filter((x, i) => x === b[i]).length).toBe(0);
  });

  it("stays strictly inside (0, 1), including for seed 0", () => {
    for (const seed of [0, 1, -1, 2 ** 31, 123456789]) {
      for (const x of draw(seed, 20_000)) {
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(1);
      }
    }
  });

  it("looks uniform: mean near 1/2, variance near 1/12, every decile filled", () => {
    const xs = draw(7, 200_000);
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length;
    expect(Math.abs(mean - 0.5)).toBeLessThan(0.005);
    expect(Math.abs(variance - 1 / 12)).toBeLessThan(0.002);
    const bins = new Array<number>(10).fill(0);
    for (const x of xs) {
      const i = Math.floor(x * 10);
      bins[i] = (bins[i] ?? 0) + 1;
    }
    for (const count of bins) expect(Math.abs(count - 20_000)).toBeLessThan(1_000);
  });

  it("rejects a non-integer seed", () => {
    expect(() => createRng(1.5)).toThrow(RangeError);
  });
});
