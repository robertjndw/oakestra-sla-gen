import { describe, expect, it } from "vitest";
import {
  errorLine,
  errorPosition,
  lineForPath,
  lineIndex,
  splitProblem,
} from "./json-paths";

const text = JSON.stringify(
  { applications: [{ application_name: "a", microservices: [{ microservice_name: "web", port: "80" }] }] },
  null,
  2,
);

describe("lineIndex", () => {
  const map = lineIndex(text);
  it("maps nested keys and array items to their lines", () => {
    expect(map["applications"]).toBe(2);
    expect(map["applications[0]"]).toBe(3);
    expect(map["applications[0].application_name"]).toBe(4);
    expect(map["applications[0].microservices[0].port"]).toBe(8);
  });
  it("maps the root to line 1", () => {
    expect(map[""]).toBe(1);
  });
  it("handles escaped quotes in strings", () => {
    const m = lineIndex('{\n  "a": "x\\"y",\n  "b": 1\n}');
    expect(m["b"]).toBe(3);
  });
  it("handles empty containers", () => {
    const m = lineIndex('{\n  "a": [],\n  "b": {},\n  "c": 1\n}');
    expect(m["c"]).toBe(4);
  });
});

describe("lineForPath", () => {
  const map = lineIndex(text);
  it("falls back to the nearest parent", () => {
    expect(lineForPath(map, "applications[0].microservices[0].vcpus")).toBe(
      map["applications[0].microservices[0]"],
    );
  });
  it("falls back to line 1", () => {
    expect(lineForPath(map, "nope")).toBe(1);
    expect(lineForPath(map, "")).toBe(1);
  });
});

describe("splitProblem", () => {
  it("splits path and message", () => {
    expect(splitProblem("applications[0].x: is required")).toEqual({
      path: "applications[0].x",
      message: "is required",
    });
  });
  it("treats <root> as the empty path", () => {
    expect(splitProblem("<root>: bad")).toEqual({ path: "", message: "bad" });
  });
  it("keeps a message without a path", () => {
    expect(splitProblem("plain")).toEqual({ path: "", message: "plain" });
  });
});

describe("errorLine", () => {
  it("reads an explicit line", () => {
    expect(errorLine("Unexpected token at line 7 column 2", "")).toBe(7);
  });
  it("derives the line from a position", () => {
    expect(errorLine("bad JSON at position 6", "a\nb\nc\nd")).toBe(4);
  });
  it("returns null when unknown", () => {
    expect(errorLine("oops", "")).toBeNull();
  });
  it("reads the column too", () => {
    expect(errorPosition("x at line 3 column 9", "")).toEqual({ line: 3, column: 9 });
  });
});
