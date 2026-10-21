// "Show the work": one record per AI call, kept in memory for the visit (last 20), never sent.

export type AiFeatureId = "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "A7";

export type TraceCheck = { name: string; passed: boolean; detail?: string };
export type TraceToolCall = { name: string; input: unknown; output: unknown; ms: number };

export type Trace = {
  id: number;
  feature: AiFeatureId;
  startedAt: number;
  ms: number;
  modelTierApplied: string;
  prompt: string;
  toolCalls: TraceToolCall[];
  answer: string;
  checks: TraceCheck[];
  outcome: "ok" | "failed";
};

type Listener = (traces: readonly Trace[]) => void;

/** A tiny store without React, so src/ai stays testable; the UI subscribes. */
export function createTraceLog(limit = 20) {
  let traces: Trace[] = [];
  let nextId = 1;
  const listeners = new Set<Listener>();
  const emit = () => listeners.forEach((l) => l(traces));
  return {
    add(t: Omit<Trace, "id">): Trace {
      const full = { ...t, id: nextId++ };
      traces = [full, ...traces].slice(0, limit);
      emit();
      return full;
    },
    /** Adds a check after the call, e.g. the number guard or a feature's own rules. */
    addCheck(id: number, check: TraceCheck) {
      traces = traces.map((t) => (t.id === id ? { ...t, checks: [...t.checks, check] } : t));
      emit();
    },
    list: () => traces,
    subscribe(l: Listener) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export type TraceLog = ReturnType<typeof createTraceLog>;
export const traceLog = createTraceLog();
