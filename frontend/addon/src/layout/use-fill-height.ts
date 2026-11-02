import { useLayoutEffect, useState } from "react";

/** The shell's page gutter below the content (py-8 from md up). */
const BOTTOM_GAP_PX = 32;
export const MIN_PLAYGROUND_HEIGHT_PX = 560;

/**
 * Height that makes `element` reach down to the bottom of the viewport, so the playground fills
 * what the shell leaves below its header and breadcrumbs without a page scrollbar. Never below
 * MIN_PLAYGROUND_HEIGHT_PX: on short windows the page scrolls instead of the panes collapsing.
 */
export function useFillHeight(element: HTMLElement | null, enabled = true): number | undefined {
  const [height, setHeight] = useState<number>();

  useLayoutEffect(() => {
    if (!enabled || !element) return;
    const measure = () => {
      // Measured from the document top so a scrolled page doesn't shrink the box.
      const top = element.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(MIN_PLAYGROUND_HEIGHT_PX, Math.floor(window.innerHeight - top - BOTTOM_GAP_PX)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [element, enabled]);

  return enabled ? height : undefined;
}
