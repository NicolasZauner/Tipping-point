// What the page does about each way a `sample` call can fail (contract 0.2.88). One table, so
// every AI feature behaves the same: the copy lives in i18n under `ai.error.<action>`.

import type { SampleError } from "../platform/claude";

export const SAMPLE_ERROR_CODES = [
  "invalid_request",
  "prompt_too_large",
  "images_unavailable",
  "tools_unavailable",
  "image_rejected",
  "cancelled",
  "not_granted",
  "session_expired",
  "sampling_disabled",
  "not_declared",
  "rate_limited",
  "refused",
  "empty_completion",
  "invalid_json",
  "upstream_error",
  "capability_disabled",
  "capability_removed",
  "transform_error",
  "queue_overflow",
] as const;
export type SampleErrorCode = (typeof SAMPLE_ERROR_CODES)[number];

/** Our own failure on top of the platform's: the answer parsed but didn't fit the schema. */
export type AiFailureCode = SampleErrorCode | "bad_shape" | "unavailable";

/**
 * - hide: AI is off for this visit (never re-ask)
 * - wait: try again in a minute
 * - sign-in: the viewer must sign in again
 * - change-input: same input gives the same result; ask for something different
 * - try-again: the viewer may press Try again (bad JSON or shape)
 * - interrupted: keep what streamed, mark it interrupted, offer Try again
 * - bug: our request was malformed; nothing was sent
 * - quiet: the viewer pressed Stop
 */
export type AiAction =
  "hide" | "wait" | "sign-in" | "change-input" | "try-again" | "interrupted" | "bug" | "quiet";

export type AiFailure = { code: AiFailureCode; action: AiAction; partial?: string };

const isKnown = (c: string): c is SampleErrorCode =>
  (SAMPLE_ERROR_CODES as readonly string[]).includes(c);

function actionFor(code: AiFailureCode): AiAction {
  switch (code) {
    case "not_granted":
    case "sampling_disabled":
    case "not_declared":
    case "capability_disabled":
    case "capability_removed":
    case "tools_unavailable":
    case "images_unavailable":
    case "unavailable":
      return "hide";
    case "rate_limited":
      return "wait";
    case "session_expired":
      return "sign-in";
    case "refused":
    case "empty_completion":
    case "prompt_too_large":
    case "image_rejected":
      return "change-input";
    case "invalid_json":
    case "bad_shape":
      return "try-again";
    case "upstream_error":
      return "interrupted";
    case "invalid_request":
    case "transform_error":
    case "queue_overflow":
      return "bug";
    case "cancelled":
      return "quiet";
    default: {
      const never: never = code;
      return never;
    }
  }
}

export function failureFor(
  e: SampleError | { code: AiFailureCode; message: string; text?: string },
): AiFailure {
  const code: AiFailureCode =
    e.code === "bad_shape" || e.code === "unavailable"
      ? e.code
      : isKnown(e.code)
        ? e.code
        : "upstream_error";
  const action = actionFor(code);
  // Permanent and refused failures keep nothing on screen; the rest may keep what streamed.
  const keeps = action !== "hide" && code !== "refused" && e.text !== undefined && e.text !== "";
  return { code, action, ...(keeps ? { partial: e.text } : {}) };
}
