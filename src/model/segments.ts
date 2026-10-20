// Adopter-group sizes from the EAFO Consumer Monitor 2023 (docs/segments.md). Innovators are the
// people who already drive a BEV, measured by the BEV share of the car fleet; the other four
// groups split the rest by how soon non-BEV drivers say they'd consider a BEV.

import { ADOPTER_GROUPS, DomainError, share, type AdopterGroup, type Share } from "../domain/types";
import { TIMEFRAME_ANSWERS, type TimeframeAnswer, type TimeframeCounts } from "../domain/survey";

type SurveyGroup = Exclude<AdopterGroup, "innovators">;

export type GroupMapping = {
  id: string;
  label: string;
  groups: Readonly<Record<SurveyGroup, readonly TimeframeAnswer[]>>;
};

/** The two readings of the survey question (A8). The ladder is the default; "original" is the
 * plan's first draft and runs as a sensitivity. */
export const GROUP_MAPPINGS = {
  ladder: {
    id: "ladder",
    label: "Timeframe ladder",
    groups: {
      "early-adopters": ["Yes, within 0-2 years", "Yes, within 2-3 years"],
      "early-majority": ["Yes, within 3-5 years", "Yes, within 5-10 years"],
      "late-majority": ["Yes, but without time frame in mind", "I don’t know"],
      laggards: ["No"],
    },
  },
  original: {
    id: "original",
    label: "Five-year cut",
    groups: {
      "early-adopters": ["Yes, within 0-2 years", "Yes, within 2-3 years", "Yes, within 3-5 years"],
      "early-majority": ["Yes, within 5-10 years", "Yes, but without time frame in mind"],
      "late-majority": ["I don’t know"],
      laggards: ["No"],
    },
  },
} as const satisfies Record<string, GroupMapping>;

const Z95 = 1.959963984540054;

/** Wilson score interval at 95%. `designEffect` ≥ 1 shrinks the effective sample to n / deff,
 * for an unweighted online panel that isn't a simple random sample. */
export function wilson(k: number, n: number, designEffect: number): { low: number; high: number } {
  if (!(Number.isInteger(k) && Number.isInteger(n) && n > 0 && k >= 0 && k <= n))
    throw new DomainError(`wilson needs integers 0 ≤ k ≤ n, n > 0, got k=${k}, n=${n}`);
  if (!(designEffect >= 1)) throw new DomainError(`design effect must be ≥ 1, got ${designEffect}`);
  const m = n / designEffect;
  const p = k / n;
  const z2 = Z95 * Z95;
  const denom = 1 + z2 / m;
  const centre = (p + z2 / (2 * m)) / denom;
  const half = (Z95 / denom) * Math.sqrt((p * (1 - p)) / m + z2 / (4 * m * m));
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

export type GroupSize = { value: Share; low: Share; high: Share };
export type GroupSizes = { n: number; sizes: Record<AdopterGroup, GroupSize> };

/**
 * Group sizes for one market. `innovators` is the BEV share of the fleet with its range; each survey group
 * gets (1 − innovatorShare) × its share of answers. Intervals are per group (marginal), so the
 * lows and highs don't sum to 1; the values do.
 */
export function groupSizes(
  counts: TimeframeCounts,
  innovators: { value: number; low: number; high: number },
  mapping: GroupMapping,
  designEffect: number,
): GroupSizes {
  const { value: innovatorShare } = innovators;
  if (!(
    innovators.low > 0 &&
    innovators.low <= innovatorShare &&
    innovatorShare <= innovators.high &&
    innovators.high < 1
  ))
    throw new DomainError(
      `innovator share needs 0 < low ≤ value ≤ high < 1, got ${JSON.stringify(innovators)}`,
    );
  const n = TIMEFRAME_ANSWERS.reduce((s, a) => s + counts[a], 0);
  if (n <= 0) throw new DomainError("the survey question has no answers");
  const rest = 1 - innovatorShare;
  const sizes = {
    innovators: {
      value: share(innovatorShare),
      low: share(innovators.low),
      high: share(innovators.high),
    },
  } as Record<AdopterGroup, GroupSize>;
  for (const g of ADOPTER_GROUPS) {
    if (g === "innovators") continue;
    const k = mapping.groups[g].reduce((s, a) => s + counts[a], 0);
    const w = wilson(k, n, designEffect);
    sizes[g] = {
      value: share((rest * k) / n),
      low: share(rest * w.low),
      high: share(rest * w.high),
    };
  }
  return { n, sizes };
}
