import { describe, expect, it } from "vitest";
import groups from "../../src/data/generated/groups.json";
import survey from "../../src/data/generated/eafo-2023.json";
import { passportSchema } from "../../src/domain/schema";
import { ADOPTER_GROUPS, MARKETS } from "../../src/domain/types";
import { TIMEFRAME_ANSWERS } from "../../src/domain/survey";
import { GROUP_MAPPINGS } from "../../src/model/segments";

// Guards the generated files: rerun `npm run data:segments` and these must still hold.
describe("generated group sizes", () => {
  it.each(MARKETS)("%s: every size has a passport and each mapping sums to 1", (m) => {
    const market = groups.markets[m];
    expect(market.n).toBe(
      TIMEFRAME_ANSWERS.reduce((s, a) => s + survey.markets[m].timeframe[a], 0),
    );
    for (const id of Object.keys(GROUP_MAPPINGS)) {
      const sizes = market.byMapping[id as keyof typeof market.byMapping];
      const sum = ADOPTER_GROUPS.reduce((s, a) => s + passportSchema.parse(sizes[a]).value, 0);
      expect(sum).toBeCloseTo(1, 12);
    }
  });

  it("keeps the timeframe ladder as the default", () => {
    expect(groups.default).toBe("ladder");
    expect(groups.survey).toBe("EAFO Consumer Monitor 2023");
    expect(groups.designEffect).toBe(1.5);
  });

  it("holds Germany's survey counts (checked against the country report: 37% within 0–5 years)", () => {
    const t = survey.markets.DE.timeframe;
    const n = groups.markets.DE.n;
    const within5 =
      t["Yes, within 0-2 years"] + t["Yes, within 2-3 years"] + t["Yes, within 3-5 years"];
    expect(Math.round((100 * within5) / n)).toBe(37);
    expect(Math.round((100 * t.No) / n)).toBe(29);
  });
});
