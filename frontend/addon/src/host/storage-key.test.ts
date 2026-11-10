import { describe, expect, it } from "vitest";
import { dashboardStorageKey } from "./storage-key";

describe("dashboardStorageKey", () => {
  it("keeps conversations per scope and everything else per user", () => {
    const key = dashboardStorageKey("org-1", "alice", "app-123");
    expect(key("session")).toBe("oakestra.addon.sla-generator.org-1.alice.session.app-123");
    expect(key("composer")).toBe("oakestra.addon.sla-generator.org-1.alice.composer.app-123");
    expect(key("history")).toBe("oakestra.addon.sla-generator.org-1.alice.history");
    expect(key("settings")).toBe("oakestra.addon.sla-generator.org-1.alice.settings");
  });

  it("keeps users of the same name in different organizations apart", () => {
    expect(dashboardStorageKey("org-1", "alice", "page")("history")).not.toBe(
      dashboardStorageKey("org-2", "alice", "page")("history"),
    );
  });

  it("gives the split an id that is safe in the DOM", () => {
    expect(dashboardStorageKey("org-1", "a.b@example.org", "page")("split")).toMatch(/^[a-z0-9-]+$/);
  });
});
