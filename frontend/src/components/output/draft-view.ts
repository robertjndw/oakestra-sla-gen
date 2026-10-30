import { useSyncExternalStore } from "react";
import { useSessionContext } from "@/hooks/session-context";
import type { Round, SessionState } from "@/hooks/use-session";
import { scrollIntoViewGently } from "./focus-service";

export type DraftRound = Extract<Round, { kind: "draft" }>;

export function draftRounds(rounds: Round[]): DraftRound[] {
  return rounds.filter((r): r is DraftRound => r.kind === "draft");
}

export function findDraft(rounds: Round[], draft: number): DraftRound | null {
  return draftRounds(rounds).find((r) => r.draft === draft) ?? null;
}

/**
 * A request to show an older draft. It only holds for the conversation state it was made in, so
 * nothing has to remember to clear it on accept, a new draft, a new session or a history open.
 */
export interface DraftSelection {
  draft: number;
  anchor: string;
}

type AnchorState = Pick<SessionState, "sessionId" | "rounds" | "codeViewRequest">;

/**
 * Changes whenever a draft or an accept lands, or the conversation is replaced. Round ids start
 * over with every session, hence the session id. Loading a failed attempt into the editor adds no
 * draft, so its request counter is part of the anchor too, or the old draft would stay on screen.
 */
export function selectionAnchor(s: AnchorState): string {
  const last = s.rounds.findLast((r) => r.kind === "draft" || r.kind === "accepted");
  return `${s.sessionId ?? ""}:${last?.id ?? ""}:${s.codeViewRequest}`;
}

export function selectDraft(draft: number | null, s: AnchorState & Pick<SessionState, "draftCount">): DraftSelection | null {
  // The latest draft is what the editor already shows (hand edits included), so picking it just
  // goes back to the working copy.
  if (draft === null || draft >= s.draftCount) return null;
  return { draft, anchor: selectionAnchor(s) };
}

/** The older draft to show instead of the working copy, or null for the working copy. */
export function resolveViewedDraft(
  sel: DraftSelection | null,
  s: AnchorState & Pick<SessionState, "draftCount">,
): DraftRound | null {
  if (!sel || sel.draft >= s.draftCount || sel.anchor !== selectionAnchor(s)) return null;
  return findDraft(s.rounds, sel.draft);
}

// Kept outside the session state: which draft is on screen is a view concern, and persisting it
// would bring a stale view back after a reload.
let selection: DraftSelection | null = null;
const listeners = new Set<() => void>();

function setSelection(next: DraftSelection | null) {
  if (next === selection) return;
  selection = next;
  for (const l of listeners) l();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

const getSelection = () => selection;

/** Shared by the output pane and the conversation, which both pick drafts. */
export function useViewedDraft(): { viewed: DraftRound | null; viewDraft: (draft: number | null) => void } {
  const { state } = useSessionContext();
  const sel = useSyncExternalStore(subscribe, getSelection, getSelection);
  const viewDraft = (draft: number | null) => setSelection(selectDraft(draft, state));
  return { viewed: resolveViewedDraft(sel, state), viewDraft };
}

/** What a draft heading in the conversation needs to pick the draft the SLA pane shows. */
export function useDraftNav(): { latest: number; viewed: number | null; onView: (draft: number) => void } {
  const { state } = useSessionContext();
  const { viewed, viewDraft } = useViewedDraft();
  return {
    latest: state.draftCount,
    viewed: viewed?.draft ?? null,
    onView: (draft) => {
      viewDraft(draft);
      revealOutputPane();
    },
  };
}

/** Test helper: module state outlives a single test. */
export function clearViewedDraft(): void {
  setSelection(null);
}

export const OUTPUT_PANE_ID = "sla-output";

/**
 * When the panes are stacked (narrow screens), the SLA sits below the conversation, so picking a
 * draft there would otherwise change nothing visible.
 */
export function revealOutputPane(): void {
  const el = document.getElementById(OUTPUT_PANE_ID);
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.top < window.innerHeight && r.bottom > 0) return;
  scrollIntoViewGently(el, "start");
}
