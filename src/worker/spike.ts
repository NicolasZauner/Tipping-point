import { normalCdf, normalQuantile } from "../model/normal";
import { createRng } from "../model/rng";
import type { SpikeRequest, SpikeResult } from "./protocol";

/**
 * The TP P1 spike: a seeded Monte Carlo estimate of Φ(1) by inverse-transform sampling. It
 * exercises the generator and the quantile the way the real Monte Carlo will, and a fixed seed
 * gives the same estimate on every machine.
 */
export function runSpike(
  req: SpikeRequest,
  where: SpikeResult["where"],
  now: () => number,
): SpikeResult {
  const t0 = now();
  const rng = createRng(req.seed);
  let below = 0;
  for (let i = 0; i < req.draws; i++) if (normalQuantile(rng.next()) <= 1) below += 1;
  return {
    kind: "spike",
    estimate: below / req.draws,
    exact: normalCdf(1),
    draws: req.draws,
    millis: now() - t0,
    where,
  };
}
