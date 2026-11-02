import { describe, expect, it } from "vitest";
import { deployedService, slaService } from "./fixtures";
import { planAdditions } from "./plan-additions";

describe("planAdditions", () => {
  it("creates only services the application doesn't run yet", () => {
    const db = slaService({ microservice_name: "db", code: "postgres:16" });
    const plan = planAdditions([slaService(), db], [deployedService()]);
    expect(plan).toEqual({ toCreate: [db], changed: [], removed: [], renamed: [], duplicates: [] });
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
    expect(plan).toEqual({ toCreate: [], changed: [], removed: [], renamed: [], duplicates: ["db"] });
  });

  it("reports deployed services the SLA leaves out", () => {
    const plan = planAdditions([], [deployedService(), deployedService({ microservice_name: "cache" })]);
    expect(plan.removed).toEqual(["web", "cache"]);
  });

  it("reads the runtime the backend stores as the SLA's container", () => {
    const plan = planAdditions([slaService()], [deployedService({ virtualization: "docker" })]);
    expect(plan.changed).toEqual([]);
  });

  it("treats resources left at zero or at the generator's default as unset", () => {
    const plan = planAdditions(
      [slaService({ vgpus: 0, storage: 0, vcpus: 1, memory: 100 })],
      [deployedService({ vcpus: 0, memory: undefined, vgpus: undefined, storage: 0 })],
    );
    expect(plan.changed).toEqual([]);
  });

  it("ignores fields the generator can't write", () => {
    const plan = planAdditions(
      [slaService()],
      [
        deployedService({
          args: ["--verbose"],
          one_shot: false,
          privileged: true,
          vtpus: 0,
          bandwidth_in: 10,
          bandwidth_out: 10,
          sla_violation_strategy: "restart",
          addresses: { rr_ip: "10.30.0.1", rr_ip_v6: "fdff::1" },
          constraints: [{ type: "latency", area: "munich", threshold: 50, rigidness: 1, convergence_time: 60 }],
        }),
      ],
    );
    expect(plan.changed).toEqual([]);
  });

  it("compares ports by meaning, not spelling", () => {
    const plan = planAdditions(
      [slaService({ port: "443:443;80:80/tcp" })],
      [deployedService({ port: "80;443:443/tcp" })],
    );
    expect(plan.changed).toEqual([]);
    const udp = planAdditions([slaService({ port: "80:80/udp" })], [deployedService({ port: "80" })]);
    expect(udp.changed).toEqual([{ name: "web", fields: ["port"] }]);
  });

  it("does not create a deployed service again under a shorter name", () => {
    const deployed = deployedService({ microservice_name: "alertmanager", code: "prom/alertmanager:v0.27" });
    const plan = planAdditions(
      [slaService({ microservice_name: "alertmgr", code: "prom/alertmanager:v0.27" })],
      [deployed],
    );
    expect(plan.toCreate).toEqual([]);
    expect(plan.renamed).toEqual([{ name: "alertmgr", deployed: "alertmanager" }]);
    expect(plan.removed).toEqual([]);
  });

  it("creates a service with another service's image when its service IP differs", () => {
    const copy = slaService({ microservice_name: "web2", addresses: { rr_ip: "10.30.0.2" } });
    const plan = planAdditions([copy], [deployedService()]);
    expect(plan.toCreate).toEqual([copy]);
    expect(plan.renamed).toEqual([]);
    expect(plan.removed).toEqual(["web"]);
  });
});
