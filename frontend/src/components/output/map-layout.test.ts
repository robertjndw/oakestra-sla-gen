import { describe, expect, it } from "vitest";
import { findLinks, services } from "@/lib/sla";
import type { Sla } from "@/lib/types";
import { computeMapLayout, NODE_H } from "./map-layout";

const sla: Sla = {
  applications: [
    {
      application_name: "app",
      microservices: [
        {
          microservice_name: "web",
          port: "80",
          environment: ["API=10.30.0.2"],
          addresses: { rr_ip: "10.30.0.1" },
        },
        {
          microservice_name: "api",
          environment: ["DB=10.30.0.3"],
          addresses: { rr_ip: "10.30.0.2" },
        },
        { microservice_name: "db", addresses: { rr_ip: "10.30.0.3" } },
      ],
    },
  ],
};

describe("computeMapLayout", () => {
  it("places callers left of their dependencies", () => {
    const list = services(sla);
    const layout = computeMapLayout(list, findLinks(list));
    const x = (i: number) => layout.positions[`svc-0-${i}`].x;
    expect(x(0)).toBeLessThan(x(1));
    expect(x(1)).toBeLessThan(x(2));
  });

  it("adds an outside node left of everything when a port is open", () => {
    const list = services(sla);
    const layout = computeMapLayout(list, findLinks(list));
    expect(layout.exposed).toEqual(["svc-0-0"]);
    expect(layout.outside).not.toBeNull();
    expect(layout.outside!.x).toBeLessThan(layout.positions["svc-0-0"].x);
  });

  it("stacks unconnected services in one column without overlap", () => {
    const flat: Sla = {
      applications: [{ microservices: [{ microservice_name: "a" }, { microservice_name: "b" }] }],
    };
    const list = services(flat);
    const layout = computeMapLayout(list, []);
    expect(layout.outside).toBeNull();
    expect(layout.positions["svc-0-0"].x).toBe(layout.positions["svc-0-1"].x);
    expect(layout.positions["svc-0-1"].y - layout.positions["svc-0-0"].y).toBeGreaterThanOrEqual(NODE_H);
  });

  it("survives a cycle", () => {
    const cyc: Sla = {
      applications: [
        {
          microservices: [
            { microservice_name: "a", environment: ["X=10.0.0.2"], addresses: { rr_ip: "10.0.0.1" } },
            { microservice_name: "b", environment: ["Y=10.0.0.1"], addresses: { rr_ip: "10.0.0.2" } },
          ],
        },
      ],
    };
    const list = services(cyc);
    expect(Object.keys(computeMapLayout(list, findLinks(list)).positions)).toHaveLength(2);
  });

  it("handles an empty list", () => {
    expect(computeMapLayout([], [])).toMatchObject({ width: 0, height: 0, outside: null });
  });
});
