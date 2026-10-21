import { describe, expect, it } from "vitest";
import { SAMPLE_ERROR_CODES, failureFor } from "../../../src/ai/errors";

describe("error policy", () => {
  it("hides the feature for good on permanent codes and keeps no text", () => {
    for (const code of [
      "not_granted",
      "sampling_disabled",
      "not_declared",
      "capability_disabled",
      "capability_removed",
      "tools_unavailable",
    ] as const)
      expect(failureFor({ code, message: "", text: "partial" }).action).toBe("hide");
  });

  it("asks the viewer to wait on rate limits and sign in on expiry", () => {
    expect(failureFor({ code: "rate_limited", message: "" }).action).toBe("wait");
    expect(failureFor({ code: "session_expired", message: "" }).action).toBe("sign-in");
  });

  it("asks for different input on refusals and empty answers, and drops refused text", () => {
    const r = failureFor({ code: "refused", message: "", text: "withdrawn" });
    expect(r.action).toBe("change-input");
    expect(r.partial).toBeUndefined();
    expect(failureFor({ code: "empty_completion", message: "" }).action).toBe("change-input");
  });

  it("keeps partial text on an upstream error, marked interrupted", () => {
    expect(failureFor({ code: "upstream_error", message: "", text: "half" })).toEqual({
      code: "upstream_error",
      action: "interrupted",
      partial: "half",
    });
  });

  it("treats an unknown code as upstream_error and a stop as quiet", () => {
    expect(failureFor({ code: "brand_new", message: "" }).code).toBe("upstream_error");
    expect(failureFor({ code: "cancelled", message: "" }).action).toBe("quiet");
  });

  it("has an action for every documented code", () => {
    for (const code of SAMPLE_ERROR_CODES)
      expect(failureFor({ code, message: "" }).action).toBeTruthy();
    expect(SAMPLE_ERROR_CODES).toHaveLength(19);
  });
});
