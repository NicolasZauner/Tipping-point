// Injected before the page loads: a stand-in window.claude whose `sample` answers the segment
// mapper by keyword, so the e2e suite runs the page's real AI path without spending usage.
/* global window */
// window.__fakeMode: "ok" (default) | "rate_limited" | "bad_weights".
(() => {
  const rules = [
    [/wohnmobil|utilit|sonstig|ignore/i, "out-of-scope"],
    [/mini-van/i, "medium"],
    [/mini|klein/i, "small"],
    [/obere|oberklasse|sport/i, "premium"],
    [/suv|gelände|großraum/i, "large"],
    [/.*/, "medium"],
  ];
  const classify = (label) => rules.find(([re]) => re.test(label))[1];
  const labels = (prompt) => {
    const block = /<data>\n([\s\S]*?)\n<\/data>/.exec(prompt);
    return block ? block[1].split("\n").map((l) => l.replace(/^\d+\.\s/, "")) : [];
  };
  async function sample(input, options = {}) {
    const prompt = typeof input === "string" ? input : input.map((m) => m.content).join("\n");
    await new Promise((r) => setTimeout(r, 50));
    if (window.__fakeMode === "rate_limited") throw { code: "rate_limited", message: "fake" };
    const rows = labels(prompt).map((source, i) => ({
      source,
      weights:
        window.__fakeMode === "bad_weights" && i === 0 ? { small: 0.5 } : { [classify(source)]: 1 },
      reason: "Matched by the test double",
      confidence: "high",
    }));
    const text = JSON.stringify({ rows });
    options.onText?.({ text, delta: text });
    window.__fakeCalls = (window.__fakeCalls ?? 0) + 1;
    return { text, truncated: false, modelTierApplied: options.modelTier ?? "default" };
  }
  sample.json = async (input, options) => JSON.parse((await sample(input, options)).text);
  sample.limits = async () => ({ maxPromptBytes: 262144, tools: { maxCount: 16 } });
  window.claude = { use: async (name) => (name === "sample" ? sample : null) };
})();
