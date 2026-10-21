import * as Dialog from "@radix-ui/react-dialog";
import type { Trace } from "../../ai/trace";
import { formatNumber, useLang, useT, type Key } from "../../i18n";
import { useTraces } from "./hooks";

const CHECK_KEYS: Record<string, Key> = {
  schema: "trace.check.schema",
  rows: "trace.check.rows",
  weights: "trace.check.weights",
  reconciliation: "trace.check.reconciliation",
  numbers: "trace.check.numbers",
};

function Block({ title, children }: { title: string; children: string }) {
  return (
    <details className="rounded-lg border border-line bg-surface-2">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium">{title}</summary>
      <pre className="mono max-h-64 overflow-auto px-3 pb-3 text-[11px] leading-relaxed whitespace-pre-wrap">
        {children}
      </pre>
    </details>
  );
}

function TraceCard({ trace }: { trace: Trace }) {
  const t = useT();
  const { lang } = useLang();
  return (
    <li
      className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3"
      data-testid="trace"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="mono text-xs text-muted">
          {t("trace.meta", {
            feature: trace.feature,
            tier: trace.modelTierApplied,
            ms: formatNumber(lang, trace.ms, 0),
          })}
        </span>
        <span className={`mono text-xs ${trace.outcome === "ok" ? "text-ok" : "text-warn"}`}>
          {t(trace.outcome === "ok" ? "trace.passed" : "trace.failed")}
        </span>
      </div>
      {trace.checks.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t("trace.checks")}>
          {trace.checks.map((c) => (
            <li
              key={c.name}
              title={c.detail}
              className={`rounded-full border px-2 py-0.5 text-[11px] ${c.passed ? "border-line text-muted" : "border-warn text-warn"}`}
            >
              {(CHECK_KEYS[c.name] ? t(CHECK_KEYS[c.name] as Key) : c.name) +
                " · " +
                t(c.passed ? "trace.passed" : "trace.failed")}
            </li>
          ))}
        </ul>
      )}
      <Block title={t("trace.prompt")}>{trace.prompt}</Block>
      {trace.toolCalls.length > 0 && (
        <Block title={t("trace.tools", { count: trace.toolCalls.length })}>
          {trace.toolCalls
            .map(
              (c) =>
                `${c.name}(${JSON.stringify(c.input)}) → ${JSON.stringify(c.output)}  [${c.ms} ms]`,
            )
            .join("\n")}
        </Block>
      )}
      <Block title={t("trace.answer")}>{trace.answer || "—"}</Block>
    </li>
  );
}

export function TraceDrawer() {
  const t = useT();
  const traces = useTraces();
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          id="trace-open"
          className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-fg"
        >
          {t("trace.open", { count: traces.length })}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30" />
        <Dialog.Content className="fixed inset-y-0 right-0 flex w-full max-w-xl flex-col gap-3 overflow-y-auto border-l border-line bg-bg p-5 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <Dialog.Title className="text-base font-semibold">{t("trace.title")}</Dialog.Title>
            <Dialog.Close className="rounded-md border border-line px-2 py-1 text-xs">
              {t("trace.close")}
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-sm text-muted">{t("trace.lead")}</Dialog.Description>
          {traces.length === 0 ? (
            <p className="text-sm text-muted">{t("trace.empty")}</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {traces.map((tr) => (
                <TraceCard key={tr.id} trace={tr} />
              ))}
            </ol>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
