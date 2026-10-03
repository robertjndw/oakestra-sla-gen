import { afterEach, describe, expect, it } from "vitest";
import { SESSION_STORAGE_KEY, SETTINGS_STORAGE_KEY } from "@/lib/constants";
import type { Sla } from "@/lib/types";
import { fromSnapshot, isSettings, restoreSession, toSnapshot } from "./session-persistence";
import {
  initialState,
  selectActiveForm,
  sessionReducer,
  type FrozenAnswers,
  type SessionAction,
  type SessionState,
} from "./use-session";

const sla: Sla = { applications: [{ application_name: "a", microservices: [{ microservice_name: "web" }] }] };
const run = (state: SessionState, ...actions: SessionAction[]) => actions.reduce(sessionReducer, state);

const start = (
  token: number,
  first: boolean,
  userText: string | null = "hi",
  freeze: FrozenAnswers | null = null,
): SessionAction => ({
  type: "turn-start",
  token,
  first,
  userText,
  freeze,
  now: 0,
});

const question = { topic: "port", question: "Which port?", assumption: "80" };

const withDraft = (questions = [] as (typeof question)[]) =>
  run(initialState(), start(1, true), {
    type: "response",
    token: 1,
    res: { status: 200, body: { session_id: "s1", sla, questions, attempts: [] } },
    first: true,
    message: "hi",
    file: null,
  });

// What answer() dispatches: the open list closes with the picked answers.
const answered: FrozenAnswers = { answers: [], keepAll: false };

const custom = { maxRetries: 7, customerId: "acme", checkImages: false };

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("toSnapshot / fromSnapshot", () => {
  it("has nothing to save for an untouched session", () => {
    expect(toSnapshot(initialState())).toBeNull();
  });

  it("round-trips a finished turn", () => {
    const s = run(withDraft(), { type: "set-editor-text", text: "edited" });
    const restored = fromSnapshot(toSnapshot(s)!, initialState().settings);
    expect(restored.sessionId).toBe("s1");
    expect(restored.rounds).toEqual(s.rounds);
    expect(restored.editedSla).toBe("edited");
    expect(restored.baselineText).toBe(s.baselineText);
    expect(restored.turnRunning).toBe(false);
  });

  it("keeps the session's own settings over the stored ones", () => {
    const s = withDraft();
    expect(fromSnapshot(toSnapshot(s)!, custom).settings).toEqual(s.settings);
  });

  it("turns a follow-up that was still running into a notice", () => {
    const s = run(withDraft(), start(2, false, "more memory"));
    const restored = fromSnapshot(toSnapshot(s)!, initialState().settings);
    expect(restored.rounds.map((r) => r.kind)).toEqual(["user", "draft", "user", "notice"]);
    expect(restored.restoredInput).toBeNull();
    expect(new Set(restored.rounds.map((r) => r.id)).size).toBe(restored.rounds.length);
    expect(restored.nextId).toBeGreaterThan(Math.max(...restored.rounds.map((r) => r.id)));
  });

  it("reopens the question list a lost reply closed", () => {
    const s = run(withDraft([question]), start(2, false, null, answered));
    expect(selectActiveForm(s)).toBeNull();
    const restored = fromSnapshot(toSnapshot(s)!, initialState().settings);
    expect(selectActiveForm(restored)?.questions).toEqual([question]);
    expect(restored.restoredInput).toBeNull();
  });

  it("moves text sent beside the answers back into the composer", () => {
    const s = run(withDraft([question]), start(2, false, "also add redis", answered));
    const restored = fromSnapshot(toSnapshot(s)!, initialState().settings);
    expect(selectActiveForm(restored)?.questions).toEqual([question]);
    expect(restored.rounds.map((r) => r.kind)).toEqual(["user", "draft", "notice"]);
    expect(restored.restoredInput).toEqual({ text: "also add redis", file: null });
  });

  it("keeps a list closed by an earlier turn closed", () => {
    const s = run(
      withDraft([question]),
      start(2, false, "never mind", answered),
      {
        type: "response",
        token: 2,
        res: { status: 200, body: { session_id: "s1", sla, questions: [], attempts: [] } },
        first: false,
        message: "never mind",
        file: null,
      },
      start(3, false),
    );
    const restored = fromSnapshot(toSnapshot(s)!, initialState().settings);
    expect(selectActiveForm(restored)).toBeNull();
  });

  it("puts a lost first message back into the composer", () => {
    const s = run(initialState(), start(1, true, "a redis cache"));
    const restored = fromSnapshot(toSnapshot(s)!, custom);
    expect(restored.sessionId).toBeNull();
    expect(restored.settings).toEqual(custom);
    expect(restored.restoredInput).toEqual({ text: "a redis cache", file: null });
  });
});

describe("history seed", () => {
  it("survives a reload", () => {
    const s = run(initialState(), { type: "open-history", token: 1, title: "shop", sla: "{}" });
    const restored = fromSnapshot(toSnapshot(s)!, initialState().settings);
    expect(restored.historySeed).toBe("shop");
    expect(restored.editedSla).toBe("{}");
  });
});

describe("restoreSession", () => {
  it("starts fresh with the saved settings", () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(custom));
    expect(restoreSession()).toEqual({ ...initialState(), settings: custom });
  });

  it("ignores invalid settings and snapshots", () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...custom, maxRetries: 99 }));
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ ...toSnapshot(withDraft()), version: 0 }));
    expect(restoreSession()).toEqual(initialState());
  });

  it("brings back the tab's session", () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(toSnapshot(withDraft())));
    expect(restoreSession().sessionId).toBe("s1");
  });
});

describe("isSettings", () => {
  it("rejects partial objects", () => {
    expect(isSettings(custom)).toBe(true);
    expect(isSettings({ maxRetries: 3 })).toBe(false);
    expect(isSettings({ ...custom, maxRetries: 2.5 })).toBe(false);
  });
});
