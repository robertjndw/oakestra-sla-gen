import { describe, expect, it } from "vitest";
import { buildServiceSla } from "./build-service-sla";
import { application, slaService } from "./fixtures";

describe("buildServiceSla", () => {
  it("adds the services to the existing application under the user's organization", () => {
    const sla = buildServiceSla(application(), [slaService({ microserviceID: "", microservice_name: "db" })], "org-1");
    expect(sla).toEqual({
      sla_version: "v2.0",
      customerID: "org-1",
      applications: [
        {
          applicationID: "app-1",
          application_name: "shop",
          application_namespace: "default",
          application_desc: "Online shop",
          microservices: [{ ...slaService({ microservice_name: "db" }) }],
        },
      ],
    });
    expect(sla.applications[0]?.microservices[0]).not.toHaveProperty("microserviceID");
  });

  it("leaves out an empty description", () => {
    const sla = buildServiceSla(application({ application_desc: "" }), [], "org-1");
    expect(sla.applications[0]).not.toHaveProperty("application_desc");
  });
});
