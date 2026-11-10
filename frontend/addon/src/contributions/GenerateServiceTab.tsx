import type { ApplicationContext } from "@oakestra/dashboard-sdk";
import { lazy, Suspense } from "react";
import { PlaygroundSkeleton } from "../layout/PlaygroundSkeleton";

// The playground (CodeMirror, React Flow and all) loads only when someone opens the tab.
const ApplicationGenerator = lazy(() => import("../generate/ApplicationGenerator"));

export function GenerateServiceTab({ applicationId }: ApplicationContext) {
  return (
    // Tabs, unlike addon pages, get no Suspense boundary from the shell.
    <Suspense fallback={<PlaygroundSkeleton />}>
      <ApplicationGenerator applicationId={applicationId} layout="tab" />
    </Suspense>
  );
}
