import { describe, expect, it } from "vitest";
import { formatMb, joinWords, plural } from "./format";

describe("format", () => {
  it("pluralizes", () => {
    expect(plural(1, "service")).toBe("1 service");
    expect(plural(2, "service")).toBe("2 services");
    expect(plural(0, "entry", "entries")).toBe("0 entries");
  });
  it("joins words", () => {
    expect(joinWords([])).toBe("");
    expect(joinWords(["a"])).toBe("a");
    expect(joinWords(["a", "b"])).toBe("a and b");
    expect(joinWords(["a", "b", "c"])).toBe("a, b and c");
  });
  it("formats memory", () => {
    expect(formatMb(512)).toBe("512 MB");
    expect(formatMb(1024)).toBe("1 GB");
    expect(formatMb(1536)).toBe("1.5 GB");
  });
});
