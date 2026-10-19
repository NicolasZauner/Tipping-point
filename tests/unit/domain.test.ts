import { describe, expect, it } from "vitest";
import { passportSchema } from "../../src/domain/schema";
import {
  ADOPTER_GROUPS,
  DomainError,
  POWERTRAINS,
  isHistory,
  isOutlook,
  ratio,
  share,
  year,
} from "../../src/domain/types";

const valid = {
  value: 1.75,
  unit: "EUR/L",
  method: "data",
  source: {
    title: "Weekly Oil Bulletin, prices with taxes",
    publisher: "European Commission",
    url: "https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en",
  },
  retrieved: "2026-10-19",
  confidence: "high",
  low: 1.6,
  high: 1.95,
} as const;

describe("passport", () => {
  it("accepts a complete passport", () => {
    expect(passportSchema.parse(valid).value).toBe(1.75);
  });

  it("rejects a value without a source", () => {
    const rest: Record<string, unknown> = { ...valid };
    delete rest.source;
    expect(passportSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a source that isn't https", () => {
    const p = { ...valid, source: { ...valid.source, url: "http://example.com/x" } };
    expect(passportSchema.safeParse(p).success).toBe(false);
  });

  it("rejects a value outside its own range", () => {
    expect(passportSchema.safeParse({ ...valid, low: 1.8 }).success).toBe(false);
    expect(passportSchema.safeParse({ ...valid, high: 1.7 }).success).toBe(false);
  });

  it("rejects an assumption without a note and a derived value without inputs", () => {
    expect(passportSchema.safeParse({ ...valid, method: "assumption" }).success).toBe(false);
    expect(
      passportSchema.safeParse({ ...valid, method: "assumption", note: "Midpoint of two studies" })
        .success,
    ).toBe(true);
    expect(passportSchema.safeParse({ ...valid, method: "derived" }).success).toBe(false);
    expect(passportSchema.safeParse({ ...valid, method: "derived", from: ["a"] }).success).toBe(
      true,
    );
  });

  it("rejects unknown fields and malformed dates", () => {
    expect(passportSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
    expect(passportSchema.safeParse({ ...valid, retrieved: "19.10.2026" }).success).toBe(false);
  });
});

describe("branded units", () => {
  it("shares stay in [0, 1]", () => {
    expect(share(0)).toBe(0);
    expect(share(1)).toBe(1);
    expect(() => share(-0.01)).toThrow(DomainError);
    expect(() => share(1.0001)).toThrow(DomainError);
    expect(() => share(Number.NaN)).toThrow(DomainError);
  });

  it("ratios are positive", () => {
    expect(ratio(0.95)).toBe(0.95);
    expect(() => ratio(0)).toThrow(DomainError);
  });

  it("years are integers from 2018 to 2040, with history and outlook marked", () => {
    expect(() => year(2017)).toThrow(DomainError);
    expect(() => year(2041)).toThrow(DomainError);
    expect(() => year(2026.5)).toThrow(DomainError);
    expect(isHistory(year(2025))).toBe(true);
    expect(isHistory(year(2026))).toBe(false);
    expect(isOutlook(year(2035))).toBe(false);
    expect(isOutlook(year(2036))).toBe(true);
  });

  it("keeps the orderings the choice rule relies on", () => {
    expect(POWERTRAINS).toEqual(["ICE", "FHEV", "PHEV", "BEV"]);
    expect(ADOPTER_GROUPS[0]).toBe("innovators");
    expect(ADOPTER_GROUPS.at(-1)).toBe("laggards");
  });
});
