import { describe, expect, it } from "vitest";
import { passageValid } from "../../../src/ai/passages";

const source = `Artículo 3. Cuantía de las ayudas.
La ayuda será de 4.500 euros para turismos eléctricos (BEV) cuyo precio de venta no supere los
45.000 euros, IVA excluido — en ningún caso “acumulable” con otras ayudas.`;

describe("passage check", () => {
  it("accepts a passage that appears word for word, across line breaks", () => {
    expect(passageValid("cuyo precio de venta no supere los 45.000 euros", source)).toBe(true);
  });

  it("normalises quotes and dashes", () => {
    expect(passageValid('IVA excluido - en ningún caso "acumulable"', source)).toBe(true);
  });

  it("rejects a paraphrase or a changed number", () => {
    expect(passageValid("precio de venta inferior a 45.000 euros", source)).toBe(false);
    expect(passageValid("La ayuda será de 5.500 euros", source)).toBe(false);
  });

  it("rejects passages too short to prove anything", () => {
    expect(passageValid("BEV", source)).toBe(false);
  });
});
