import { useMemo, useRef, useState } from "react";
import { A4_EVAL_CASES, scoreCase, summarise, type CaseScore } from "../../ai/a4/evals";
import { parsePastedSegments } from "../../ai/a4/input";
import { defaultMapping, mapSegments, type CheckedRow } from "../../ai/a4/mapper";
import type { AiFailure } from "../../ai/errors";
import {
  CLASS_TARGETS,
  DEFAULT_MAPPINGS,
  checkWeights,
  reconcile,
  type ClassTarget,
  type Reconciliation,
} from "../../model/classMapping";
import { formatNumber, useLang, useT, type Key } from "../../i18n";
import { pageNow, useAfter, useSampleFn } from "../ai/hooks";
import { useConfirmedMapping } from "../state/mapping";

type Phase =
  | { kind: "idle" }
  | { kind: "running"; ctl: AbortController }
  | { kind: "review"; failure: AiFailure | null; extra: string[] }
  | { kind: "confirmed"; count: number; ai: number; edited: number };

const KBA_EXAMPLE = DEFAULT_MAPPINGS.kba.rows.map((r) => r.source).join("\n");
const classKey = (c: ClassTarget) => `mapper.class.${c}` as Key;

function recompute(rows: CheckedRow[]): Reconciliation | null {
  const volumes = new Map(
    rows.filter((r) => r.volume !== undefined).map((r) => [r.source, r.volume as number]),
  );
  return volumes.size > 0 ? reconcile(rows, volumes) : null;
}

function OriginBadge({ row }: { row: CheckedRow }) {
  const t = useT();
  const key: Key =
    row.origin === "ai"
      ? "ai.badge.ai"
      : row.origin === "edited"
        ? "ai.badge.edited"
        : "ai.badge.default";
  return (
    <span className="flex flex-wrap gap-1">
      <span className="rounded-full border border-line px-1.5 py-0.5 text-[11px] text-muted">
        {t(key)}
      </span>
      {row.override && (
        <span
          className="rounded-full border border-accent px-1.5 py-0.5 text-[11px] text-accent"
          title={t(row.override === "brand" ? "mapper.override.brand" : "mapper.override.price")}
        >
          {t("ai.badge.override")}
        </span>
      )}
    </span>
  );
}

function ClassCell({ row, onPick }: { row: CheckedRow; onPick: (c: ClassTarget) => void }) {
  const t = useT();
  const { lang } = useLang();
  const set = CLASS_TARGETS.filter((c) => (row.weights[c] ?? 0) > 0);
  const single = set.length === 1 && row.weights[set[0] as ClassTarget] === 1 ? set[0] : undefined;
  return (
    <div className="flex flex-col gap-1">
      <select
        aria-label={`${t("mapper.col.class")}: ${row.source}`}
        value={single ?? ""}
        onChange={(e) => onPick(e.target.value as ClassTarget)}
        className="rounded-md border border-line bg-surface px-1.5 py-1 text-sm"
      >
        {!single && (
          <option value="">
            {set.length > 1 ? t("mapper.class.split") : t("mapper.class.none")}
          </option>
        )}
        {CLASS_TARGETS.map((c) => (
          <option key={c} value={c}>
            {t(classKey(c))}
          </option>
        ))}
      </select>
      {set.length > 1 && (
        <span className="mono text-[11px] text-muted">
          {set
            .map((c) => `${t(classKey(c))} ${formatNumber(lang, (row.weights[c] ?? 0) * 100, 0)}%`)
            .join(" · ")}
        </span>
      )}
    </div>
  );
}

function EvalPanel({ disabled }: { disabled: boolean }) {
  const t = useT();
  const { lang } = useLang();
  const sample = useSampleFn();
  const [progress, setProgress] = useState<number | null>(null);
  const [scores, setScores] = useState<(CaseScore & { failed?: string })[]>([]);
  const totalRows = A4_EVAL_CASES.reduce((s, c) => s + Object.keys(c.expected).length, 0);

  async function run() {
    setScores([]);
    const out: (CaseScore & { failed?: string })[] = [];
    for (const [i, c] of A4_EVAL_CASES.entries()) {
      setProgress(i + 1);
      const res = await mapSegments(sample ?? null, parsePastedSegments(c.paste), {
        now: pageNow,
        lang,
      });
      if (res.status === "ok") out.push(scoreCase(c, res.rows, res.reconciliation?.ok ?? null));
      else out.push({ ...scoreCase(c, [], null), failed: res.failure.code });
      setScores([...out]);
      if (res.status === "failed" && res.failure.action === "hide") break;
    }
    setProgress(null);
  }

  const s = scores.length ? summarise(scores) : null;
  const pct = (x: number) => `${formatNumber(lang, x * 100, 0)}%`;
  return (
    <section
      aria-labelledby="eval"
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5"
    >
      <h2 id="eval" className="text-sm font-semibold">
        {t("eval.title")}
      </h2>
      <p className="text-sm text-muted">{t("eval.lead", { rows: totalRows })}</p>
      <div>
        <button
          type="button"
          id="eval-run"
          onClick={run}
          disabled={disabled || !sample || progress !== null}
          className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm font-medium disabled:opacity-40"
        >
          {t("eval.run")}
        </button>
      </div>
      <div aria-live="polite" className="flex flex-col gap-1 text-sm">
        {progress !== null && (
          <span className="text-muted">
            {t("eval.running", { n: progress, total: A4_EVAL_CASES.length })}
          </span>
        )}
        {s && progress === null && (
          <span data-testid="eval-result" className={s.passed ? "text-ok" : "text-warn"}>
            {t("eval.result", {
              right: s.right,
              total: s.total,
              share: pct(s.share),
              low: pct(s.low),
              high: pct(s.high),
              verdict: t(s.passed ? "eval.pass" : "eval.fail"),
            })}
          </span>
        )}
        <ul className="flex flex-col gap-1">
          {scores.map((sc) => {
            const title = t(`eval.case.${sc.id}` as Key);
            return (
              <li key={sc.id} className="text-xs text-muted">
                {sc.failed
                  ? t("eval.failedCase", { title, code: sc.failed })
                  : t("eval.case", { title, right: sc.right, total: sc.total })}
                {sc.wrong.length > 0 && !sc.failed && (
                  <ul className="ml-4 list-disc">
                    {sc.wrong.map((w) => (
                      <li key={w.label}>
                        {t("eval.wrong", {
                          label: w.label,
                          expected: t(classKey(w.expected)),
                          got: w.got ? t(classKey(w.got)) : "—",
                        })}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function MapperScreen() {
  const t = useT();
  const { lang } = useLang();
  const sample = useSampleFn();
  const confirm = useConfirmedMapping((s) => s.confirm);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [rows, setRows] = useState<CheckedRow[]>([]);
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [streamed, setStreamed] = useState(0);
  const runRef = useRef(0);
  const pasted = useMemo(() => parsePastedSegments(text), [text]);
  const running = phase.kind === "running";
  const showStop = useAfter(running, 2000);
  const reconciliation = useMemo(() => recompute(rows), [rows]);
  const aiAvailable = sample !== null;

  const startReview = (next: CheckedRow[], failure: AiFailure | null, extra: string[]) => {
    setRows(next);
    setIncluded(new Set(next.map((r) => r.source)));
    setPhase({ kind: "review", failure, extra });
  };

  async function runAi() {
    const ctl = new AbortController();
    const id = ++runRef.current;
    setStreamed(0);
    setPhase({ kind: "running", ctl });
    const res = await mapSegments(sample ?? null, pasted, {
      now: pageNow,
      signal: ctl.signal,
      lang,
      onText: (s) => setStreamed(s.length),
    });
    if (id !== runRef.current) return;
    if (res.status === "ok") startReview(res.rows, null, res.extra);
    else startReview(res.fallback, res.failure, []);
  }

  function useDefaults() {
    startReview(defaultMapping(pasted).rows, null, []);
  }

  function pick(source: string, c: ClassTarget) {
    setRows((rs) =>
      rs.map((r) => {
        if (r.source !== source) return r;
        const { override: _drop, ...rest } = r;
        void _drop;
        return { ...rest, weights: { [c]: 1 }, origin: "edited", issues: [], numberEscapes: [] };
      }),
    );
  }

  const chosen = rows.filter((r) => included.has(r.source));
  const blocked = chosen.some((r) => r.issues.length > 0 || checkWeights(r.weights) !== null);
  const fmt = (n: number) => formatNumber(lang, n, 0);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("mapper.title")}</h1>
        <p className="max-w-prose text-sm text-muted">{t("mapper.lead")}</p>
        {sample === null && <p className="text-sm text-warn">{t("mapper.noAi")}</p>}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor="mapper-input" className="text-sm font-medium">
            {t("mapper.inputLabel")}
          </label>
          <button
            type="button"
            id="mapper-example"
            onClick={() => setText(KBA_EXAMPLE)}
            className="text-xs text-accent underline-offset-2 hover:underline"
          >
            {t("mapper.example")}
          </button>
        </div>
        <textarea
          id="mapper-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          spellCheck={false}
          className="mono w-full rounded-lg border border-line bg-bg p-3 text-xs"
          aria-describedby="mapper-hint mapper-parsed"
        />
        <p id="mapper-hint" className="text-xs text-muted">
          {t("mapper.inputHint")}
        </p>
        <p id="mapper-parsed" className="mono text-xs text-muted" aria-live="polite">
          {t("mapper.parsed", {
            rows: pasted.rows.length,
            withVolume: pasted.rows.filter((r) => r.volume !== undefined).length,
            withPrice: pasted.rows.filter((r) => r.price !== undefined).length,
          })}
        </p>
        {pasted.warnings.map((w, i) => (
          <p key={i} className="text-xs text-warn">
            {w.kind === "duplicate"
              ? t("mapper.warn.duplicate", { label: w.label })
              : t("mapper.warn.truncated", { kept: w.kept, total: w.total })}
          </p>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            id="mapper-run"
            onClick={runAi}
            disabled={!aiAvailable || sample === undefined || running || pasted.rows.length === 0}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg disabled:opacity-40"
          >
            {t("mapper.run")}
          </button>
          <button
            type="button"
            id="mapper-default"
            onClick={useDefaults}
            disabled={running || pasted.rows.length === 0}
            className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm font-medium disabled:opacity-40"
          >
            {t("mapper.useDefault")}
          </button>
          {running && (
            <span className="text-sm text-muted" aria-live="polite">
              {t("ai.thinking")}
              {streamed > 0 && <span className="mono text-xs"> · {fmt(streamed)}</span>}
            </span>
          )}
          {running && showStop && (
            <button
              type="button"
              id="mapper-stop"
              onClick={() => phase.ctl.abort()}
              className="rounded-lg border border-line px-3 py-1.5 text-sm"
            >
              {t("ai.stop")}
            </button>
          )}
        </div>
      </section>

      {pasted.rows.length === 0 && phase.kind === "idle" && (
        <p className="text-sm text-muted">{t("mapper.empty")}</p>
      )}

      {phase.kind === "review" && (
        <section
          aria-labelledby="receipt"
          className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5"
        >
          {phase.failure && (
            <p className="text-sm text-warn" role="status">
              {t(`ai.error.${phase.failure.action}` as Key, { code: phase.failure.code })}
            </p>
          )}
          {phase.extra.length > 0 && (
            <p className="text-xs text-warn">
              {t("mapper.extra", { labels: phase.extra.join(", ") })}
            </p>
          )}
          <h2 id="receipt" className="sr-only">
            {t("mapper.title")}
          </h2>
          <div className="overflow-x-auto">
            <table
              className="w-full min-w-[42rem] border-collapse text-sm"
              data-testid="mapping-table"
            >
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-2 pr-2 font-medium">{t("mapper.col.include")}</th>
                  <th className="py-2 pr-2 font-medium">{t("mapper.col.source")}</th>
                  <th className="py-2 pr-2 text-right font-medium">{t("mapper.col.volume")}</th>
                  <th className="py-2 pr-2 font-medium">{t("mapper.col.class")}</th>
                  <th className="py-2 pr-2 font-medium">{t("mapper.col.reason")}</th>
                  <th className="py-2 pr-2 font-medium">{t("mapper.col.confidence")}</th>
                  <th className="py-2 font-medium">{t("mapper.col.origin")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const on = included.has(r.source);
                  const bad = r.issues.length > 0;
                  return (
                    <tr
                      key={r.source}
                      className={`border-t border-line align-top ${bad && on ? "bg-block/5" : ""} ${on ? "" : "opacity-50"}`}
                    >
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={on}
                          aria-label={`${t("mapper.col.include")}: ${r.source}`}
                          onChange={() =>
                            setIncluded((s) => {
                              const n = new Set(s);
                              if (n.has(r.source)) n.delete(r.source);
                              else n.add(r.source);
                              return n;
                            })
                          }
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <div className={bad && on ? "text-block" : ""}>{r.source}</div>
                        {r.issues.map((x) => (
                          <div key={x} className="text-xs text-block">
                            {t(`mapper.issue.${x}` as Key)}
                          </div>
                        ))}
                      </td>
                      <td className="mono py-2 pr-2 text-right text-xs">
                        {r.volume !== undefined ? fmt(r.volume) : "—"}
                      </td>
                      <td className="py-2 pr-2">
                        <ClassCell row={r} onPick={(c) => pick(r.source, c)} />
                      </td>
                      <td className="py-2 pr-2 text-xs text-muted">
                        {r.reason}
                        {r.numberEscapes.length > 0 && (
                          <div className="text-warn">
                            {t("mapper.escapes", { numbers: r.numberEscapes.join(", ") })}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-xs">
                        {t(`mapper.confidence.${r.confidence}` as Key)}
                      </td>
                      <td className="py-2">
                        <OriginBadge row={r} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            className="flex flex-col gap-1 rounded-lg bg-surface-2 p-3 text-sm"
            data-testid="reconciliation"
          >
            <span className="text-xs font-semibold">{t("mapper.recon.title")}</span>
            {!reconciliation && <span className="text-muted">{t("mapper.recon.none")}</span>}
            {reconciliation && (
              <>
                <span className={reconciliation.ok ? "text-ok" : "text-block"}>
                  {t(reconciliation.ok ? "mapper.recon.ok" : "mapper.recon.bad", {
                    mapped: fmt(reconciliation.mappedTotal),
                    input: fmt(reconciliation.inputTotal),
                    outOfScope: fmt(reconciliation.outOfScope),
                  })}
                </span>
                <span className="mono text-xs text-muted">
                  {(["small", "medium", "large", "premium"] as const)
                    .map((c) => `${t(classKey(c))} ${fmt(reconciliation.byClass[c])}`)
                    .join(" · ")}
                </span>
                {reconciliation.unmapped.length > 0 && (
                  <span className="text-xs text-block">
                    {t("mapper.recon.unmapped", { labels: reconciliation.unmapped.join(", ") })}
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              id="mapper-confirm"
              disabled={
                blocked || chosen.length === 0 || (reconciliation !== null && !reconciliation.ok)
              }
              onClick={() => {
                const ai = chosen.filter((r) => r.origin === "ai").length;
                const edited = chosen.filter((r) => r.origin === "edited").length;
                confirm({ rows: chosen, aiRows: ai, editedRows: edited });
                setPhase({ kind: "confirmed", count: chosen.length, ai, edited });
              }}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg disabled:opacity-40"
            >
              {t("mapper.confirm", { count: chosen.length })}
            </button>
            {blocked && <span className="text-xs text-block">{t("mapper.confirmBlocked")}</span>}
          </div>
        </section>
      )}

      {phase.kind === "confirmed" && (
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-ok bg-surface p-5">
          <p className="text-sm text-ok" role="status" data-testid="mapper-confirmed">
            {t("mapper.confirmed", { count: phase.count, ai: phase.ai, edited: phase.edited })}
          </p>
          <button
            type="button"
            onClick={() => {
              setRows([]);
              setPhase({ kind: "idle" });
            }}
            className="rounded-lg border border-line px-3 py-1.5 text-sm"
          >
            {t("mapper.discard")}
          </button>
        </section>
      )}

      <EvalPanel disabled={running} />
    </div>
  );
}
