/// <reference lib="webworker" />
import type { SpikeRequest } from "./protocol";
import { runSpike } from "./spike";

// Entry point for heavy model runs (Monte Carlo, calibration). P1 only answers the spike.
self.onmessage = (event: MessageEvent<SpikeRequest>) => {
  const req = event.data;
  if (req?.kind === "spike") {
    self.postMessage(runSpike(req, "worker", () => performance.now()));
  }
};
