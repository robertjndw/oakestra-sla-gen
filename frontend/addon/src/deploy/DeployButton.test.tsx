import { renderInHost } from "@oakestra/dashboard-sdk/testing";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { actionProps, InToolbar } from "../test-utils";
import type { Application, SlaV2 } from "../types";
import { DeployButton } from "./DeployButton";

const sla = {
  sla_version: "v2.0",
  customerID: "Admin",
  applications: [
    {
      applicationID: "",
      application_name: "shop",
      application_namespace: "default",
      microservices: [
        {
          microserviceID: "",
          microservice_name: "web",
          microservice_namespace: "default",
          virtualization: "container",
          code: "nginx:1.27",
        },
      ],
    },
  ],
};

const user = { username: "alice", organization: "org-1", roles: ["Application_Provider"] };

describe("DeployButton", () => {
  it("explains why it is disabled while the SLA is invalid", () => {
    renderInHost(
      <InToolbar>
        <DeployButton {...actionProps(sla, { validation: { status: "invalid", errors: ["bad"] } })} />
      </InToolbar>,
      { user },
    );
    expect(screen.getByRole("button", { name: /deploy/i }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByLabelText("Fix the problems in the SLA first.")).toBeTruthy();
  });

  it("is disabled for a session without organization", () => {
    renderInHost(
      <InToolbar>
        <DeployButton {...actionProps(sla)} />
      </InToolbar>,
      { user: { ...user, organization: null } },
    );
    expect(screen.getByRole("button", { name: /deploy/i }).hasAttribute("disabled")).toBe(true);
  });

  it("creates the application under the user's organization and opens it", async () => {
    const create = vi.fn(async (_sla: SlaV2) => [
      { _id: "other", application_name: "blog", application_namespace: "default" } as Application,
      { _id: "app-9", application_name: "shop", application_namespace: "default" } as Application,
    ]);
    const { notify } = renderInHost(
      <InToolbar>
        <DeployButton {...actionProps(sla)} />
      </InToolbar>,
      { user, api: { applications: { create } } },
    );

    fireEvent.click(screen.getByRole("button", { name: /deploy/i }));
    expect(await screen.findByText(/with 1 service/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Deploy" }));

    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/applications/app-9"));
    const body = create.mock.calls[0]?.[0];
    expect(body?.customerID).toBe("org-1");
    expect(body?.applications[0]).not.toHaveProperty("applicationID");
    expect(notify.calls.map((call) => call.level)).toEqual(["success"]);
  });

  it("shows a hint when the name is taken", async () => {
    const conflict = Object.assign(new Error("Application already exists."), { name: "ApiError", status: 409 });
    renderInHost(
      <InToolbar>
        <DeployButton {...actionProps(sla)} />
      </InToolbar>,
      { user, api: { applications: { create: () => Promise.reject(conflict) } } },
    );

    fireEvent.click(screen.getByRole("button", { name: /deploy/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Deploy" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Generate service tab");
  });
});
