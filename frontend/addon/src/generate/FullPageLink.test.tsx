import { renderInHost } from "@oakestra/dashboard-sdk/testing";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FullPageLink } from "./FullPageLink";

describe("FullPageLink", () => {
  it("links to the full page", () => {
    renderInHost(<FullPageLink to="/addons/sla-generator/applications/app-1" turnRunning={false} />);
    expect(screen.getByRole("link", { name: "Open full page" }).getAttribute("href")).toBe(
      "/addons/sla-generator/applications/app-1",
    );
  });

  it("waits while a turn runs, which leaving the tab would lose", () => {
    renderInHost(<FullPageLink to="/addons/sla-generator/applications/app-1" turnRunning />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("button", { name: "Open full page" }).hasAttribute("disabled")).toBe(true);
  });
});
