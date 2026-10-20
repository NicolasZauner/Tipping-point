// The EAFO Consumer Monitor 2023 question the adopter groups are built from, asked of non-BEV
// drivers: "Would you consider buying a battery electric vehicle, and in what time frame?"

export const TIMEFRAME_ANSWERS = [
  "Yes, within 0-2 years",
  "Yes, within 2-3 years",
  "Yes, within 3-5 years",
  "Yes, within 5-10 years",
  "Yes, but without time frame in mind",
  "I don’t know",
  "No",
] as const;
export type TimeframeAnswer = (typeof TIMEFRAME_ANSWERS)[number];
export type TimeframeCounts = Readonly<Record<TimeframeAnswer, number>>;
