import { describe, expect, it } from "vitest";
import { dashboardStorageKey } from "./storage-key";

describe("dashboardStorageKey", () => {
  it("keeps conversations per scope and everything else per user", () => {
    const key = dashboardStorageKey("alice", "app-123");
    expect(key("session")).toBe("oakestra.addon.sla-generator.alice.session.app-123");
    expect(key("composer")).toBe("oakestra.addon.sla-generator.alice.composer.app-123");
    expect(key("history")).toBe("oakestra.addon.sla-generator.alice.history");
    expect(key("settings")).toBe("oakestra.addon.sla-generator.alice.settings");
  });

  it("gives the split an id that is safe in the DOM", () => {
    expect(dashboardStorageKey("a.b@example.org", "page")("split")).toMatch(/^[a-z0-9-]+$/);
  });
});
