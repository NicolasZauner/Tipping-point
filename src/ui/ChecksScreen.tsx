import { useEffect, useState } from "react";
import { formatNumber, useLang, useT, type Key } from "../i18n";
import { normalCdf } from "../model/normal";
import {
  asSampleError,
  getDownloads,
  getSample,
  inClaudeViewer,
  sampleLimits,
  type SampleTool,
} from "../platform/claude";
import { storageWorks } from "../platform/storage";
import { runSpikeAnywhere } from "../worker/client";
import type { SpikeResult } from "../worker/protocol";

type Probe = "checking" | "yes" | "no" | "fallback";

const MARKETS = ["DE", "FR", "ES", "IT", "NL", "BE"] as const;
const SCENARIOS = ["S1", "S2", "S3", "S4", "S5", "S6"] as const;
const SPIKE = { kind: "spike", seed: 20261017, draws: 200_000 } as const;

function useProbe(fn: () => Promise<Probe>): Probe {
  const [state, setState] = useState<Probe>("checking");
  useEffect(() => {
    let live = true;
    fn().then(
      (v) => live && setState(v),
      () => live && setState("no"),
    );
    return () => {
      live = false;
    };
  }, [fn]);
  return state;
}

const probeSample = async (): Promise<Probe> => ((await getSample()) ? "yes" : "no");
const probeTools = async (): Promise<Probe> => ((await sampleLimits())?.tools ? "yes" : "no");
const probeDownloads = async (): Promise<Probe> => ((await getDownloads()) ? "yes" : "no");
const probeStorage = async (): Promise<Probe> => (storageWorks() ? "yes" : "no");

function StatusRow({ label, detail, state }: { label: string; detail: string; state: Probe }) {
  const t = useT();
  const tone =
    state === "yes"
      ? "text-ok"
      : state === "checking"
        ? "text-muted animate-pulse"
        : state === "fallback"
          ? "text-warn"
          : "text-muted";
  const word: Key =
    state === "yes"
      ? "state.yes"
      : state === "no"
        ? "state.no"
        : state === "fallback"
          ? "state.fallback"
          : "state.checking";
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line py-2.5 first:border-t-0">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted">{detail}</div>
      </div>
      <span className={`mono shrink-0 text-xs ${tone}`}>{t(word)}</span>
    </div>
  );
}

function useSpike(): SpikeResult | null {
  const [result, setResult] = useState<SpikeResult | null>(null);
  useEffect(() => {
    let live = true;
    runSpikeAnywhere(SPIKE).then((r) => live && setResult(r));
    return () => {
      live = false;
    };
  }, []);
  return result;
}

type ToolTest =
  | { status: "idle" }
  | { status: "running" }
  | { status: "pass"; answer: string }
  | { status: "fail"; answer: string }
  | { status: "error"; code: string };

const TOOL_Z = 1.234;

function ToolsTest({ available }: { available: boolean }) {
  const t = useT();
  const [state, setState] = useState<ToolTest>({ status: "idle" });

  async function run() {
    const sample = await getSample();
    if (!sample) return setState({ status: "error", code: "not_available" });
    setState({ status: "running" });
    const expected = normalCdf(TOOL_Z).toFixed(6);
    let toolRan = false;
    const tools: SampleTool[] = [
      {
        name: "normal_cdf",
        description:
          "Returns the standard normal cumulative distribution Φ(z) for a number z, computed by the page.",
        inputSchema: {
          type: "object",
          properties: { z: { type: "number", description: "The point to evaluate" } },
          required: ["z"],
        },
        execute: (input) => {
          const z = Number(input.z);
          if (!Number.isFinite(z)) throw new Error("z must be a number");
          toolRan = true;
          return { z, phi: normalCdf(z) };
        },
      },
    ];
    try {
      const { text } = await sample(
        `Call the normal_cdf tool with z = ${TOOL_Z}. Then reply with only the value of phi it returned, rounded to 6 decimals, and nothing else.`,
        { tools, modelTier: "quick" },
      );
      const answer = text.trim().slice(0, 80);
      setState(
        toolRan && answer.includes(expected)
          ? { status: "pass", answer }
          : { status: "fail", answer },
      );
    } catch (e) {
      setState({ status: "error", code: asSampleError(e).code });
    }
  }

  const errorKey = (code: string): Key =>
    code === "not_granted" || code === "rate_limited" || code === "tools_unavailable"
      ? (`spike.error.${code}` as Key)
      : "spike.error.other";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          id="tools-test"
          disabled={!available || state.status === "running"}
          onClick={run}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg disabled:opacity-40"
        >
          {t("spike.toolsButton")}
        </button>
        <span className="text-xs text-muted">{t("spike.toolsHint")}</span>
      </div>
      <p className="text-sm" aria-live="polite">
        {state.status === "running" && (
          <span className="text-muted">{t("spike.toolsRunning")}</span>
        )}
        {state.status === "pass" && (
          <span className="text-ok">{t("spike.toolsPass", { answer: state.answer })}</span>
        )}
        {state.status === "fail" && (
          <span className="text-warn">{t("spike.toolsFail", { answer: state.answer })}</span>
        )}
        {state.status === "error" && (
          <span className="text-warn">{t(errorKey(state.code), { code: state.code })}</span>
        )}
      </p>
    </div>
  );
}

function DownloadTest({ available }: { available: boolean }) {
  const t = useT();
  const [message, setMessage] = useState<string>("");
  async function run() {
    const downloads = await getDownloads();
    if (!downloads) return;
    try {
      await downloads.save({
        filename: "tipping-point-check.csv",
        data: "market,powertrain,share_2025\nDE,BEV,0.191\nDE,PHEV,0.109\n",
      });
      setMessage(t("spike.downloadPass"));
    } catch (e) {
      setMessage(t("spike.error.other", { code: asSampleError(e).code }));
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          id="download-test"
          disabled={!available}
          onClick={run}
          className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm font-medium disabled:opacity-40"
        >
          {t("spike.downloadButton")}
        </button>
        <span className="text-xs text-muted">{t("spike.downloadHint")}</span>
      </div>
      {message && (
        <p className="text-sm" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}

export function ChecksScreen() {
  const t = useT();
  const { lang } = useLang();
  const sample = useProbe(probeSample);
  const tools = useProbe(probeTools);
  const downloads = useProbe(probeDownloads);
  const storage = useProbe(probeStorage);
  const spike = useSpike();
  const viewer = inClaudeViewer();
  const workerState: Probe = !spike ? "checking" : spike.where === "worker" ? "yes" : "fallback";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.checks")}</h1>
        <p className="text-sm text-muted">{t("app.shellNote")}</p>
      </header>

      <section aria-labelledby="runtime" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="runtime" className="mb-2 text-sm font-semibold">
          {t("runtime.heading")}
        </h2>
        <StatusRow
          label={t("runtime.viewer")}
          detail={t("runtime.viewer.detail")}
          state={viewer ? "yes" : "no"}
        />
        <StatusRow label={t("runtime.sample")} detail={t("runtime.sample.detail")} state={sample} />
        <StatusRow label={t("runtime.tools")} detail={t("runtime.tools.detail")} state={tools} />
        <StatusRow
          label={t("runtime.downloads")}
          detail={t("runtime.downloads.detail")}
          state={downloads}
        />
        <StatusRow
          label={t("runtime.storage")}
          detail={t("runtime.storage.detail")}
          state={storage}
        />
        <StatusRow
          label={t("runtime.worker")}
          detail={t("runtime.worker.detail")}
          state={workerState}
        />
      </section>

      <section
        aria-labelledby="spike"
        className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5"
      >
        <h2 id="spike" className="text-sm font-semibold">
          {t("spike.heading")}
        </h2>
        <div className="flex flex-col gap-1">
          <div className="text-sm font-medium">
            {t("spike.worker", { draws: formatNumber(lang, SPIKE.draws, 0) })}
          </div>
          <div className="mono text-xs text-muted" data-testid="spike-result" aria-live="polite">
            {spike
              ? t("spike.workerResult", {
                  estimate: formatNumber(lang, spike.estimate, 4),
                  exact: formatNumber(lang, spike.exact, 4),
                  millis: formatNumber(lang, spike.millis, 0),
                  where: t(spike.where === "worker" ? "spike.where.worker" : "spike.where.main"),
                })
              : t("state.checking")}
          </div>
        </div>
        <ToolsTest available={tools === "yes"} />
        <DownloadTest available={downloads === "yes"} />
      </section>

      <div className="grid gap-6 sm:grid-cols-[1fr_2fr]">
        <section aria-labelledby="markets" className="flex min-w-0 flex-col gap-3">
          <h2 id="markets" className="text-sm font-semibold">
            {t("markets.heading")}
          </h2>
          <ul className="grid grid-cols-2 gap-2">
            {MARKETS.map((m) => (
              <li
                key={m}
                className="flex items-baseline gap-2 rounded-xl border border-line bg-surface px-3 py-2"
              >
                <span className="mono text-xs text-muted">{m}</span>
                <span className="text-sm">{t(`market.${m}`)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="scenarios" className="flex min-w-0 flex-col gap-3">
          <h2 id="scenarios" className="text-sm font-semibold">
            {t("scenarios.heading")}
          </h2>
          <ol className="grid gap-2 sm:grid-cols-2">
            {SCENARIOS.map((s) => (
              <li key={s} className="rounded-xl border border-line bg-surface px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <span className="mono text-xs text-muted">{s}</span>
                  <span className="text-sm font-medium">{t(`scenario.${s}`)}</span>
                </div>
                <div className="text-xs text-muted">{t(`scenario.${s}.point`)}</div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
