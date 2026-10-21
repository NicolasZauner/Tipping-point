// The one way features call Claude. It records the trace, wraps page tools so every call and its
// result is logged, applies the error policy and, for JSON, validates with Zod. It never retries.

import type { ZodType } from "zod";
import type { SampleFn, SampleOptions, SampleTool } from "../platform/claude";
import { asSampleError } from "../platform/claude";
import { failureFor, type AiFailure } from "./errors";
import { traceLog, type AiFeatureId, type Trace, type TraceLog, type TraceToolCall } from "./trace";

export type CallRequest = {
  feature: AiFeatureId;
  prompt: string;
  tier: "quick" | "default" | "complex";
  now: () => number;
  tools?: SampleTool[];
  signal?: AbortSignal;
  onText?: (text: string) => void;
  log?: TraceLog;
};

export type CallResult<T> =
  | { ok: true; value: T; text: string; trace: Trace }
  | { ok: false; failure: AiFailure; trace: Trace };

type Invoke = (
  sample: SampleFn,
  options: SampleOptions,
) => Promise<{ raw: unknown; text: string; tier: string }>;

type Finish = (
  raw: unknown,
) => { ok: true; value: unknown } | { ok: false; failure: AiFailure; detail: string };

async function run(
  sample: SampleFn | null,
  req: CallRequest,
  invoke: Invoke,
  finish: Finish,
  checkName: string | null,
): Promise<CallResult<unknown>> {
  const log = req.log ?? traceLog;
  const startedAt = req.now();
  const toolCalls: TraceToolCall[] = [];
  let streamed = "";
  const record = (answer: string, tier: string, checks: Trace["checks"], ok: boolean) =>
    log.add({
      feature: req.feature,
      startedAt,
      ms: req.now() - startedAt,
      modelTierApplied: tier,
      prompt: req.prompt,
      toolCalls,
      answer,
      checks,
      outcome: ok ? "ok" : "failed",
    });

  if (!sample) {
    const failure = failureFor({ code: "unavailable", message: "" });
    return { ok: false, failure, trace: record("", "none", [], false) };
  }

  const tools = req.tools?.map((t): SampleTool => ({
    ...t,
    execute: async (input, ctx) => {
      const t0 = req.now();
      try {
        const output = await t.execute(input, ctx);
        toolCalls.push({ name: t.name, input, output, ms: req.now() - t0 });
        return output;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toolCalls.push({ name: t.name, input, output: { error: message }, ms: req.now() - t0 });
        throw e;
      }
    },
  }));

  try {
    const res = await invoke(sample, {
      modelTier: req.tier,
      ...(tools ? { tools } : {}),
      ...(req.signal ? { signal: req.signal } : {}),
      onText: ({ text }) => {
        streamed = text;
        req.onText?.(text);
      },
    });
    const text = res.text || streamed;
    const done = finish(res.raw);
    if (done.ok) {
      const checks = checkName ? [{ name: checkName, passed: true }] : [];
      return { ok: true, value: done.value, text, trace: record(text, res.tier, checks, true) };
    }
    const checks = checkName ? [{ name: checkName, passed: false, detail: done.detail }] : [];
    return { ok: false, failure: done.failure, trace: record(text, res.tier, checks, false) };
  } catch (e) {
    // A platform failure always carries a code; anything else is our own bug and must surface.
    if (!(e && typeof e === "object" && "code" in e)) throw e;
    const err = asSampleError(e);
    const failure = failureFor(err);
    return { ok: false, failure, trace: record(err.text ?? streamed, "none", [], false) };
  }
}

export async function callText(
  sample: SampleFn | null,
  req: CallRequest,
): Promise<CallResult<string>> {
  const invoke: Invoke = async (s, options) => {
    const r = await s(req.prompt, options);
    return { raw: r.text, text: r.text, tier: r.modelTierApplied };
  };
  const finish: Finish = (raw) => ({ ok: true, value: raw });
  return (await run(sample, req, invoke, finish, null)) as CallResult<string>;
}

/**
 * Asks for JSON through `sample.json` (the platform tells Claude the reply is machine-parsed),
 * keeps the raw reply from the stream for the trace, then validates with Zod. No JSON in the
 * reply is `invalid_json`; JSON that breaks the schema is `bad_shape`. Both offer Try again;
 * neither retries by itself.
 */
export async function callJson<T>(
  sample: SampleFn | null,
  req: CallRequest & { schema: ZodType<T> },
): Promise<CallResult<T>> {
  const invoke: Invoke = async (s, options) => {
    const raw = await s.json(req.prompt, options);
    return { raw, text: "", tier: req.tier };
  };
  const finish: Finish = (raw) => {
    const parsed = req.schema.safeParse(raw);
    if (parsed.success) return { ok: true, value: parsed.data };
    const detail = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return { ok: false, failure: failureFor({ code: "bad_shape", message: "" }), detail };
  };
  return (await run(sample, req, invoke, finish, "schema")) as CallResult<T>;
}
