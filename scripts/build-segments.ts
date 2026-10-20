// TP P4: EAFO Consumer Monitor 2023 + ACEA fleet → adopter-group sizes per market.
// Run with `npm run data:segments`. Reads data-raw/ (gitignored), writes src/data/generated/.
// Deterministic: same files in, same JSON out (keys sorted by the fixed market and group order).

import { readFileSync, writeFileSync } from "node:fs";
import { passportSchema } from "../src/domain/schema";
import { ADOPTER_GROUPS, MARKETS, type Market } from "../src/domain/types";
import { GROUP_MAPPINGS, groupSizes } from "../src/model/segments";
import { parseEafoTables, sampleSizes, table, timeframeCounts, type EafoTable } from "./lib/eafo";
import acea from "../src/data/sources/acea-fleet.json" with { type: "json" };

const FILES: Record<Market | "EU", string> = {
  DE: "EAFO Germany.html",
  FR: "EAFO France.html",
  ES: "EAFO Spain.html",
  IT: "EAFO Italy.html",
  NL: "EAFO The Netherlands.html",
  BE: "EAFO Belgium.html",
  EU: "EU (all data).html",
};
const KEEP = [
  "consideration-timeframe-bev",
  "drivetrain-next-car",
  "timeframe-next-car",
  "parking-possibilities",
  "ownership-model-main-car-dt",
  "km-per-year-all",
  "w2p-petrol",
  "w2p-bev",
  "subsidy-impact",
  "familiarity-with-bev",
  "accommodation-type",
  "income",
] as const;

/** Unweighted online panel: effective sample = n / 1.5. Docs/segments.md says why. */
const DESIGN_EFFECT = 1.5;
const RETRIEVED = "2026-10-20";
const EAFO_SOURCE = {
  title: "EAFO Consumer Monitor 2023, descriptive statistics",
  publisher: "European Alternative Fuels Observatory (VUB-MOBI for DG MOVE)",
  url: "https://alternative-fuels-observatory.ec.europa.eu/consumer-portal",
};

const pick = (t: EafoTable) => ({ caption: t.caption, headers: t.headers, rows: t.rows });

const survey: Record<string, unknown> = {};
const groups: Record<string, unknown> = {};
for (const m of [...MARKETS, "EU"] as const) {
  const tables = parseEafoTables(readFileSync(`data-raw/${FILES[m]}`, "utf8"));
  const counts = timeframeCounts(tables);
  survey[m] = {
    file: FILES[m],
    respondents: sampleSizes(tables),
    timeframe: counts,
    tables: Object.fromEntries(KEEP.map((id) => [id, pick(table(tables, id))])),
  };
  if (m === "EU") continue;

  const fleet = passportSchema.parse(acea.bevFleetShare[m]["2023"]);
  // Some fleet BEVs are company cars rather than early private adopters; the low end allows 20%.
  const innovators = { value: fleet.value, low: fleet.value * 0.8, high: fleet.value * 1.25 };
  const byMapping: Record<string, unknown> = {};
  for (const mapping of Object.values(GROUP_MAPPINGS)) {
    const g = groupSizes(counts, innovators, mapping, DESIGN_EFFECT);
    byMapping[mapping.id] = Object.fromEntries(
      ADOPTER_GROUPS.map((a) => {
        const s = g.sizes[a];
        const isInn = a === "innovators";
        const p = passportSchema.parse({
          value: s.value,
          unit: "share of drivers",
          method: "derived",
          source: isInn ? fleet.source : EAFO_SOURCE,
          retrieved: RETRIEVED,
          confidence: isInn ? "medium" : g.n / DESIGN_EFFECT > 600 ? "medium" : "low",
          low: s.low,
          high: s.high,
          from: isInn
            ? [`acea.bevFleetShare.${m}.2023`]
            : [`eafo2023.${m}.timeframe`, `acea.bevFleetShare.${m}.2023`],
          note: isInn
            ? "BEV share of the car fleet, 2023; range 0.8× to 1.25× for company cars and growth since."
            : `(1 − innovators) × share of ${g.n} non-BEV drivers' answers (${mapping.groups[a as Exclude<typeof a, "innovators">].join("; ")}); 95% Wilson interval, design effect ${DESIGN_EFFECT}.`,
        });
        return [a, p];
      }),
    );
  }
  groups[m] = { n: Object.values(counts).reduce((s, x) => s + x, 0), byMapping };
}

const header = {
  generatedBy: "scripts/build-segments.ts",
  designEffect: DESIGN_EFFECT,
  default: "ladder",
};
writeFileSync(
  "src/data/generated/eafo-2023.json",
  JSON.stringify({ source: EAFO_SOURCE, retrieved: RETRIEVED, markets: survey }, null, 1) + "\n",
);
writeFileSync(
  "src/data/generated/groups.json",
  JSON.stringify({ ...header, markets: groups }, null, 1) + "\n",
);
console.log("wrote src/data/generated/eafo-2023.json and groups.json");
