import { describe, expect, it } from "vitest";
import {
  initialState,
  isEdited,
  selectActiveForm,
  sessionReducer,
  type ApiResponse,
  type SessionAction,
  type SessionState,
} from "./use-session";
import type { Sla } from "@/lib/types";

const slaV1: Sla = { applications: [{ application_name: "a", microservices: [{ microservice_name: "web", memory: 512 }] }] };
const slaV2: Sla = { applications: [{ application_name: "a", microservices: [{ microservice_name: "web", memory: 1024 }] }] };

const run = (state: SessionState, ...actions: SessionAction[]) => actions.reduce(sessionReducer, state);

const start = (
  token: number,
  first = true,
  freeze: Extract<SessionAction, { type: "turn-start" }>["freeze"] = null,
): SessionAction => ({
  type: "turn-start",
  token,
  first,
  userText: "hi",
  freeze,
  now: 0,
});

const respond = (token: number, res: ApiResponse, first = true, message = "hi"): SessionAction => ({
  type: "response",
  token,
  res,
  first,
  message,
  compose: null,
});

const ok = (sla: Sla | null, questions = [] as { topic: string; question: string; assumption: string | null }[]): ApiResponse => ({
  status: 200,
  body: { session_id: "s1", sla, questions, attempts: [{ attempt: 1, errors: [] }] },
});

const kinds = (s: SessionState) => s.rounds.map((r) => r.kind);

describe("turn lifecycle", () => {
  it("shows a user bubble and a pending round while running", () => {
    const s = run(initialState(), start(1));
    expect(s.turnRunning).toBe(true);
    expect(kinds(s)).toEqual(["user", "pending"]);
  });

  it("turns a 200 with an SLA into a draft and adopts the session", () => {
    const s = run(initialState(), start(1), respond(1, ok(slaV1)));
    expect(s.turnRunning).toBe(false);
    expect(s.sessionId).toBe("s1");
    expect(kinds(s)).toEqual(["user", "draft"]);
    expect(s.draftCount).toBe(1);
    expect(s.modelSla).toBe(slaV1);
    expect(s.editedSla).toBe(JSON.stringify(slaV1, null, 2));
    const draft = s.rounds[1];
    expect(draft.kind === "draft" && draft.changes).toEqual(["1 service: web"]);
  });

  it("describes changes against the previous draft", () => {
    const s = run(
      initialState(),
      start(1),
      respond(1, ok(slaV1)),
      start(2, false),
      respond(2, ok(slaV2), false),
    );
    expect(s.previousModelSla).toBe(slaV1);
    const draft = s.rounds.at(-1);
    expect(draft?.kind === "draft" && draft.changes).toEqual(["web: memory 512 MB to 1 GB"]);
  });

  it("says so when nothing changed", () => {
    const s = run(initialState(), start(1), respond(1, ok(slaV1)), start(2, false), respond(2, ok(slaV1), false));
    const draft = s.rounds.at(-1);
    expect(draft?.kind === "draft" && draft.changes).toEqual(["No changes to the SLA"]);
  });

  it("makes an ask round when there is no SLA yet", () => {
    const q = [{ topic: "t", question: "?", assumption: null }];
    const s = run(initialState(), start(1), respond(1, ok(null, q)));
    expect(s.rounds.at(-1)?.kind).toBe("ask");
    expect(s.modelSla).toBeNull();
    expect(selectActiveForm(s)?.questions).toEqual(q);
  });

  it("freezes the open question list when the next turn starts", () => {
    const q = [{ topic: "t", question: "?", assumption: "x" }];
    let s = run(initialState(), start(1), respond(1, ok(slaV1, q)));
    expect(selectActiveForm(s)).not.toBeNull();
    s = run(s, start(2, false, { answers: [], keepAll: false }));
    expect(selectActiveForm(s)).toBeNull();
  });
});

describe("request token", () => {
  it("drops a response that arrives after New session", () => {
    const s = run(initialState(), start(1), { type: "new-session", token: 2 }, respond(1, ok(slaV1)));
    expect(s.rounds).toEqual([]);
    expect(s.sessionId).toBeNull();
    expect(s.turnRunning).toBe(false);
  });

  it("drops a response from a superseded request", () => {
    const s = run(initialState(), start(1), start(2), respond(1, ok(slaV1)));
    expect(s.turnRunning).toBe(true);
    expect(s.modelSla).toBeNull();
  });
});

describe("status branches", () => {
  const fail = (status: number, body: ApiResponse["body"] = {}, first = true) =>
    respond(1, { status, body }, first);
  const last = (s: SessionState) => s.rounds.at(-1)!;

  it("422 with errors becomes a failed round and keeps the candidate", () => {
    const s = run(
      initialState(),
      start(1),
      fail(422, { detail: "x", errors: ["e1"], last_candidate: slaV1, attempts: [], session_id: "s9" }),
    );
    const r = last(s);
    expect(r.kind).toBe("failed");
    expect(r.kind === "failed" && r.lastCandidate).toBe(slaV1);
    expect(s.sessionId).toBe("s9");
    expect(s.restoredInput).toBeNull();
  });

  it("other 422 lists the server's messages and restores the first message", () => {
    const s = run(initialState(), start(1), fail(422, { detail: [{ msg: "bad value" }] }));
    const r = last(s);
    expect(r.kind === "notice" && r.detail).toBe("bad value");
    expect(s.restoredInput?.text).toBe("hi");
    expect(s.sessionId).toBeNull();
  });

  it("404 offers a new session", () => {
    const s = run(initialState(), start(1, false), fail(404, { detail: "gone" }, false));
    const r = last(s);
    expect(r.kind === "notice" && r.action).toBe("new-session");
    expect(s.restoredInput).toBeNull();
  });

  it.each([
    [409, "Still working on the previous message"],
    [502, "The model server returned an error"],
    [0, "Can't reach the playground server"],
    [500, "Something went wrong"],
  ])("status %i", (status, title) => {
    const s = run(initialState(), start(1), fail(status, { detail: "d" }));
    const r = last(s);
    expect(r.kind === "notice" && r.title).toBe(title);
    expect(s.turnRunning).toBe(false);
    expect(kinds(s)).not.toContain("pending");
  });
});

describe("editor", () => {
  const withDraft = () => run(initialState(), start(1), respond(1, ok(slaV1)));

  it("replaces untouched editor text with a new draft", () => {
    const s = run(withDraft(), start(2, false), respond(2, ok(slaV2), false));
    expect(s.editedSla).toBe(JSON.stringify(slaV2, null, 2));
    expect(s.pendingDraft).toBeNull();
  });

  it("keeps hand edits and asks before replacing them", () => {
    let s = run(withDraft(), { type: "set-editor-text", text: "{\"mine\": true}" });
    expect(isEdited(s)).toBe(true);
    s = run(s, start(2, false), respond(2, ok(slaV2), false));
    expect(s.editedSla).toBe("{\"mine\": true}");
    expect(s.pendingDraft).toBe(slaV2);
    expect(s.baselineText).toBe(JSON.stringify(slaV2, null, 2));
    expect(run(s, { type: "reset-to-model" }).editedSla).toBe(JSON.stringify(slaV2, null, 2));
    expect(run(s, { type: "dismiss-pending-draft" }).pendingDraft).toBeNull();
  });

  it("resets to the model draft", () => {
    const s = run(withDraft(), { type: "set-editor-text", text: "x" }, { type: "reset-to-model" });
    expect(isEdited(s)).toBe(false);
  });

  it("loads a failed candidate without moving the baseline", () => {
    const s = run(withDraft(), { type: "load-candidate", sla: slaV2 });
    expect(s.editedSla).toBe(JSON.stringify(slaV2, null, 2));
    expect(s.baselineText).toBe(JSON.stringify(slaV1, null, 2));
    expect(s.codeViewRequest).toBe(1);
  });
});

describe("accept, settings, new session", () => {
  const withDraft = () => run(initialState(), start(1), respond(1, ok(slaV1)));

  it("accepts only when there is a draft", () => {
    expect(run(initialState(), { type: "accept" }).accepted).toBe(false);
    const s = run(withDraft(), { type: "accept" });
    expect(s.accepted).toBe(true);
    expect(s.rounds.at(-1)).toMatchObject({ kind: "accepted", draft: 1 });
    expect(run(s, { type: "keep-refining" }).accepted).toBe(false);
  });

  it("locks settings once a session exists", () => {
    const changed = { ...initialState().settings, maxRetries: 5 };
    expect(run(initialState(), { type: "set-settings", settings: changed }).settings.maxRetries).toBe(5);
    expect(run(withDraft(), { type: "set-settings", settings: changed }).settings.maxRetries).toBe(3);
  });

  it("new session resets everything but the settings are open again", () => {
    const s = run(withDraft(), { type: "new-session", token: 5 });
    expect(s).toEqual({ ...initialState(), requestToken: 5 });
  });

  it("new session keeps the chosen settings", () => {
    const changed = { ...initialState().settings, maxRetries: 5 };
    const s = run(
      initialState(),
      { type: "set-settings", settings: changed },
      start(1),
      respond(1, ok(slaV1)),
      { type: "new-session", token: 5 },
    );
    expect(s.settings.maxRetries).toBe(5);
    expect(run(s, { type: "set-settings", settings: initialState().settings }).settings.maxRetries).toBe(3);
  });
});
