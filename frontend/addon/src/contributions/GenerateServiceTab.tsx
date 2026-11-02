import type { ApplicationContext } from "@oakestra/dashboard-sdk";
import { Skeleton } from "@oakestra/ui";
import { lazy, Suspense } from "react";

// The playground (CodeMirror, React Flow and all) loads only when someone opens the tab.
const ApplicationGenerator = lazy(() => import("../generate/ApplicationGenerator"));

export function GenerateServiceTab({ applicationId }: ApplicationContext) {
  return (
    // Tabs, unlike addon pages, get no Suspense boundary from the shell.
    <Suspense fallback={<Skeleton className="slagen:h-[560px] slagen:w-full" />}>
      <ApplicationGenerator applicationId={applicationId} layout="tab" />
    </Suspense>
  );
}
