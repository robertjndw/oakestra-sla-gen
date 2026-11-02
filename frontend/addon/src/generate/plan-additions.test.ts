import { describe, expect, it } from "vitest";
import { deployedService, slaService } from "./fixtures";
import { planAdditions } from "./plan-additions";

describe("planAdditions", () => {
  it("creates only services the application doesn't run yet", () => {
    const db = slaService({ microservice_name: "db", code: "postgres:16" });
    const plan = planAdditions([slaService(), db], [deployedService()]);
    expect(plan).toEqual({ toCreate: [db], changed: [], removed: [], duplicates: [] });
  });

  it("reports existing services the SLA changes, with the fields", () => {
    const plan = planAdditions([slaService({ memory: 512, port: 8080 })], [deployedService()]);
    expect(plan.toCreate).toEqual([]);
    expect(plan.changed).toEqual([{ name: "web", fields: ["memory", "port"] }]);
  });

  it("treats missing, null and empty values as the same", () => {
    const plan = planAdditions([slaService({ cmd: [], args: null, constraints: undefined })], [deployedService()]);
    expect(plan.changed).toEqual([]);
  });

  it("plans nothing while the SLA uses a name twice", () => {
    const plan = planAdditions(
      [slaService({ microservice_name: "db" }), slaService({ microservice_name: "db", code: "postgres:16" })],
      [deployedService()],
    );
    expect(plan).toEqual({ toCreate: [], changed: [], removed: [], duplicates: ["db"] });
  });

  it("reports deployed services the SLA leaves out", () => {
    const plan = planAdditions([], [deployedService(), deployedService({ microservice_name: "cache" })]);
    expect(plan.removed).toEqual(["web", "cache"]);
  });
});
