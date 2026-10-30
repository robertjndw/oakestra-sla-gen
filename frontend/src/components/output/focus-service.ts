import { serviceKey, type FieldRef } from "@/lib/field-ref";
import { serviceId } from "./map-layout";

const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export function scrollIntoViewGently(target: HTMLElement, block: ScrollLogicalPosition): void {
  target.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block });
}

function reveal(target: HTMLElement, block: ScrollLogicalPosition): void {
  scrollIntoViewGently(target, block);
  if (reduceMotion()) return;
  // No end keyframe: the animation settles back to whatever background the card already has.
  target.animate([{ backgroundColor: "var(--accent)" }, {}], { duration: 1400, easing: "ease-out" });
}

/** Scrolls a service card into view and briefly highlights it. */
export function focusService(s: { ai: number; mi: number }): void {
  const target = document.getElementById(serviceId(s));
  if (target) reveal(target, "start");
}

/**
 * Scrolls to the card row a question is about, or to the card when the row isn't shown. With
 * duplicate service names across applications, the first card wins.
 */
export function focusField(ref: FieldRef): void {
  // parseFieldRef only lets alphanumeric names through, so the name is safe inside the selector.
  const card = document.querySelector<HTMLElement>(`[data-service-name="${serviceKey(ref.service)}"]`);
  if (!card) return;
  const row = ref.row ? card.querySelector<HTMLElement>(`[data-row="${ref.row}"]`) : null;
  if (row) reveal(row, "center");
  else reveal(card, "start");
}
