import { describe, expect, it } from "vitest";
import { formatAnswers, initialAnswers } from "./answers";
import type { Clarification } from "./types";

const qs: Clarification[] = [
  { topic: "ports", question: "Which port?", assumption: "80" },
  { topic: "db", question: "Which database?", assumption: null },
  { topic: "cpu", question: "How many CPUs?", assumption: "1" },
];

describe("formatAnswers", () => {
  it("returns only the free text when there are no questions", () => {
    expect(formatAnswers([], [], "  more cpu ")).toBe("more cpu");
  });
  it("returns nothing when nothing was answered", () => {
    expect(formatAnswers(qs, initialAnswers(qs), "")).toBe("");
  });
  it("numbers answers, kept assumptions and open questions", () => {
    const answers = initialAnswers(qs);
    answers[1] = { mode: "answer", text: " postgres " };
    expect(formatAnswers(qs, answers, "")).toBe(
      ["1. Keep the assumption: 80", "2. postgres", "3. Keep the assumption: 1"].join("\n"),
    );
  });
  it("says no preference for an unanswered question without an assumption", () => {
    const answers = initialAnswers(qs);
    answers[0] = { mode: "answer", text: "8080" };
    expect(formatAnswers(qs, answers, "")).toContain("2. No preference, use your best judgement.");
  });
  it("ignores text typed before switching back to keep", () => {
    const answers = initialAnswers(qs);
    answers[0] = { mode: "keep", text: "9999" };
    answers[1] = { mode: "answer", text: "mysql" };
    expect(formatAnswers(qs, answers, "")).toContain("1. Keep the assumption: 80");
  });
  it("appends free text after a blank line", () => {
    const answers = initialAnswers(qs);
    expect(formatAnswers(qs, answers, "also use TLS").split("\n").slice(-2)).toEqual([
      "",
      "Also: also use TLS",
    ]);
  });
  it("sends free text alone with the defaults when nothing was answered", () => {
    expect(formatAnswers(qs, initialAnswers(qs), "x").startsWith("1. Keep the assumption: 80")).toBe(true);
  });
});
