import path from "node:path";
import { oakestraAddon } from "@oakestra/dashboard-sdk/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const sharedSrc = path.resolve(import.meta.dirname, "../src");
// The SDK and @oakestra/ui are linked from a dashboard checkout next to this repository.
const dashboardPackages = path.resolve(import.meta.dirname, "../../../oakestra-dashboard-v2/packages");

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // `name` is the addon name in /ui-addons and ADDON_ID; `prefix` must match prefix(slagen) in
    // src/addon.css and every class in ../src.
    oakestraAddon({ name: "sla-generator", prefix: "slagen", port: 5180 }),
  ],
  resolve: {
    alias: { "@": sharedSrc },
  },
  server: {
    // The playground code lives one level up, the SDK and ui sources in the dashboard checkout.
    fs: { allow: [path.resolve(import.meta.dirname, ".."), dashboardPackages] },
    proxy: {
      // Same contract as the addon container's nginx and the standalone dev server: /api is the
      // generator backend with the prefix stripped.
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
