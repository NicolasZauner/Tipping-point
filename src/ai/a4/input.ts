// Reads what a planner pastes into the segment mapper: a list of segment names, a segment table
// with volumes (copied from Excel or a KBA PDF), or a model list with brand, price and volume.
// Code parses; Claude only maps labels to classes.

export type PastedRow = { label: string; volume?: number; price?: number };
export type PasteWarning =
  { kind: "duplicate"; label: string } | { kind: "truncated"; kept: number; total: number };
export type PastedList = { rows: PastedRow[]; warnings: PasteWarning[] };

export const MAX_ROWS = 200;

const HEADER_WORD =
  /^(segment|segmente|class|klasse|model|modell|marke|brand|make|volume|units|zulassungen|neuzulassungen|registrations|price|preis|listenpreis|prix|precio|anzahl|count)$/i;
const PRICE_HEADER = /(price|preis|prix|precio)/i;

/** Integer-ish amounts in either convention: "312.455", "1,024,310", "55.000 €", "44990". */
export function parseAmount(cell: string): number | null {
  const s = cell
    .replace(/€|EUR|eur/g, "")
    .replace(/\s/g, "")
    .trim();
  if (!/^\d[\d.,]*$/.test(s)) return null;
  // Thousands groups of three, with "." or ","; an optional decimal part with the other mark.
  const m =
    /^(\d{1,3}(?:([.,])\d{3})*)(?:([.,])(\d{1,2}))?$/.exec(s) ??
    /^(\d+)(?:([.,])(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const group = m[2];
  const intDigits = (m[1] ?? "").replace(/[.,]/g, "");
  const dec = m[3] && m[3] !== group ? m[4] : undefined;
  const value = Number(intDigits + (dec ? "." + dec : ""));
  return Number.isFinite(value) ? value : null;
}

function splitCells(line: string): string[] {
  if (line.includes("\t")) return line.split("\t");
  if (line.includes(";")) return line.split(";");
  if (line.includes("|"))
    return line
      .split("|")
      .filter((c, i, a) => !(c.trim() === "" && (i === 0 || i === a.length - 1)));
  if (/\S\s{2,}\S/.test(line)) return line.split(/\s{2,}/);
  // "Compact 98,004": a trailing amount after one space only counts when it has a thousands
  // separator, so model names ending in digits ("Peugeot 2008", "Model 3") stay labels.
  const m = /^(.*\S)\s+(\d{1,3}(?:[.,]\d{3})+\s?€?)$/.exec(line.trim());
  return m ? [m[1] ?? "", m[2] ?? ""] : [line];
}

export function parsePastedSegments(text: string): PastedList {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const warnings: PasteWarning[] = [];
  let priceCol: number | null = null;
  let body = lines;
  const first = lines[0] ? splitCells(lines[0]).map((c) => c.trim()) : [];
  if (lines.length > 1 && first.length > 1 && first.every((c) => HEADER_WORD.test(c))) {
    const pc = first.findIndex((c) => PRICE_HEADER.test(c));
    priceCol = pc >= 0 ? pc : null;
    body = lines.slice(1);
  }

  const merged = new Map<string, PastedRow>();
  for (const line of body) {
    const cells = splitCells(line).map((c) => c.trim());
    const labelParts: string[] = [];
    let volume: number | undefined;
    let price: number | undefined;
    cells.forEach((cell, i) => {
      const n = parseAmount(cell);
      if (n === null) {
        if (cell) labelParts.push(cell);
      } else if (i === priceCol || /€|EUR/i.test(cell)) price = n;
      else volume = n;
    });
    const label = labelParts.join(" ").replace(/\s+/g, " ").trim();
    if (!label) continue;
    const prev = merged.get(label);
    if (prev) {
      warnings.push({ kind: "duplicate", label });
      if (volume !== undefined) prev.volume = (prev.volume ?? 0) + volume;
      continue;
    }
    merged.set(label, {
      label,
      ...(price !== undefined ? { price } : {}),
      ...(volume !== undefined ? { volume } : {}),
    });
  }
  let rows = [...merged.values()];
  if (rows.length > MAX_ROWS) {
    warnings.push({ kind: "truncated", kept: MAX_ROWS, total: rows.length });
    rows = rows.slice(0, MAX_ROWS);
  }
  return { rows, warnings };
}
