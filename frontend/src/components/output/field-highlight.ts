import { useEffect, useSyncExternalStore } from "react";
import { refersTo, serviceKey, type FactRow, type FieldRef } from "@/lib/field-ref";
import type { SlaMicroservice } from "@/lib/types";

// Questions sit in the conversation pane and service cards in the output pane. A module store
// links the two without threading hover state through App and both panes.

type Source = "hover" | "focus";

const active: Record<Source, FieldRef | null> = { hover: null, focus: null };
// Lowercased names of the service cards on screen, counted because two applications can each
// have a service with the same name.
const mounted = new Map<string, number>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function highlightField(ref: FieldRef | null, source: Source): void {
  if (ref === null || active[source] === ref) return;
  active[source] = ref;
  emit();
}

/** Clears `source` only if it still shows `ref`, so a late blur can't undo a newer hover. */
export function unhighlightField(ref: FieldRef | null, source: Source): void {
  if (ref === null || active[source] !== ref) return;
  active[source] = null;
  emit();
}

/** Drops whatever these refs still highlight, for questions that are going away. */
export function releaseFields(refs: (FieldRef | null)[]): void {
  for (const ref of refs) {
    unhighlightField(ref, "hover");
    unhighlightField(ref, "focus");
  }
}

// The pointer wins over focus: someone tabbing through the answers and then pointing at another
// question wants to see that one.
const current = () => active.hover ?? active.focus;

/**
 * Null when no question points at this service, otherwise the row it points at, or "" for the
 * card as a whole. A primitive per card, so hovering a question only re-renders the cards it
 * concerns.
 */
export function useFieldHighlight(ms: SlaMicroservice): FactRow | "" | null {
  return useSyncExternalStore(subscribe, () => {
    const ref = current();
    return ref && refersTo(ref, ms) ? (ref.row ?? "") : null;
  });
}

/** Marks a service card as on screen, so questions only offer "Show" when there is something to show. */
export function useMountedService(name: string | undefined): void {
  const key = serviceKey(name);
  useEffect(() => {
    if (!key) return;
    mounted.set(key, (mounted.get(key) ?? 0) + 1);
    emit();
    return () => {
      const left = (mounted.get(key) ?? 1) - 1;
      if (left > 0) mounted.set(key, left);
      else mounted.delete(key);
      emit();
    };
  }, [key]);
}

export function useServiceMounted(name: string): boolean {
  const key = serviceKey(name);
  return useSyncExternalStore(subscribe, () => mounted.has(key));
}
