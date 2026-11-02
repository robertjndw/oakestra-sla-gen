import { renderInHost } from "@oakestra/dashboard-sdk/testing";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { actionProps, InToolbar } from "../test-utils";
import type { ServiceCreateResult, SlaV2 } from "../types";
import { AddServicesButton } from "./AddServicesButton";
import { application, deployedService, slaService } from "./fixtures";
import { GeneratorContext } from "./generator-context";

const user = { username: "alice", organization: "org-1" };

// The API model's output type lists every optional field as present, so build it loosely.
const result = (fields: { deployed_services: object[]; failed_services: object[] }) =>
  fields as unknown as ServiceCreateResult;

const slaWith = (...services: object[]) => ({
  sla_version: "v2.0",
  customerID: "org-1",
  applications: [{ application_name: "renamed", application_namespace: "default", microservices: services }],
});

function renderButton(sla: object, create?: (sla: SlaV2) => Promise<ServiceCreateResult>) {
  return renderInHost(
    <GeneratorContext value={{ application: application(), services: [deployedService()] }}>
      <InToolbar>
        <AddServicesButton {...actionProps(sla)} />
      </InToolbar>
    </GeneratorContext>,
    { user, api: create ? { services: { create } } : {} },
  );
}

describe("AddServicesButton", () => {
  it("is disabled when the SLA adds nothing", () => {
    renderButton(slaWith(slaService()));
    const button = screen.getByRole("button", { name: /add services to shop/i });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("creates only the new services in the existing application", async () => {
    const create = vi.fn(async (_sla: SlaV2) =>
      result({ deployed_services: [{ service_name: "db" }], failed_services: [] }),
    );
    const { notify } = renderButton(
      slaWith(slaService({ memory: 1024 }), slaService({ microservice_name: "db", code: "postgres:16" })),
      create,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add 1 service to shop" }));
    expect(await screen.findByText(/web \(memory\)/)).toBeTruthy();
    expect(screen.getByText(/names the application renamed/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add services" }));

    await waitFor(() => expect(notify.calls).toHaveLength(1));
    const body = create.mock.calls[0]?.[0];
    expect(body?.applications[0]?.applicationID).toBe("app-1");
    expect(body?.applications[0]?.application_name).toBe("shop");
    expect(body?.applications[0]?.microservices.map((s) => s.microservice_name)).toEqual(["db"]);
  });

  it("shows the backend's reasons when every service failed", async () => {
    renderButton(slaWith(slaService({ microservice_name: "db" })), async () =>
      result({ deployed_services: [], failed_services: [{ service_name: "db", message: "image not found" }] }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Add 1 service to shop" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add services" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not create the service. db: image not found",
    );
  });
});
