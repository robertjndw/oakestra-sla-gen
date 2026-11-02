import { useCallback, useState } from "react";
import { Playground } from "@/components/playground";
import { useContainerMinWidth } from "@/hooks/use-container-min-width";
import { cn } from "@/lib/utils";
import { MIN_PLAYGROUND_HEIGHT_PX, useFillHeight } from "./use-fill-height";

/** Same breakpoint as the playground's own side-by-side layout (its @5xl container variant). */
const WIDE_REM = 64;

/**
 * Gives the playground a box to lay out in. Side by side, the panes need a definite height to
 * scroll inside. Stacked (narrow), they grow taller than any sensible box, so then the frame only
 * sets a minimum and lets the page (fill) or the frame itself (tab) scroll.
 *
 * `fill` reaches down to the bottom of the viewport; `tab` is a fixed share of it, because a tab
 * sits below the application header, which should stay partly in view.
 */
export function PlaygroundFrame({ size }: { size: "fill" | "tab" }) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [widthRef, wide] = useContainerMinWidth<HTMLDivElement>(WIDE_REM);
  const fillHeight = useFillHeight(element, size === "fill") ?? MIN_PLAYGROUND_HEIGHT_PX;

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
      style={size === "fill" ? (wide ? { height: fillHeight } : { minHeight: fillHeight }) : undefined}
    >
      {/* flex-1 fills the box; without min-h-0 the stacked layout can still outgrow it. */}
      <Playground className={cn("slagen:flex-1", wide && "slagen:min-h-0")} />
    </div>
  );
}
