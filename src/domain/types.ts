// The domain's vocabulary as types. Terms are defined in CONTEXT.md; relations and invariants in
// docs/domain.md. Branded number types stop euros being added to shares or litres to kWh.

// ---- The grid -------------------------------------------------------------------------------

export const MARKETS = ["DE", "FR", "ES", "IT", "NL", "BE"] as const;
export type Market = (typeof MARKETS)[number];

/** Ordered from most to least conservative: ties in the choice rule go to the earlier one. */
export const POWERTRAINS = ["ICE", "FHEV", "PHEV", "BEV"] as const;
export type Powertrain = (typeof POWERTRAINS)[number];

export const VEHICLE_CLASSES = ["small", "medium", "large", "premium"] as const;
export type VehicleClass = (typeof VEHICLE_CLASSES)[number];

export const BUYER_TYPES = ["private-home", "private-no-home", "company"] as const;
export type BuyerType = (typeof BUYER_TYPES)[number];

/** Ordered from most to least tolerant; thresholds must fall in this order. */
export const ADOPTER_GROUPS = [
  "innovators",
  "early-adopters",
  "early-majority",
  "late-majority",
  "laggards",
] as const;
export type AdopterGroup = (typeof ADOPTER_GROUPS)[number];

export const FIRST_YEAR = 2018;
export const LAST_HISTORY_YEAR = 2025;
export const LAST_HEADLINE_YEAR = 2035;
export const LAST_YEAR = 2040;

// ---- Branded units --------------------------------------------------------------------------

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

/** Real 2025 euros. */
export type Eur = Brand<number, "Eur">;
/** A fraction in [0, 1]. */
export type Share = Brand<number, "Share">;
/** A TCO ratio against ICE; 1 is parity. */
export type Ratio = Brand<number, "Ratio">;
export type Year = Brand<number, "Year">;
export type Km = Brand<number, "Km">;
export type LPer100Km = Brand<number, "LPer100Km">;
export type KWhPer100Km = Brand<number, "KWhPer100Km">;
export type EurPerL = Brand<number, "EurPerL">;
export type EurPerKWh = Brand<number, "EurPerKWh">;

export class DomainError extends Error {
  override name = "DomainError";
}

function finite(x: number, what: string): number {
  if (!Number.isFinite(x)) throw new DomainError(`${what} must be a finite number, got ${x}`);
  return x;
}

export const eur = (x: number): Eur => finite(x, "euros") as Eur;

export function share(x: number): Share {
  finite(x, "share");
  if (x < 0 || x > 1) throw new DomainError(`share must be in [0, 1], got ${x}`);
  return x as Share;
}

export function ratio(x: number): Ratio {
  finite(x, "ratio");
  if (x <= 0) throw new DomainError(`ratio must be positive, got ${x}`);
  return x as Ratio;
}

export function year(x: number): Year {
  if (!Number.isInteger(x) || x < FIRST_YEAR || x > LAST_YEAR)
    throw new DomainError(`year must be an integer from ${FIRST_YEAR} to ${LAST_YEAR}, got ${x}`);
  return x as Year;
}

function nonNegative<T>(x: number, what: string): T {
  finite(x, what);
  if (x < 0) throw new DomainError(`${what} must not be negative, got ${x}`);
  return x as T;
}
export const km = (x: number) => nonNegative<Km>(x, "km");
export const lPer100Km = (x: number) => nonNegative<LPer100Km>(x, "L/100 km");
export const kWhPer100Km = (x: number) => nonNegative<KWhPer100Km>(x, "kWh/100 km");
export const eurPerL = (x: number) => nonNegative<EurPerL>(x, "€/L");
export const eurPerKWh = (x: number) => nonNegative<EurPerKWh>(x, "€/kWh");

export const isHistory = (y: Year) => y <= LAST_HISTORY_YEAR;
export const isOutlook = (y: Year) => y > LAST_HEADLINE_YEAR;

/** Exhaustiveness guard for switches over unions: a new member fails the typecheck here. */
export function assertNever(x: never): never {
  throw new DomainError(`unexpected value ${String(x)}`);
}

// ---- Provenance -----------------------------------------------------------------------------

export type Confidence = "high" | "medium" | "low";

/** Where a value on screen came from. */
export type Badge = "data" | "model" | "ai-confirmed" | "override";

// The passport type itself is inferred from its Zod schema in ./schema.ts.

// ---- Levers and scenarios -------------------------------------------------------------------

export const LEVER_GROUPS = [
  "vehicle-prices",
  "grants",
  "taxes",
  "energy-prices",
  "residual-values",
  "behaviour",
] as const;
/** The six groups are also the units of the Shapley attribution. */
export type LeverGroup = (typeof LEVER_GROUPS)[number];

export type LeverId = Brand<string, "LeverId">;

/** Which dimensions a lever may target; an omitted dimension means "all". */
export type LeverScope = {
  market?: Market;
  vehicleClass?: VehicleClass;
  powertrain?: Powertrain;
  buyerType?: BuyerType;
};

export type Lever = {
  id: LeverId;
  group: LeverGroup;
  unit: string;
  /** The dimensions this lever may be scoped to. */
  scopable: readonly (keyof LeverScope)[];
  min: number;
  max: number;
  /** True when a higher value always moves BEV share one way; goal seek needs this. */
  monotone: boolean;
};

export type LeverChange = {
  lever: LeverId;
  scope: LeverScope;
  from: number;
  to: number;
  years: readonly [Year, Year];
};

export type Scenario = {
  id: string;
  name: string;
  description: string;
  diff: readonly LeverChange[];
};
