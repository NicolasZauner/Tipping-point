import { describe, expect, it } from "vitest";
import { createFakeSample } from "../../../src/ai/fake";

describe("fake sample", () => {
  it("replays steps in order and fails loudly when the script runs out", async () => {
    const s = createFakeSample([{ reply: "one" }, { reply: "two" }]);
    expect((await s("a")).text).toBe("one");
    expect((await s("b")).text).toBe("two");
    await expect(s("c")).rejects.toMatchObject({ code: "upstream_error" });
  });

  it("picks a step by matcher when given one", async () => {
    const s = createFakeSample([
      { when: (p) => p.includes("KBA"), reply: "kba" },
      { when: () => true, reply: "other" },
    ]);
    expect((await s("Map these KBA segments")).text).toBe("kba");
    expect((await s("hello")).text).toBe("other");
  });

  it("reads JSON the way the platform does: whole, fenced, or first bracket to last", async () => {
    const s = createFakeSample([
      { reply: "[1,2]" },
      { reply: 'x\n```json\n{"a":1}\n```' },
      { reply: 'Here: {"b":2} ok' },
    ]);
    expect(await s.json("a")).toEqual([1, 2]);
    expect(await s.json("b")).toEqual({ a: 1 });
    expect(await s.json("c")).toEqual({ b: 2 });
  });

  it("rejects with a scripted error code, keeping partial text", async () => {
    const s = createFakeSample([{ error: "upstream_error", text: "half" }]);
    await expect(s("x")).rejects.toEqual({ code: "upstream_error", message: "fake", text: "half" });
  });

  it("reports tool support in limits", async () => {
    expect((await createFakeSample([]).limits()).tools?.maxCount).toBeGreaterThan(0);
    expect((await createFakeSample([], { tools: false }).limits()).tools).toBeUndefined();
  });
});
