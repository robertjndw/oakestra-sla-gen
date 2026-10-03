import { serviceId } from "./map-layout";

/** Scrolls a service card into view and briefly highlights it. */
export function focusService(s: { ai: number; mi: number }): void {
  const target = document.getElementById(serviceId(s));
  if (!target) return;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  if (reduceMotion) return;
  // No end keyframe: the animation settles back to whatever background the card already has.
  target.animate([{ backgroundColor: "var(--accent)" }, {}], { duration: 1400, easing: "ease-out" });
}
