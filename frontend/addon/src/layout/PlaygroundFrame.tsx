import { memo, useCallback, useState } from "react";
import { Playground, WIDE_REM } from "@/components/playground";
import { useContainerMinWidth } from "@/hooks/use-container-min-width";
import { cn } from "@/lib/utils";
import { MIN_PLAYGROUND_HEIGHT_PX, useFillHeight } from "./use-fill-height";

/**
 * Gives the playground a box to lay out in. Side by side, the panes need a definite height to
 * scroll inside. Stacked (narrow), they grow taller than any sensible box, so then the frame only
 * sets a minimum and lets the page or the frame itself (tab) scroll.
 *
 * `page` reaches down to the bottom of the viewport; `tab` is a fixed share of it, because a tab
 * sits below the application header, which should stay partly in view.
 */
export type PlaygroundLayout = "tab" | "page";

// Memoized: the generator re-renders when a turn starts or ends (for the header), and nothing
// below this needs that.
export const PlaygroundFrame = memo(function PlaygroundFrame({ size }: { size: PlaygroundLayout }) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [widthRef, wide] = useContainerMinWidth<HTMLDivElement>(WIDE_REM);
  const fillHeight = useFillHeight(element, size === "page") ?? MIN_PLAYGROUND_HEIGHT_PX;

  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      setElement(el);
      widthRef(el);
    },
    [widthRef],
  );

  return (
    <div
      ref={ref}
      className={cn(
        "slagen:flex slagen:flex-col slagen:rounded-lg slagen:border slagen:bg-background",
        size === "tab"
          ? "slagen:h-[70dvh] slagen:min-h-[560px] slagen:overflow-y-auto"
          : "slagen:overflow-hidden",
      )}
      style={size === "page" ? (wide ? { height: fillHeight } : { minHeight: fillHeight }) : undefined}
    >
      {/* flex-1 fills the box; without min-h-0 the stacked layout can still outgrow it. */}
      <Playground className={cn("slagen:flex-1", wide && "slagen:min-h-0")} />
    </div>
  );
});
