import { describe, expect, it } from "vitest";
import { runSpike } from "../../src/worker/spike";

const clock = () => 0;

describe("worker spike", () => {
  it("estimates Φ(1) within three standard errors and repeats exactly for a seed", () => {
    const req = { kind: "spike", seed: 20261017, draws: 50_000 } as const;
    const a = runSpike(req, "worker", clock);
    const b = runSpike(req, "main thread", clock);
    const se = Math.sqrt((a.exact * (1 - a.exact)) / req.draws);
    expect(Math.abs(a.estimate - a.exact)).toBeLessThan(3 * se);
    expect(b.estimate).toBe(a.estimate);
    expect(a.exact).toBeCloseTo(0.8413447460685429, 14);
  });
});
