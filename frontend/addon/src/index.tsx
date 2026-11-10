import "./addon.css";

import { defineAddon } from "@oakestra/dashboard-sdk";
import { WandSparklesIcon } from "lucide-react";
import { lazy } from "react";
import { ADDON_ID } from "virtual:oakestra-addon";
import { GenerateServiceTab } from "./contributions/GenerateServiceTab";

// Everything heavy sits behind these imports. The shell loads this module on every page for the
// nav item and the tab, so it must stay small.
const PlaygroundPage = lazy(() => import("./pages/PlaygroundPage"));
const ApplicationGeneratorPage = lazy(() => import("./pages/ApplicationGeneratorPage"));

export default defineAddon({
  id: ADDON_ID,
  label: "SLA generator",
  // The playground is a two-pane editor that needs the width more than a readable line length,
  // so its pages leave the shell's centered column.
  routes: [
    { index: true, fullWidth: true, Component: PlaygroundPage },
    {
      path: "applications/:applicationId",
      crumb: "Generate services",
      fullWidth: true,
      Component: ApplicationGeneratorPage,
    },
  ],
  contributions: {
    "nav.items": [{ id: "main", label: "SLA generator", path: "", icon: WandSparklesIcon }],
    "application.detail.tabs": [{ id: "generate", label: "Generate service", component: GenerateServiceTab }],
  },
});
