import { describe, expect, it } from "vitest";
import { initialState, isEdited, sessionReducer, type SessionState } from "@/hooks/use-session";
import type { Sla } from "@/lib/types";
import { diffBase, type DiffBaseInput } from "./diff-base";
import { slaText } from "@/lib/sla";
import { draftRounds, resolveViewedDraft, selectDraft, type DraftRound } from "./draft-view";

const slaFor = (memory: number): Sla => ({
  applications: [{ application_name: "a", microservices: [{ microservice_name: "web", memory }] }],
});

function draftRound(id: number, draft: number): DraftRound {
  return { id, kind: "draft", draft, sla: slaFor(draft * 100), changes: [], questions: [], attempts: [], frozen: null };
}

// Built by hand rather than through turn-start/response, so these tests only depend on the
// fields draft viewing reads.
function withDrafts(n: number, sessionId = "s1"): SessionState {
  const rounds = Array.from({ length: n }, (_, i) => draftRound(i + 1, i + 1));
  const latest = rounds[n - 1];
  const text = slaText(latest.sla);
  return {
    ...initialState(),
    sessionId,
    rounds,
    draftCount: n,
    modelSla: latest.sla,
    previousModelSla: rounds[n - 2]?.sla ?? null,
    editedSla: text,
    baselineText: text,
    nextId: n + 1,
  };
}

function addDraft(s: SessionState): SessionState {
  const r = draftRound(s.nextId, s.draftCount + 1);
  const text = slaText(r.sla);
  return {
    ...s,
    rounds: [...s.rounds, r],
    draftCount: r.draft,
    modelSla: r.sla,
    baselineText: text,
    editedSla: text,
    nextId: s.nextId + 1,
  };
}

describe("draft selection", () => {
  it("shows the picked older draft", () => {
    const s = withDrafts(3);
    expect(resolveViewedDraft(selectDraft(1, s), s)?.draft).toBe(1);
  });

  it("treats the latest draft and null as the working copy", () => {
    const s = withDrafts(3);
    expect(selectDraft(3, s)).toBeNull();
    expect(selectDraft(null, s)).toBeNull();
  });

  it("survives unrelated changes such as typing or sending a message", () => {
    const s = withDrafts(3);
    const sel = selectDraft(2, s);
    const typed = sessionReducer(s, { type: "set-editor-text", text: "{}" });
    expect(resolveViewedDraft(sel, typed)?.draft).toBe(2);
    const sent = { ...s, turnRunning: true, rounds: [...s.rounds, { id: 9, kind: "user" as const, text: "more memory" }] };
    expect(resolveViewedDraft(sel, sent)?.draft).toBe(2);
  });

  it("goes back to the latest when a new draft arrives", () => {
    const s = withDrafts(3);
    const sel = selectDraft(1, s);
    expect(resolveViewedDraft(sel, addDraft(s))).toBeNull();
  });

  it("goes back to the latest on accept, and stays there after keep refining", () => {
    const s = withDrafts(3);
    const sel = selectDraft(1, s);
    const accepted = sessionReducer(s, { type: "accept" });
    expect(resolveViewedDraft(sel, accepted)).toBeNull();
    expect(resolveViewedDraft(sel, sessionReducer(accepted, { type: "keep-refining" }))).toBeNull();
  });

  it("goes back on a new session or a history open", () => {
    const s = withDrafts(3);
    const sel = selectDraft(1, s);
    expect(resolveViewedDraft(sel, sessionReducer(s, { type: "new-session", token: 5 }))).toBeNull();
    const opened = sessionReducer(s, { type: "open-history", token: 5, title: "x", sla: "{}" });
    expect(resolveViewedDraft(sel, opened)).toBeNull();
  });

  it("doesn't come back in a later session that reaches the same draft count", () => {
    const sel = selectDraft(1, withDrafts(3, "old"));
    expect(resolveViewedDraft(sel, withDrafts(3, "new"))).toBeNull();
  });
});

describe("restoring a draft", () => {
  it("puts its text in the editor as a hand edit, and the latest draft stays the baseline", () => {
    const s = withDrafts(3);
    const first = draftRounds(s.rounds)[0];
    const restored = sessionReducer(s, { type: "set-editor-text", text: slaText(first.sla) });
    expect(isEdited(restored)).toBe(true);
    expect(restored.baselineText).toBe(s.baselineText);
    expect(restored.codeViewRequest).toBe(s.codeViewRequest);
  });
});

describe("diffBase", () => {
  const input = (s: SessionState, over: Partial<DiffBaseInput> = {}): DiffBaseInput => ({
    viewed: null,
    drafts: draftRounds(s.rounds),
    draftCount: s.draftCount,
    edited: isEdited(s),
    baselineText: s.baselineText,
    fromHistory: s.draftCount === 0 && s.historySeed !== null,
    ...over,
  });

  it("has nothing to compare for an untouched first draft", () => {
    expect(diffBase(input(withDrafts(1)))).toBeNull();
  });

  it("compares the latest draft with the one before it", () => {
    const s = withDrafts(3);
    expect(diffBase(input(s))).toEqual({ original: slaText(slaFor(200)), against: "draft 2", edits: false });
  });

  it("compares hand edits with the latest model draft, even on the first draft", () => {
    const s = sessionReducer(withDrafts(1), { type: "set-editor-text", text: "{ broken" });
    expect(diffBase(input(s))).toEqual({ original: s.baselineText, against: "draft 1", edits: true });
  });

  it("compares a viewed draft with its predecessor, and the first one with nothing", () => {
    const s = withDrafts(3);
    const [d1, d2] = draftRounds(s.rounds);
    expect(diffBase(input(s, { viewed: d2 }))).toEqual({ original: slaText(d1.sla), against: "draft 1", edits: false });
    expect(diffBase(input(s, { viewed: d1 }))).toBeNull();
  });

  it("ignores hand edits while an older draft is viewed", () => {
    const s = sessionReducer(withDrafts(3), { type: "set-editor-text", text: "{}" });
    const d2 = draftRounds(s.rounds)[1];
    expect(diffBase(input(s, { viewed: d2 }))?.against).toBe("draft 1");
  });

  it("compares edits to a reopened history SLA with the saved one", () => {
    const opened = sessionReducer(initialState(), { type: "open-history", token: 1, title: "x", sla: '{"a": 1}' });
    expect(diffBase(input(opened))).toBeNull();
    const edited = sessionReducer(opened, { type: "set-editor-text", text: '{"a": 2}' });
    expect(diffBase(input(edited))).toEqual({ original: '{"a": 1}', against: "the saved SLA", edits: true });
  });

  it("has nothing to compare for an SLA typed from scratch", () => {
    const s = sessionReducer(initialState(), { type: "set-editor-text", text: "{}" });
    expect(diffBase(input(s))).toBeNull();
  });
});
