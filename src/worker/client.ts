import ModelWorker from "./model.worker?worker&inline";
import type { SpikeRequest, SpikeResult } from "./protocol";
import { runSpike } from "./spike";

const WORKER_TIMEOUT_MS = 8000;

/**
 * Runs the spike in a web worker started from a blob: URL. If the frame refuses the worker, or
 * it doesn't answer in time, the same function runs on the main thread, so the page always gets
 * a result and says where it came from.
 */
export function runSpikeAnywhere(req: SpikeRequest): Promise<SpikeResult & { fallback?: string }> {
  return new Promise((resolve) => {
    let worker: Worker | null = null;
    let settled = false;
    const fallback = (why: string) => {
      if (settled) return;
      settled = true;
      worker?.terminate();
      resolve({ ...runSpike(req, "main thread", () => performance.now()), fallback: why });
    };
    try {
      worker = new ModelWorker();
    } catch (e) {
      fallback(e instanceof Error ? e.message : String(e));
      return;
    }
    const timer = setTimeout(() => fallback("no answer from the worker"), WORKER_TIMEOUT_MS);
    worker.onmessage = (ev: MessageEvent<SpikeResult>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker?.terminate();
      resolve(ev.data);
    };
    worker.onerror = (ev) => {
      clearTimeout(timer);
      ev.preventDefault();
      fallback(ev.message || "worker error");
    };
    worker.postMessage(req);
  });
}
