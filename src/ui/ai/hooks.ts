import { useEffect, useState, useSyncExternalStore } from "react";
import { traceLog } from "../../ai/trace";
import { getSample, type SampleFn } from "../../platform/claude";

/** undefined while the runtime answers (up to ~10 s), then the function or null (absent). */
export function useSampleFn(): SampleFn | null | undefined {
  const [sample, setSample] = useState<SampleFn | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    // The capability is a function: wrap it, or React would call it as a state updater.
    getSample().then(
      (s) => live && setSample(() => s),
      () => live && setSample(null),
    );
    return () => {
      live = false;
    };
  }, []);
  return sample;
}

export function useTraces() {
  return useSyncExternalStore(
    (cb) => traceLog.subscribe(cb),
    () => traceLog.list(),
  );
}

/** True once `active` has been true for `ms`: the Stop button appears after two seconds. */
export function useAfter(active: boolean, ms: number): boolean {
  const [lateFor, setLateFor] = useState<number | null>(null);
  const [run, setRun] = useState(0);
  const [prev, setPrev] = useState(active);
  // A new run starts whenever `active` turns true (adjusting state during render, not in an effect).
  if (active !== prev) {
    setPrev(active);
    if (active) setRun((r) => r + 1);
  }
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => setLateFor(run), ms);
    return () => clearTimeout(id);
  }, [active, ms, run]);
  return active && lateFor === run;
}

export const pageNow = () => performance.now();
