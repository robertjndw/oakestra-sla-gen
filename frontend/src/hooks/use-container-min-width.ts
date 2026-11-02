import { useCallback, useState, useSyncExternalStore } from "react";

// Container queries in rem resolve against the root font size, so this does the same to stay in
// step with the @5xl-style variants on the same element.
const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

/**
 * Whether the element given to the returned ref is at least `minRem` wide. The JS twin of a
 * container query: the playground follows the space its host gives it, not the viewport.
 */
export function useContainerMinWidth<T extends HTMLElement>(minRem: number): [(el: T | null) => void, boolean] {
  const [el, setEl] = useState<T | null>(null);
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!el || typeof ResizeObserver === "undefined") return () => {};
      const observer = new ResizeObserver(onChange);
      observer.observe(el);
      return () => observer.disconnect();
    },
    [el],
  );
  const matches = useSyncExternalStore(
    subscribe,
    // clientWidth matches the container's content box as long as it has no padding.
    () => el !== null && el.clientWidth >= minRem * remPx(),
    () => false,
  );
  return [setEl, matches];
}
