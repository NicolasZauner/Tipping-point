// Thin, typed access to the claude.ai artifact runtime (contract 0.2.88). Everything here
// degrades to "absent": outside a Claude viewer (offline copy, signed-out visitor) window.claude
// does not exist, and inside one any capability may resolve null. The app must work without them.

export type SampleTool = {
  name: string;
  description: string;
  inputSchema?: { type: "object"; properties?: Record<string, unknown>; required?: string[] };
  execute: (input: Record<string, unknown>, context: { signal: AbortSignal }) => unknown;
};

export type SampleOptions = {
  onText?: (u: { text: string; delta: string }) => void;
  signal?: AbortSignal;
  tools?: SampleTool[];
  modelTier?: "quick" | "default" | "complex";
  cache?: boolean | { gcTime?: number; refresh?: boolean };
};

export type SampleLimits = {
  maxPromptBytes: number;
  tools?: { maxCount: number };
  images?: { maxCount: number; maxInputBytes: number; mediaTypes: string[] };
};

export type SampleError = { code: string; message: string; text?: string };

export type SampleInput = string | { role: "user" | "assistant"; content: string }[];
export type SampleResult = { text: string; truncated: boolean; modelTierApplied: string };

export type SampleFn = ((input: SampleInput, options?: SampleOptions) => Promise<SampleResult>) & {
  json: <T = unknown>(input: SampleInput, options?: SampleOptions) => Promise<T>;
  limits: () => Promise<SampleLimits>;
};

export type DownloadsNs = {
  save: (req: { filename: string; data: string | Blob }) => Promise<unknown>;
};

type ClaudeRuntime = { use: (name: string) => Promise<unknown> };

function runtime(): ClaudeRuntime | null {
  const w = globalThis as unknown as { claude?: ClaudeRuntime };
  return w.claude && typeof w.claude.use === "function" ? w.claude : null;
}

export async function loadCapability<T>(name: "sample" | "downloads"): Promise<T | null> {
  const rt = runtime();
  if (!rt) return null;
  try {
    return ((await rt.use(name)) as T | null) ?? null;
  } catch {
    return null;
  }
}

export const getSample = () => loadCapability<SampleFn>("sample");
export const getDownloads = () => loadCapability<DownloadsNs>("downloads");
export const inClaudeViewer = () => runtime() !== null;

/** Reads the view's limits without spending usage or prompting the viewer. */
export async function sampleLimits(): Promise<SampleLimits | null> {
  const sample = await getSample();
  if (!sample || typeof sample.limits !== "function") return null;
  try {
    return await sample.limits();
  } catch {
    return null;
  }
}

/** Normalises whatever a rejected sample call carries into the one documented error shape. */
export function asSampleError(e: unknown): SampleError {
  if (e && typeof e === "object" && "code" in e) {
    const o = e as { code: unknown; message?: unknown; text?: unknown };
    return {
      code: String(o.code),
      message: typeof o.message === "string" ? o.message : "",
      ...(typeof o.text === "string" ? { text: o.text } : {}),
    };
  }
  return { code: "upstream_error", message: String(e) };
}
