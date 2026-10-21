import { describe, expect, it } from "vitest";
import { allowedFrom, guardNumbers } from "../../../src/ai/numberGuard";

// What a market answer might be checked against: model output plus the data in the prompt.
const data = {
  market: "DE",
  year: 2030,
  bevShare: 0.4123,
  bevShare2025: 0.191,
  tcoRatio: 0.951,
  priceEur: 35304,
  maePp: 2.3,
  stock: { BEV: 1628000 },
};
const allowed = allowedFrom([data]);

const escapes = (text: string, lang: "en" | "de" = "en") =>
  guardNumbers(text, allowed, lang)
    .tokens.filter((t) => !t.matched)
    .map((t) => t.text);

describe("number guard", () => {
  it("passes numbers that are in the data at any displayed precision", () => {
    expect(
      escapes("In 2030 BEVs reach 41.2% (41% rounded), up from 19.1% in DE; the ratio is 0.95."),
    ).toEqual([]);
    expect(escapes("A BEV costs €35,304, about €35k, and the error is 2.3 points.")).toEqual([]);
    expect(escapes("There are 1.6 million BEVs on the road.")).toEqual([]);
  });

  it("reads German number formats", () => {
    expect(escapes("2030 erreichen BEVs 41,2 % und kosten 35.304 €.", "de")).toEqual([]);
  });

  it("catches a one-point shift", () => {
    expect(escapes("In 2030 BEVs reach 42.2%.")).toEqual(["42.2%"]);
  });

  it("catches a year that isn't in the data", () => {
    expect(escapes("BEVs reach 41.2% by 2031.")).toEqual(["2031"]);
  });

  it("catches a share stated as a fraction with a percent sign", () => {
    expect(escapes("BEVs reach 0.41%.")).toEqual(["0.41%"]);
  });

  it("catches an invented number among right ones", () => {
    expect(escapes("At €35,304 and a ratio of 0.951, about 230,000 buyers switch.")).toEqual([
      "230,000",
    ]);
  });

  it("ignores list markers and digits glued to letters (CO2, S5, A4)", () => {
    expect(escapes("1. Scenario S5 cuts CO2 rules; see A4.\n2. Done.")).toEqual([]);
  });

  it("gives character positions so the UI can highlight", () => {
    const g = guardNumbers("Up to 42.2% in 2030.", allowed, "en");
    const bad = g.tokens.find((t) => !t.matched);
    expect(bad && "Up to 42.2% in 2030.".slice(bad.start, bad.end)).toBe("42.2%");
    expect(g.escapes).toBe(1);
  });
});
