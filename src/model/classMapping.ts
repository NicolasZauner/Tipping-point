// Vehicle-class mapping (scope D5, D14): any source segmentation to the four classes with
// weights, the premium override applied after the mapping, and the volume reconciliation.
// Pure: the segment mapper (A4) drafts rows, this module checks and applies them.

import { VEHICLE_CLASSES, type VehicleClass } from "../domain/types";

export type ClassTarget = VehicleClass | "out-of-scope";
export const CLASS_TARGETS: readonly ClassTarget[] = [...VEHICLE_CLASSES, "out-of-scope"];
export type Weights = Partial<Record<ClassTarget, number>>;

export type MappingRow = {
  source: string;
  weights: Weights;
  reason: string;
  confidence: "high" | "medium" | "low";
  origin: "default" | "ai" | "edited";
  override?: "brand" | "price";
};

/** Editable data (D14). Tesla is deliberately absent: it's classed by price. */
export const PREMIUM_BRANDS = [
  "Audi",
  "BMW",
  "Mercedes-Benz",
  "Mercedes",
  "Porsche",
  "Volvo",
  "Polestar",
  "Lexus",
  "Jaguar",
  "Land Rover",
  "Genesis",
  "Maserati",
] as const;
export const PREMIUM_PRICE_EUR = 60_000;

const TOL = 1e-6;

/** Null when fine, else what's wrong in plain words. */
export function checkWeights(w: Weights): string | null {
  const values = CLASS_TARGETS.map((c) => w[c]).filter((v): v is number => v !== undefined);
  if (values.some((v) => !Number.isFinite(v) || v < 0 || v > 1))
    return "every weight must be between 0 and 1";
  const sum = values.reduce((s, v) => s + v, 0);
  if (Math.abs(sum - 1) > TOL) return `weights must sum to 1, got ${Math.round(sum * 1e4) / 1e4}`;
  return null;
}

const one = (c: ClassTarget, source: string, reason: string): MappingRow => ({
  source,
  weights: { [c]: 1 },
  reason,
  confidence: "high",
  origin: "default",
});

export type DefaultMapping = { id: "kba" | "euro"; label: string; rows: MappingRow[] };

/** Fallbacks without AI. KBA from scope.md; European segments by the same logic (D is a large
 * car, not an SUV, so it is medium here). */
export const DEFAULT_MAPPINGS: Record<"kba" | "euro", DefaultMapping> = {
  kba: {
    id: "kba",
    label: "KBA segments (Germany)",
    rows: [
      one("small", "Minis", "City cars"),
      one("small", "Kleinwagen", "Small cars"),
      one("medium", "Kompaktklasse", "Compact cars"),
      one("medium", "Mittelklasse", "Mid-size cars"),
      one("premium", "Obere Mittelklasse", "Upper mid-size, mostly premium brands"),
      one("premium", "Oberklasse", "Luxury cars"),
      one("large", "SUVs", "SUVs"),
      one("large", "Geländewagen", "Off-road vehicles"),
      one("premium", "Sportwagen", "Sports cars"),
      one("medium", "Mini-Vans", "Small MPVs"),
      one("large", "Großraum-Vans", "Large MPVs"),
      one("out-of-scope", "Utilities", "Light commercial bodies"),
      one("out-of-scope", "Wohnmobile", "Motorhomes"),
      one("out-of-scope", "Sonstige", "Not assignable"),
    ],
  },
  euro: {
    id: "euro",
    label: "European segments A to F, J, M, S",
    rows: [
      one("small", "A", "Mini cars"),
      one("small", "B", "Small cars"),
      one("medium", "C", "Medium cars"),
      one("medium", "D", "Large cars (saloons and estates)"),
      one("premium", "E", "Executive cars"),
      one("premium", "F", "Luxury cars"),
      one("large", "J", "Sport utility vehicles"),
      one("medium", "M", "Multi-purpose cars"),
      one("premium", "S", "Sports coupés"),
    ],
  },
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const BRAND_RE = new RegExp(
  `^(?:${[...PREMIUM_BRANDS]
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .map(escapeRe)
    .join("|")})(?![\\p{L}\\p{N}])`,
  "iu",
);

export function premiumReason(source: string, price?: number): "brand" | "price" | null {
  if (BRAND_RE.test(source.trim())) return "brand";
  if (price !== undefined && price >= PREMIUM_PRICE_EUR) return "price";
  return null;
}

/** Applied after the mapping, whatever it said. Out-of-scope rows stay out of scope. */
export function applyPremiumOverride(
  rows: readonly MappingRow[],
  info: ReadonlyMap<string, { price?: number }>,
): MappingRow[] {
  return rows.map((r) => {
    if (r.weights["out-of-scope"] === 1) return r;
    const why = premiumReason(r.source, info.get(r.source)?.price);
    if (!why) return r;
    return { ...r, weights: { premium: 1 }, override: why };
  });
}

export type Reconciliation = {
  byClass: Record<VehicleClass, number>;
  outOfScope: number;
  inputTotal: number;
  mappedTotal: number;
  unmapped: string[];
  ok: boolean;
};

/** Volumes by class must add back to the input total within 0.5%, and no row with volume may
 * be left unmapped. */
export function reconcile(
  rows: readonly MappingRow[],
  volumes: ReadonlyMap<string, number>,
): Reconciliation {
  const byClass = Object.fromEntries(VEHICLE_CLASSES.map((c) => [c, 0])) as Record<
    VehicleClass,
    number
  >;
  let outOfScope = 0;
  const bySource = new Map(rows.map((r) => [r.source, r]));
  const unmapped: string[] = [];
  let inputTotal = 0;
  for (const [source, v] of volumes) {
    inputTotal += v;
    const r = bySource.get(source);
    if (!r) {
      if (v > 0) unmapped.push(source);
      continue;
    }
    for (const c of CLASS_TARGETS) {
      const w = r.weights[c] ?? 0;
      if (c === "out-of-scope") outOfScope += w * v;
      else byClass[c] += w * v;
    }
  }
  const mappedTotal = VEHICLE_CLASSES.reduce((s, c) => s + byClass[c], 0) + outOfScope;
  const ok =
    unmapped.length === 0 && Math.abs(mappedTotal - inputTotal) <= 0.005 * Math.max(inputTotal, 1);
  return { byClass, outOfScope, inputTotal, mappedTotal, unmapped: unmapped.sort(), ok };
}
