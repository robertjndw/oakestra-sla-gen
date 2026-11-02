import { describe, expect, it } from "vitest";
import { apiBaseFor } from "./api-base";

describe("apiBaseFor", () => {
  it("puts the API next to the addon's asset folder behind the dashboard proxy", () => {
    expect(
      apiBaseFor("http://dash.example/addon-assets/sla-generator/assets/index-abc123.js", false, "http://dash.example"),
    ).toBe("/addon-assets/sla-generator/api");
  });

  it("uses the last assets segment, so an addon folder named assets doesn't confuse it", () => {
    expect(apiBaseFor("http://dash/x/assets/addon-assets/assets/chunk.js", false, "http://dash")).toBe(
      "/x/assets/addon-assets/api",
    );
  });

  it("works for modules outside assets/, like remoteEntry.js", () => {
    expect(apiBaseFor("http://dash/addon-assets/sla-generator/remoteEntry.js", false, "http://dash")).toBe(
      "/addon-assets/sla-generator/api",
    );
  });

  it("stays absolute when the addon is served from another origin (vite preview)", () => {
    expect(apiBaseFor("http://localhost:5180/assets/index-abc.js", false, "http://localhost:5173")).toBe(
      "http://localhost:5180/api",
    );
  });

  it("follows the shell's ADDON_ASSETS proxy when previewing through the dev shell", () => {
    expect(
      apiBaseFor("http://localhost:5173/addon-assets/sla-generator/assets/index-abc.js", false, "http://localhost:5173"),
    ).toBe("/addon-assets/sla-generator/api");
  });

  it("uses the dev server's root proxy in dev", () => {
    expect(apiBaseFor("http://localhost:5180/src/ensure-api-base.ts?t=1", true, "http://localhost:5173")).toBe(
      "http://localhost:5180/api",
    );
  });
});
