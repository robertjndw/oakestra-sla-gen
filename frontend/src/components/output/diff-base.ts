import { slaText } from "@/lib/sla";
import { findDraft, type DraftRound } from "./draft-view";

export interface DiffBase {
  /** Editor text to compare the shown text with. */
  original: string;
  /** Names the original for the status line, e.g. "draft 2". */
  against: string;
  /** The shown text is the hand-edited working copy rather than a model draft. */
  edits: boolean;
}

export interface DiffBaseInput {
  /** An older draft on screen instead of the working copy. */
  viewed: DraftRound | null;
  drafts: DraftRound[];
  draftCount: number;
  /** The working copy differs from the model's latest text. */
  edited: boolean;
  /** The model's latest text, or the SLA reopened from the history. */
  baselineText: string;
  fromHistory: boolean;
}

function draftText(drafts: DraftRound[], n: number): string | null {
  const d = findDraft(drafts, n);
  return d ? slaText(d.sla) : null;
}

/**
 * What "Show changes" compares against, or null when there is nothing to compare. An older draft
 * is compared with the one before it. The working copy is compared with the model's latest draft
 * once it has hand edits, because those are what the user wants to see, and otherwise with the
 * draft before the latest. The comparison is plain text, so it still works while the JSON
 * doesn't parse.
 */
export function diffBase(p: DiffBaseInput): DiffBase | null {
  if (p.viewed) {
    const n = p.viewed.draft - 1;
    const original = draftText(p.drafts, n);
    return original === null ? null : { original, against: `draft ${n}`, edits: false };
  }
  if (p.edited && p.baselineText.trim() !== "") {
    if (p.draftCount > 0) return { original: p.baselineText, against: `draft ${p.draftCount}`, edits: true };
    if (p.fromHistory) return { original: p.baselineText, against: "the saved SLA", edits: true };
    return null;
  }
  if (p.edited || p.draftCount < 2) return null;
  const n = p.draftCount - 1;
  const original = draftText(p.drafts, n);
  return original === null ? null : { original, against: `draft ${n}`, edits: false };
}
