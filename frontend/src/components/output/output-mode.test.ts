import { describe, expect, it } from "vitest";
import { isOutputMode, titleFor } from "./output-mode";

describe("titleFor", () => {
  it("covers each state", () => {
    const base = { fromHistory: false };
    expect(titleFor({ ...base, text: "", hasSla: false, draftCount: 0, edited: false })).toBe("No draft yet");
    expect(titleFor({ ...base, text: "{}", hasSla: true, draftCount: 0, edited: true })).toBe("Hand-edited SLA");
    expect(titleFor({ ...base, text: "{}", hasSla: true, draftCount: 2, edited: false })).toBe("Draft 2");
    expect(titleFor({ ...base, text: "{}", hasSla: true, draftCount: 2, edited: true })).toBe("Draft 2, edited");
    expect(titleFor({ text: "{}", hasSla: true, draftCount: 0, edited: false, fromHistory: true })).toBe("From history");
    expect(titleFor({ text: "{}", hasSla: true, draftCount: 0, edited: true, fromHistory: true })).toBe(
      "From history, edited",
    );
  });
});

describe("isOutputMode", () => {
  it("accepts only the two modes", () => {
    expect(isOutputMode("code")).toBe(true);
    expect(isOutputMode("x")).toBe(false);
  });
});
