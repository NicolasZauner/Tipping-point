import { afterEach, describe, expect, it, vi } from "vitest";
import { readStored, storageWorks, writeStored } from "../../src/platform/storage";

describe("guarded storage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("round-trips JSON values", () => {
    expect(writeStored("k", { a: 1 })).toBe(true);
    expect(readStored("k", null)).toEqual({ a: 1 });
    expect(storageWorks()).toBe(true);
  });

  it("returns the fallback when nothing is stored", () => {
    expect(readStored("missing", "fallback")).toBe("fallback");
  });

  it("survives a storage that throws, as inside a locked-down frame", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(readStored("k", 7)).toBe(7);
    expect(writeStored("k", 1)).toBe(false);
    expect(storageWorks()).toBe(false);
  });

  it("returns the fallback for corrupt JSON", () => {
    localStorage.setItem("bad", "{not json");
    expect(readStored("bad", 0)).toBe(0);
  });
});
