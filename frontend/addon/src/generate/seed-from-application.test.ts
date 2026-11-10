import { describe, expect, it } from "vitest";
import { application, deployedService } from "./fixtures";
import { MAX_SEED_CHARS, seedFromApplication } from "./seed-from-application";

describe("seedFromApplication", () => {
  it("keeps only SLA fields of the deployed services", () => {
    const doc = JSON.parse(seedFromApplication(application(), [deployedService()], "org-1"));
    expect(doc).toEqual({
      sla_version: "v2.0",
      customerID: "org-1",
      applications: [
        {
          application_name: "shop",
          application_namespace: "default",
          application_desc: "Online shop",
          microservices: [
            {
              microservice_name: "web",
              microservice_namespace: "default",
              virtualization: "container",
              code: "docker.io/library/nginx:1.27",
              memory: 256,
              vcpus: 1,
              port: "80:80",
              environment: ["MODE=prod"],
              addresses: { rr_ip: "10.30.0.1" },
            },
          ],
        },
      ],
    });
  });

  it("carries undeclared SLA fields the API passes through", () => {
    const doc = JSON.parse(
      seedFromApplication(application(), [deployedService({ arch: ["amd64"], one_shot: true, privileged: false })]),
    );
    const [service] = doc.applications[0].microservices;
    expect(service).toMatchObject({ arch: ["amd64"], one_shot: true, privileged: false });
  });

  it("falls back to image and the legacy RR_ip field", () => {
    const doc = JSON.parse(
      seedFromApplication(application(), [
        deployedService({ code: undefined, image: "redis:7", addresses: undefined, RR_ip: "10.30.0.9" }),
      ]),
    );
    expect(doc.applications[0].microservices[0]).toMatchObject({ code: "redis:7", addresses: { rr_ip: "10.30.0.9" } });
  });

  it("writes what the backend stores the way the generator accepts it", () => {
    const doc = JSON.parse(
      seedFromApplication(application(), [deployedService({ virtualization: "docker", port: "80/udp;8080:80" })]),
    );
    expect(doc.applications[0].microservices[0]).toMatchObject({ virtualization: "container", port: "80:80/udp;8080:80" });
  });

  it("omits the customer and an empty description", () => {
    const doc = JSON.parse(seedFromApplication(application({ application_desc: "" }), []));
    expect(doc).not.toHaveProperty("customerID");
    expect(doc.applications[0]).not.toHaveProperty("application_desc");
    expect(doc.applications[0].microservices).toEqual([]);
  });

  it("lists only the names when the full document would be too large", () => {
    const big = "x".repeat(2_000);
    const services = Array.from({ length: 40 }, (_, i) =>
      deployedService({ microservice_name: `svc${i}`, environment: [`BLOB=${big}`] }),
    );
    const text = seedFromApplication(application(), services);
    expect(text.length).toBeLessThanOrEqual(MAX_SEED_CHARS);
    const doc = JSON.parse(text);
    expect(doc.applications[0].microservices[3]).toEqual({ microservice_name: "svc3", microservice_namespace: "default" });
  });
});
