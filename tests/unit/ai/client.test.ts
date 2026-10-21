import { describe, expect, it } from "vitest";
import { z } from "zod";
import { callJson, callText } from "../../../src/ai/client";
import { createFakeSample } from "../../../src/ai/fake";

const clock = () => {
  let t = 0;
  return () => (t += 5);
};
const schema = z.object({ answer: z.number() }).strict();

describe("callJson", () => {
  it("parses, validates and records the call in the trace", async () => {
    const sample = createFakeSample([{ reply: 'Sure.\n```json\n{"answer": 42}\n```' }]);
    const r = await callJson(sample, {
      feature: "A4",
      prompt: "P",
      schema,
      tier: "default",
      now: clock(),
    });
    expect(r.ok && r.value).toEqual({ answer: 42 });
    expect(r.trace.prompt).toBe("P");
    expect(r.trace.answer).toContain('"answer": 42');
    expect(r.trace.checks).toEqual([{ name: "schema", passed: true }]);
    expect(sample.calls[0]?.options?.modelTier).toBe("default");
  });

  it("turns a reply that parses but breaks the schema into bad_shape", async () => {
    const sample = createFakeSample([{ reply: '{"answer": "lots"}' }]);
    const r = await callJson(sample, {
      feature: "A4",
      prompt: "P",
      schema,
      tier: "default",
      now: clock(),
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failure).toMatchObject({ code: "bad_shape", action: "try-again" });
    expect(r.trace.checks[0]).toMatchObject({ name: "schema", passed: false });
  });

  it("maps a platform rejection through the error policy", async () => {
    const sample = createFakeSample([{ error: "rate_limited" }]);
    const r = await callJson(sample, {
      feature: "A4",
      prompt: "P",
      schema,
      tier: "default",
      now: clock(),
    });
    expect(!r.ok && r.failure.action).toBe("wait");
  });

  it("reports invalid_json when nothing parses, with the raw reply in the trace", async () => {
    const sample = createFakeSample([{ reply: "I can't decide." }]);
    const r = await callJson(sample, {
      feature: "A4",
      prompt: "P",
      schema,
      tier: "default",
      now: clock(),
    });
    expect(!r.ok && r.failure.code).toBe("invalid_json");
    expect(r.trace.answer).toBe("I can't decide.");
  });

  it("says unavailable when there is no sample at all", async () => {
    const r = await callJson(null, {
      feature: "A4",
      prompt: "P",
      schema,
      tier: "default",
      now: clock(),
    });
    expect(!r.ok && r.failure).toMatchObject({ code: "unavailable", action: "hide" });
  });
});

describe("callText", () => {
  it("streams, runs page tools and logs each tool call with its result", async () => {
    const sample = createFakeSample([
      { toolCalls: [{ name: "double", input: { x: 21 } }], reply: "It is 42." },
    ]);
    const seen: string[] = [];
    const r = await callText(sample, {
      feature: "A1",
      prompt: "Double 21",
      tier: "default",
      now: clock(),
      onText: (t) => seen.push(t),
      tools: [
        {
          name: "double",
          description: "Doubles x",
          inputSchema: { type: "object", properties: { x: { type: "number" } }, required: ["x"] },
          execute: (input) => ({ y: Number(input.x) * 2 }),
        },
      ],
    });
    expect(r.ok && r.value).toBe("It is 42.");
    expect(seen.at(-1)).toBe("It is 42.");
    expect(r.trace.toolCalls).toEqual([
      { name: "double", input: { x: 21 }, output: { y: 42 }, ms: 5 },
    ]);
  });

  it("logs a throwing tool as an error result and carries on", async () => {
    const sample = createFakeSample([{ toolCalls: [{ name: "boom", input: {} }], reply: "Done." }]);
    const r = await callText(sample, {
      feature: "A1",
      prompt: "x",
      tier: "quick",
      now: clock(),
      tools: [
        {
          name: "boom",
          description: "Fails",
          execute: () => {
            throw new Error("no data");
          },
        },
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.trace.toolCalls[0]?.output).toEqual({ error: "no data" });
  });

  it("keeps partial text when the viewer stops, quietly", async () => {
    const sample = createFakeSample([{ reply: "A long answer that streams", stallAfter: 6 }]);
    const ctl = new AbortController();
    const p = callText(sample, {
      feature: "A6",
      prompt: "x",
      tier: "quick",
      now: clock(),
      signal: ctl.signal,
      onText: () => ctl.abort(),
    });
    const r = await p;
    expect(!r.ok && r.failure).toMatchObject({ code: "cancelled", action: "quiet" });
  });
});
