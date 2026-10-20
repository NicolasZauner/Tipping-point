import { describe, expect, it } from "vitest";
import { parseEafoTables, sampleSizes, timeframeCounts } from "../../scripts/lib/eafo";

const section = (id: string, title: string, table: string) =>
  `<div id="${id}" class="section level3"><h3>${title}</h3>${table}</div>`;
const tbl = (caption: string, head: string[], rows: string[][]) =>
  `<table><caption>${caption}</caption><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;

const timeframe = (rows: string[][]) =>
  section(
    "consideration-timeframe-bev",
    "Consideration Timeframe BEV",
    tbl("Timeframe &amp; more", ["Timeframe", "Frequency", "Proportion"], rows),
  );
const good = [
  ["I don't know", "10", "10.00%"],
  ["No", "20", "20.00%"],
  ["Yes, but without time frame in mind", "10", "10.00%"],
  ["Yes, within 0-2 years", "15", "15.00%"],
  ["Yes, within 2-3 years", "15", "15.00%"],
  ["Yes, within 3-5 years", "20", "20.00%"],
  ["Yes, within 5-10 years", "10", "10.00%"],
];
const gender = section(
  "gender",
  "Gender",
  tbl(
    "Gender",
    ["Gender", "Driver Type", "Frequency", "Group total", "Proportion"],
    [
      ["Female", "BEV-Driver", "3", "10", "30.00%"],
      ["Male", "BEV-Driver", "7", "10", "70.00%"],
      ["Female", "non-BEV-Driver", "50", "100", "50.00%"],
      ["Male", "non-BEV-Driver", "50", "100", "50.00%"],
    ],
  ),
);

describe("EAFO page parser", () => {
  it("reads tables with their section, decodes entities and straight apostrophes", () => {
    const t = parseEafoTables(timeframe(good) + gender);
    expect(t.map((x) => x.id)).toEqual(["consideration-timeframe-bev", "gender"]);
    expect(t[0]?.caption).toBe("Timeframe & more");
    expect(timeframeCounts(t)["I don’t know"]).toBe(10);
    expect(sampleSizes(t)).toEqual({ bevDrivers: 10, nonBevDrivers: 100 });
  });

  it("fails on a printed proportion that doesn't match its count", () => {
    const bad = good.map((r) => (r[0] === "No" ? ["No", "20", "21.00%"] : r));
    expect(() => timeframeCounts(parseEafoTables(timeframe(bad)))).toThrow(/doesn't add up/);
  });

  it("fails on a missing or unknown answer", () => {
    expect(() => timeframeCounts(parseEafoTables(timeframe(good.slice(1))))).toThrow(/missing/);
    const odd = [...good.slice(0, 6), ["Maybe", "10", "10.00%"]];
    expect(() => timeframeCounts(parseEafoTables(timeframe(odd)))).toThrow(/unexpected/);
  });

  it("treats table text as text: markup inside a cell is stripped, nothing is followed", () => {
    const sneaky = good.map((r) =>
      r[0] === "No"
        ? ['<a href="https://x.test">No</a><script>alert(1)</script>', "20", "20.00%"]
        : r,
    );
    expect(timeframeCounts(parseEafoTables(timeframe(sneaky))).No).toBe(20);
  });
});
