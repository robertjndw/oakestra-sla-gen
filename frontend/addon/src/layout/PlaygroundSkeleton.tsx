import { Skeleton } from "@oakestra/ui";
import { MIN_PLAYGROUND_HEIGHT_PX } from "./use-fill-height";

// Not in PlaygroundFrame.tsx: the tab imports this eagerly, and that module would drag the whole
// playground into the tab's chunk.
export function PlaygroundSkeleton() {
  return <Skeleton className="slagen:w-full" style={{ height: MIN_PLAYGROUND_HEIGHT_PX }} />;
}
