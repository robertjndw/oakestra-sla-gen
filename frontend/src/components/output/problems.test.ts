import { Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { problemItems, problemsByService, toDiagnostics } from "./problems";

const text = JSON.stringify(
  { applications: [{ application_name: "a", microservices: [{ microservice_name: "web", vcpus: 0 }] }] },
  null,
  2,
);

describe("problemsByService", () => {
  it("groups service problems and keeps the rest global", () => {
    const res = problemsByService(
      [
        "applications[0].microservices[1].vcpus: must be positive",
        "applications[0].microservices[1]: missing name",
        "<root>: bad version",
      ],
      null,
    );
    expect(res.by["0/1"]).toEqual(["must be positive (vcpus)", "missing name"]);
    expect(res.global).toEqual(["<root>: bad version"]);
  });

  it("ignores server problems while the JSON does not parse", () => {
    const res = problemsByService(["x: y"], { message: "boom", line: 1, column: 1 });
    expect(res).toEqual({ by: {}, global: [] });
  });
});

describe("problemItems", () => {
  it("maps paths to lines", () => {
    const items = problemItems(text, ["applications[0].microservices[0].vcpus: too low"], null);
    expect(items).toHaveLength(1);
    expect(text.split("\n")[items[0].line! - 1]).toContain("vcpus");
    expect(items[0].message).toBe("too low");
  });

  it("uses the parse error alone", () => {
    const items = problemItems("{", ["a: b"], { message: "Unexpected end", line: 1, column: 2 });
    expect(items).toEqual([{ line: 1, path: "", message: "Unexpected end" }]);
  });
});

describe("toDiagnostics", () => {
  it("covers the whole line and clamps unknown lines", () => {
    const diags = toDiagnostics(Text.of(["ab", "cde"]), [
      { line: 2, path: "p", message: "m" },
      { line: null, path: "", message: "n" },
      { line: 99, path: "", message: "o" },
    ]);
    expect(diags[0]).toMatchObject({ from: 3, to: 6, message: "m (p)" });
    expect(diags[1]).toMatchObject({ from: 0, to: 2 });
    expect(diags[2]).toMatchObject({ from: 3, to: 6 });
  });
});
