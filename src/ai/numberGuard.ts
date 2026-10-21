// Number guard (docs/ai-contracts.md): every number in an AI answer must come from the data sent
// with the prompt or from a tool result. Unmatched numbers are highlighted and the answer gets a
// "check numbers" badge; for the brief they block the download.

export type GuardLang = "en" | "de";

/** Values an answer may cite. Shares (0 to 1) may appear as percentages; years match only years. */
export type Allowed = { numbers: number[]; shares: number[]; points: number[]; years: Set<number> };

const POINT_KEY = /(pp|pct|percent|points?)$/i;

/** Collects every number in the prompt data and tool outputs (walks objects and arrays). */
export function allowedFrom(sources: unknown[]): Allowed {
  const a: Allowed = { numbers: [], shares: [], points: [], years: new Set() };
  const walk = (v: unknown, key: string) => {
    if (typeof v === "number" && Number.isFinite(v)) {
      a.numbers.push(v);
      if (v >= 0 && v <= 1) a.shares.push(v);
      if (POINT_KEY.test(key)) a.points.push(v);
      if (Number.isInteger(v) && v >= 1990 && v <= 2060) a.years.add(v);
    } else if (typeof v === "string") {
      // Numbers inside data strings ("2018 to 2025", "€45,000") count too: they were sent.
      for (const t of tokenize(v, "en")) walk(t.value, key);
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) walk(x, k);
  };
  sources.forEach((s) => walk(s, ""));
  return a;
}

export type NumberToken = {
  text: string;
  start: number;
  end: number;
  value: number;
  /** Half a unit in the last written digit, at the token's scale. */
  tolerance: number;
  kind: "number" | "percent" | "year";
  matched: boolean;
};

const SCALES: [RegExp, number][] = [
  [/^(k|K|Tsd\.?)$/, 1e3],
  [/^(million|millions|Mio\.?)$/, 1e6],
  [/^(bn|billion|billions|Mrd\.?)$/, 1e9],
];

const NUMBER =
  /(€\s?)?(\d+(?:[.,]\d+)*)(?:\s?(%|percent|per cent|Prozent|pp|percentage points?|points?|Prozentpunkte?))?(?:\s?(k|K|Tsd\.?|million|millions|Mio\.?|bn|billion|billions|Mrd\.?)(?![\p{L}]))?(\s?€)?/gu;

function parseDigits(raw: string, lang: GuardLang): { value: number; decimals: number } | null {
  const group = lang === "en" ? "," : ".";
  const dec = lang === "en" ? "." : ",";
  const parts = raw.split(dec);
  if (parts.length > 2) return null;
  const [intPart = "", fracPart] = parts;
  // Grouped integers need blocks of three after the first: "35,304" yes, "41,2" (en) no.
  const groups = intPart.split(group);
  if (groups.length > 1 && groups.slice(1).some((g) => g.length !== 3)) return null;
  const digits = groups.join("") + (fracPart !== undefined ? "." + fracPart : "");
  const value = Number(digits);
  return Number.isFinite(value) ? { value, decimals: fracPart?.length ?? 0 } : null;
}

function tokenize(text: string, lang: GuardLang): Omit<NumberToken, "matched">[] {
  const out: Omit<NumberToken, "matched">[] = [];
  for (const m of text.matchAll(NUMBER)) {
    const start = m.index;
    const [whole, euroBefore, digits = "", unit, scaleWord, euroAfter] = m;
    const before = text[start - 1] ?? "";
    // "CO2", "S5", "A4", "x2": digits glued to a letter are labels, not quantities.
    if (/[\p{L}_]/u.test(before)) continue;
    // A list marker: only whitespace before it on its line, then "." or ")" and a space.
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
    const after = text.slice(start + digits.length, start + digits.length + 2);
    if (!euroBefore && !text.slice(lineStart, start).trim() && /^[.)]\s/.test(after)) continue;

    let parsed = parseDigits(digits, lang);
    // The other convention as a fallback ("0.951" in a German answer is still that number).
    parsed ??= parseDigits(digits, lang === "en" ? "de" : "en");
    if (!parsed) continue;
    const scale = SCALES.find(([re]) => scaleWord && re.test(scaleWord))?.[1] ?? 1;
    const isPercent = unit !== undefined;
    const isYear =
      !isPercent &&
      !euroBefore &&
      !euroAfter &&
      scale === 1 &&
      /^\d{4}$/.test(digits) &&
      parsed.value >= 1990 &&
      parsed.value <= 2060;
    const end = start + whole.trimEnd().length;
    out.push({
      text: text.slice(start, end),
      start,
      end,
      value: parsed.value * scale,
      tolerance: 0.5 * 10 ** -parsed.decimals * scale * (1 + 1e-9),
      kind: isYear ? "year" : isPercent ? "percent" : "number",
    });
  }
  return out;
}

const near = (candidates: number[], value: number, tol: number) =>
  candidates.some((c) => Math.abs(Math.abs(c) - value) <= tol);

export function guardNumbers(
  answer: string,
  allowed: Allowed,
  lang: GuardLang,
): { tokens: NumberToken[]; escapes: number } {
  const tokens = tokenize(answer, lang).map((t): NumberToken => {
    switch (t.kind) {
      case "year":
        return { ...t, matched: allowed.years.has(t.value) };
      case "percent":
        return {
          ...t,
          matched:
            near(
              allowed.shares.map((s) => s * 100),
              t.value,
              t.tolerance,
            ) || near(allowed.points, t.value, t.tolerance),
        };
      case "number":
        return { ...t, matched: near(allowed.numbers, t.value, t.tolerance) };
      default: {
        const never: never = t.kind;
        return never;
      }
    }
  });
  return { tokens, escapes: tokens.filter((t) => !t.matched).length };
}
