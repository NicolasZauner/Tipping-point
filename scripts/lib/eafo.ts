// Reads the EAFO Consumer Monitor 2023 descriptive-statistics pages (R Markdown HTML, one per
// country plus the EU, by VUB-MOBI for the European Commission's DG MOVE; Commission material,
// reusable under CC BY 4.0 with attribution). The files are data: tables are read as text and
// nothing in them is executed or followed.

import {
  TIMEFRAME_ANSWERS,
  type TimeframeAnswer,
  type TimeframeCounts,
} from "../../src/domain/survey";

export type EafoTable = {
  id: string;
  title: string;
  caption: string;
  headers: string[];
  rows: string[][];
};

const decode = (s: string) =>
  s
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Every table in the page, tagged with the id and heading of the section it sits in. */
export function parseEafoTables(html: string): EafoTable[] {
  const out: EafoTable[] = [];
  const section =
    /<div id="([^"]+)" class="section level\d">\s*<h\d>([\s\S]*?)<\/h\d>([\s\S]*?)(?=<div id="[^"]+" class="section level|$)/g;
  for (const m of html.matchAll(section)) {
    const [, id = "", title = "", body = ""] = m;
    for (const t of body.matchAll(/<table[\s\S]*?<\/table>/g)) {
      const tb = t[0];
      const caption = decode(/<caption[^>]*>([\s\S]*?)<\/caption>/.exec(tb)?.[1] ?? "");
      const headers = [...tb.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((x) => decode(x[1] ?? ""));
      const rows = [...tb.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
        .map((r) =>
          [...(r[1] ?? "").matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => decode(c[1] ?? "")),
        )
        .filter((r) => r.length > 0);
      out.push({ id, title: decode(title), caption, headers, rows });
    }
  }
  return out;
}

const normaliseApostrophe = (s: string) => s.replace(/'/g, "’");

/** The BEV consideration question (non-BEV drivers): counts per answer, all seven required. */
export function timeframeCounts(tables: EafoTable[]): TimeframeCounts {
  const t = table(tables, "consideration-timeframe-bev");
  const counts: Partial<Record<TimeframeAnswer, number>> = {};
  for (const r of t.rows) {
    const answer = normaliseApostrophe(r[0] ?? "") as TimeframeAnswer;
    if (!TIMEFRAME_ANSWERS.includes(answer))
      throw new Error(`unexpected timeframe answer "${r[0]}"`);
    const n = Number(r[1]);
    if (!Number.isInteger(n) || n < 0) throw new Error(`bad count "${r[1]}" for "${answer}"`);
    if (counts[answer] !== undefined) throw new Error(`answer "${answer}" appears twice`);
    counts[answer] = n;
  }
  for (const a of TIMEFRAME_ANSWERS)
    if (counts[a] === undefined) throw new Error(`missing answer "${a}"`);
  checkProportions(t, 1, null);
  return counts as TimeframeCounts;
}

/** Respondents by driver type, from the gender table's group totals. */
export function sampleSizes(tables: EafoTable[]): { bevDrivers: number; nonBevDrivers: number } {
  const t = table(tables, "gender");
  checkProportions(t, 2, 3);
  const total = (type: string) => {
    const row = t.rows.find((r) => r[1] === type);
    const n = Number(row?.[3]);
    if (!Number.isInteger(n) || n <= 0) throw new Error(`no group total for ${type}`);
    return n;
  };
  return { bevDrivers: total("BEV-Driver"), nonBevDrivers: total("non-BEV-Driver") };
}

/** The page prints a proportion next to every count; recompute it and fail on any mismatch, so a
 * misread column can't pass silently. `countCol` holds the count, `totalCol` the group total (or
 * null when the table's counts sum to the total). Proportion is the last column. */
export function checkProportions(t: EafoTable, countCol: number, totalCol: number | null): void {
  const sum = t.rows.reduce((s, r) => s + Number(r[countCol]), 0);
  for (const r of t.rows) {
    const k = Number(r[countCol]);
    const n = totalCol === null ? sum : Number(r[totalCol]);
    const printed = Number((r.at(-1) ?? "").replace("%", ""));
    if (!(n > 0) || Math.abs((100 * k) / n - printed) > 0.006)
      throw new Error(`${t.id}: ${r.join(" | ")} doesn't add up (${k}/${n} vs ${printed}%)`);
  }
}

export function table(tables: EafoTable[], id: string): EafoTable {
  const found = tables.filter((x) => x.id === id);
  if (found.length !== 1) throw new Error(`expected one "${id}" table, found ${found.length}`);
  return found[0] as EafoTable;
}
