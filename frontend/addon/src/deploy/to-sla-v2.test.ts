import { describe, expect, it } from "vitest";
import { creationErrors, toSlaV2 } from "./to-sla-v2";

const service = (overrides: Record<string, unknown> = {}) => ({
  microserviceID: "",
  microservice_name: "web",
  microservice_namespace: "default",
  virtualization: "container",
  code: "docker.io/library/nginx:latest",
  ...overrides,
});

const doc = (overrides: Record<string, unknown> = {}, services = [service()]) =>
  JSON.stringify({
    sla_version: "v2.0",
    customerID: "Admin",
    applications: [
      {
        applicationID: "",
        application_name: "shop",
        application_namespace: "default",
        application_desc: "A shop",
        microservices: services,
        ...overrides,
      },
    ],
  });

describe("toSlaV2", () => {
  it("files the SLA under the user's organization and drops the ids", () => {
    const result = toSlaV2(doc({ applicationID: "abc" }, [service({ microserviceID: "xyz" })]), "org-1");
    expect(result).toEqual({
      ok: true,
      sla: {
        sla_version: "v2.0",
        customerID: "org-1",
        applications: [
          {
            application_name: "shop",
            application_namespace: "default",
            application_desc: "A shop",
            microservices: [
              {
                microservice_name: "web",
                microservice_namespace: "default",
                virtualization: "container",
                code: "docker.io/library/nginx:latest",
              },
            ],
          },
        ],
      },
    });
  });

  it("drops empty ids too", () => {
    const result = toSlaV2(doc(), "org-1");
    if (!result.ok) throw new Error(result.errors.join());
    expect(result.sla.applications[0]).not.toHaveProperty("applicationID");
    expect(result.sla.applications[0]?.microservices[0]).not.toHaveProperty("microserviceID");
  });

  it("sets the version even when the document had another one", () => {
    const result = toSlaV2(JSON.stringify({ ...JSON.parse(doc()), sla_version: "v1.0" }), "org-1");
    expect(result.ok && result.sla.sla_version).toBe("v2.0");
  });

  it("rejects text that isn't JSON", () => {
    expect(toSlaV2("{ nope", "org-1")).toEqual({ ok: false, errors: ["The SLA is not valid JSON."] });
  });

  it("requires at least one application", () => {
    expect(toSlaV2(JSON.stringify({ applications: [] }), "org-1")).toEqual({
      ok: false,
      errors: ["The SLA contains no application."],
    });
    expect(toSlaV2("[]", "org-1").ok).toBe(false);
  });

  it("requires an organization", () => {
    expect(toSlaV2(doc(), null).ok).toBe(false);
    expect(toSlaV2(doc(), "").ok).toBe(false);
  });

  it("names every name the backend would refuse", () => {
    const result = toSlaV2(
      doc({ application_name: "my-shop", application_namespace: "" }, [
        service({ microservice_name: "web_1" }),
        service({ microservice_namespace: "x".repeat(33) }),
      ]),
      "org-1",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(4);
    expect(result.errors[0]).toContain('"my-shop"');
    expect(result.errors.join("\n")).toContain('"web_1"');
  });

  it("refuses two applications with the same name and namespace", () => {
    const app = JSON.parse(doc()).applications[0];
    const result = toSlaV2(JSON.stringify({ sla_version: "v2.0", applications: [app, app] }), "org-1");
    expect(result).toEqual({ ok: false, errors: ["The SLA has more than one application default/shop."] });
  });
});

describe("creationErrors", () => {
  const unikernel = (overrides: Record<string, unknown> = {}) =>
    service({ microservice_name: "uk", virtualization: "unikernel", ...overrides }) as never;

  it("asks for the arch of a unikernel", () => {
    expect(creationErrors([unikernel()])).toEqual([
      'Service uk is a unikernel, which needs an arch list such as ["amd64"]. Add it in the Code view.',
    ]);
    expect(creationErrors([unikernel({ arch: [] })])).toHaveLength(1);
  });

  it("accepts containers and unikernels with an arch", () => {
    expect(creationErrors([service() as never, unikernel({ arch: ["amd64"] })])).toEqual([]);
  });
});
