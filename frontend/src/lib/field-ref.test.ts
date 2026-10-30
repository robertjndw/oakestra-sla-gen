import { describe, expect, it } from "vitest";
import { describeFieldRef, parseFieldRef, refersTo } from "./field-ref";

describe("parseFieldRef", () => {
  it.each([
    ["flask.memory", { service: "flask", key: "memory", row: "resources" }],
    ["flask.vcpus", { service: "flask", key: "vcpus", row: "resources" }],
    ["db.code", { service: "db", key: "code", row: "code" }],
    ["db.port", { service: "db", key: "port", row: "port" }],
    ["db.environment", { service: "db", key: "environment", row: "environment" }],
    ["db.cmd", { service: "db", key: "cmd", row: "cmd" }],
    ["db.constraints", { service: "db", key: "constraints", row: "constraints" }],
    ["db.virtualization", { service: "db", key: "virtualization", row: "virtualization" }],
    ["db.addresses", { service: "db", key: "addresses", row: "addresses" }],
  ])("reads %s", (raw, expected) => {
    expect(parseFieldRef(raw)).toEqual(expected);
  });

  it("reads a whole-service reference", () => {
    expect(parseFieldRef("redis")).toEqual({ service: "redis", key: null, row: null });
  });

  it("tolerates near misses and deeper paths", () => {
    expect(parseFieldRef(" api.Image ")).toMatchObject({ key: "code", row: "code" });
    expect(parseFieldRef("api.ports")).toMatchObject({ key: "port", row: "port" });
    expect(parseFieldRef("api.environment.DB_HOST")).toMatchObject({ key: "environment" });
    expect(parseFieldRef("api.addresses.rr_ip")).toMatchObject({ key: "addresses" });
  });

  it("keeps the service when the key is unknown", () => {
    expect(parseFieldRef("api.healthcheck")).toEqual({ service: "api", key: null, row: null });
    expect(parseFieldRef("api.constructor")).toEqual({ service: "api", key: null, row: null });
  });

  it.each([null, undefined, 42, "", "  ", "flask memory", ".memory", "my-api.port"])("ignores %j", (raw) => {
    expect(parseFieldRef(raw)).toBeNull();
  });
});

describe("refersTo", () => {
  it("matches the microservice name regardless of case", () => {
    const ref = parseFieldRef("Flask.memory")!;
    expect(refersTo(ref, { microservice_name: "flask" })).toBe(true);
    expect(refersTo(ref, { microservice_name: "redis" })).toBe(false);
    expect(refersTo(ref, {})).toBe(false);
  });
});

describe("describeFieldRef", () => {
  it("names the service and the field", () => {
    expect(describeFieldRef(parseFieldRef("flask.addresses")!)).toBe("flask service IP");
    expect(describeFieldRef(parseFieldRef("flask")!)).toBe("flask");
  });
});
