import { describe, expect, it } from "vitest";
import { parsePastedSegments } from "../../../../src/ai/a4/input";

describe("pasted segment lists", () => {
  it("reads a bare list of labels", () => {
    const p = parsePastedSegments("Minis\nKleinwagen\n\n  Kompaktklasse  \n");
    expect(p.rows.map((r) => r.label)).toEqual(["Minis", "Kleinwagen", "Kompaktklasse"]);
    expect(p.rows.every((r) => r.volume === undefined)).toBe(true);
  });

  it("reads a KBA table copied from Excel with German thousands", () => {
    const p = parsePastedSegments(
      "Segment\tNeuzulassungen\nKleinwagen\t312.455\nSUVs\t1.024.310\n",
    );
    expect(p.rows).toEqual([
      { label: "Kleinwagen", volume: 312455 },
      { label: "SUVs", volume: 1024310 },
    ]);
  });

  it("reads a model list with brand, model, price in euros and volume", () => {
    const p = parsePastedSegments(
      "Marke;Modell;Listenpreis;Zulassungen\nBMW;iX1 xDrive30;55.000 €;1.200\nTesla;Model S Plaid;109.990 €;85\n",
    );
    expect(p.rows).toEqual([
      { label: "BMW iX1 xDrive30", price: 55000, volume: 1200 },
      { label: "Tesla Model S Plaid", price: 109990, volume: 85 },
    ]);
  });

  it("reads numbers trailing a label separated by spaces, English format", () => {
    const p = parsePastedSegments("Small SUV   145,200\nCompact 98,004");
    expect(p.rows).toEqual([
      { label: "Small SUV", volume: 145200 },
      { label: "Compact", volume: 98004 },
    ]);
  });

  it("keeps model names that end in digits as labels", () => {
    const p = parsePastedSegments("Peugeot 2008\nTesla Model 3\nMazda 2");
    expect(p.rows.map((r) => r.label)).toEqual(["Peugeot 2008", "Tesla Model 3", "Mazda 2"]);
    expect(p.rows.every((r) => r.volume === undefined)).toBe(true);
  });

  it("merges duplicate labels and says so", () => {
    const p = parsePastedSegments("SUVs\t100\nSUVs\t50");
    expect(p.rows).toEqual([{ label: "SUVs", volume: 150 }]);
    expect(p.warnings).toEqual([{ kind: "duplicate", label: "SUVs" }]);
  });

  it("caps very long pastes", () => {
    const p = parsePastedSegments(Array.from({ length: 250 }, (_, i) => `Model ${i}`).join("\n"));
    expect(p.rows).toHaveLength(200);
    expect(p.warnings).toContainEqual({ kind: "truncated", kept: 200, total: 250 });
  });
});
