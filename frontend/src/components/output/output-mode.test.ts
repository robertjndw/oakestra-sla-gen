import { describe, expect, it } from "vitest";
import { isOutputMode, titleFor } from "./output-mode";

describe("titleFor", () => {
  it("covers each state", () => {
    expect(titleFor({ text: "", hasSla: false, draftCount: 0, edited: false })).toBe("No draft yet");
    expect(titleFor({ text: "{}", hasSla: true, draftCount: 0, edited: true })).toBe("Hand-edited SLA");
    expect(titleFor({ text: "{}", hasSla: true, draftCount: 2, edited: false })).toBe("Draft 2");
    expect(titleFor({ text: "{}", hasSla: true, draftCount: 2, edited: true })).toBe("Draft 2, edited");
  });
});

describe("isOutputMode", () => {
  it("accepts only the two modes", () => {
    expect(isOutputMode("code")).toBe(true);
    expect(isOutputMode("x")).toBe(false);
  });
});
