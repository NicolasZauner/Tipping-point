// A scripted stand-in for the `sample` capability: same call shape, same streaming, same error
// shape, page tools executed for real. Unit tests use it directly; the e2e suite injects it as
// window.claude so the whole page runs its real AI path without spending usage.

import type { SampleFn, SampleInput, SampleOptions, SampleResult } from "../platform/claude";
import type { SampleErrorCode } from "./errors";

export type FakeStep = {
  /** Pick this step when the prompt matches; steps without `when` are used in order. */
  when?: (prompt: string) => boolean;
  /** Tool calls Claude "makes" before answering, run against the page's own tools. */
  toolCalls?: { name: string; input: Record<string, unknown> }[];
  reply?: string;
  /** Reject with this code instead (after any tool calls). */
  error?: SampleErrorCode;
  /** Text that had streamed before the error. */
  text?: string;
  /** Stop streaming after this many characters and wait for an abort. */
  stallAfter?: number;
};

export type FakeSample = SampleFn & { calls: { prompt: string; options?: SampleOptions }[] };

const flatten = (input: SampleInput) =>
  typeof input === "string" ? input : input.map((m) => m.content).join("\n\n");

/** The platform's tolerant JSON reading: whole reply, else one fenced block, else first bracket to last. */
export function readJson(text: string): unknown {
  const attempts = [text.trim()];
  const fence = /```(?:json)?\s*\n([\s\S]*?)\n```/.exec(text);
  if (fence?.[1]) attempts.push(fence[1]);
  const first = text.search(/[[{]/);
  const last = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (first >= 0 && last > first) attempts.push(text.slice(first, last + 1));
  for (const a of attempts) {
    try {
      return JSON.parse(a);
    } catch {
      /* next */
    }
  }
  throw { code: "invalid_json", message: "fake: no JSON value", text };
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));
const reject = (code: string, text?: string) => ({
  code,
  message: "fake",
  ...(text !== undefined ? { text } : {}),
});

export function createFakeSample(steps: FakeStep[], opts: { tools?: boolean } = {}): FakeSample {
  const queue = [...steps];
  const calls: FakeSample["calls"] = [];

  async function run(input: SampleInput, options?: SampleOptions): Promise<SampleResult> {
    const prompt = flatten(input);
    calls.push({ prompt, ...(options ? { options } : {}) });
    const signal = options?.signal;
    const i = queue.findIndex((s) => (s.when ? s.when(prompt) : true));
    const step = i >= 0 ? queue.splice(i, 1)[0] : undefined;
    await tick();
    if (signal?.aborted) throw reject("cancelled");
    if (!step) throw reject("upstream_error");

    for (const call of step.toolCalls ?? []) {
      const tool = options?.tools?.find((t) => t.name === call.name);
      if (!tool) throw reject("tools_unavailable");
      try {
        await tool.execute(call.input, { signal: signal ?? new AbortController().signal });
      } catch {
        /* Claude would receive "Error: …" and carry on */
      }
      await tick();
    }
    if (step.error) throw reject(step.error, step.text);

    const reply = step.reply ?? "";
    if (!reply.trim()) throw reject("empty_completion");
    const chunks = Math.min(4, reply.length);
    let shown = "";
    for (let c = 1; c <= chunks; c++) {
      const upTo = Math.ceil((reply.length * c) / chunks);
      const limit = step.stallAfter ?? Infinity;
      const next = reply.slice(0, Math.min(upTo, limit));
      if (next.length > shown.length) {
        options?.onText?.({ text: next, delta: next.slice(shown.length) });
        shown = next;
      }
      await tick();
      if (signal?.aborted) throw reject("cancelled", shown);
      if (shown.length >= limit) {
        await new Promise<void>((resolve) => signal?.addEventListener("abort", () => resolve()));
        throw reject("cancelled", shown);
      }
    }
    return { text: reply, truncated: false, modelTierApplied: options?.modelTier ?? "default" };
  }

  const fn = ((input: SampleInput, options?: SampleOptions) => run(input, options)) as FakeSample;
  fn.json = async <T>(input: SampleInput, options?: SampleOptions) =>
    readJson((await run(input, options)).text) as T;
  fn.limits = async () => ({
    maxPromptBytes: 262_144,
    ...(opts.tools === false ? {} : { tools: { maxCount: 16 } }),
  });
  fn.calls = calls;
  return fn;
}
