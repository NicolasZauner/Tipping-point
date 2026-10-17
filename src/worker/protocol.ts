// Messages between the page and the model worker. Plain data only, so the same functions can
// also run on the main thread when a frame refuses workers.

export type SpikeRequest = { kind: "spike"; seed: number; draws: number };
export type SpikeResult = {
  kind: "spike";
  /** Share of seeded standard-normal draws at or below 1; should land near Φ(1) = 0.8413. */
  estimate: number;
  /** The exact value, for comparison. */
  exact: number;
  draws: number;
  millis: number;
  where: "worker" | "main thread";
};
