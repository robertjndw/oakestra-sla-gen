import { useCallback, useReducer, useRef } from "react";
import { answerSession, deleteSession, startSession } from "@/lib/api";
import type { ApiResult, SessionResult } from "@/lib/api";
import type { QuestionAnswer } from "@/lib/answers";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { describeChanges, diffSlas, firstDraftLine } from "@/lib/sla";
import type { Attempt, Clarification, InputFile, Settings, Sla } from "@/lib/types";

/** What the user did with a question list when it was closed. */
export interface FrozenAnswers {
  answers: QuestionAnswer[];
  /** True when the draft was accepted, so every assumption stands. */
  keepAll: boolean;
}

export type Round =
  | { id: number; kind: "user"; text: string; fileName?: string }
  | { id: number; kind: "pending"; first: boolean; startedAt: number }
  | {
      id: number;
      kind: "draft";
      /** 1-based draft number */
      draft: number;
      sla: Sla;
      changes: string[];
      questions: Clarification[];
      attempts: Attempt[];
      frozen: FrozenAnswers | null;
    }
  | {
      id: number;
      kind: "ask";
      /** Draft number that is still current, or null when there is no draft yet. */
      unchangedDraft: number | null;
      questions: Clarification[];
      attempts: Attempt[];
      frozen: FrozenAnswers | null;
    }
  | {
      id: number;
      kind: "failed";
      errors: string[];
      attempts: Attempt[];
      lastCandidate: Sla | null;
      /** Draft number that is still current, or null when there is no draft yet. */
      unchangedDraft: number | null;
    }
  | {
      id: number;
      kind: "notice";
      title: string;
      detail?: string;
      help?: string;
      /** "new-session" renders a "Start a new session" button (expired session). */
      action?: "new-session";
    }
  | { id: number; kind: "accepted"; draft: number };

export type QuestionRound = Extract<Round, { kind: "draft" | "ask" }>;

export interface RestoredInput {
  text: string;
  file: InputFile | null;
}

export interface SessionState {
  sessionId: string | null;
  rounds: Round[];
  turnRunning: boolean;
  settings: Settings;
  /** Latest SLA the model produced. */
  modelSla: Sla | null;
  /** The one before it, for "what changed". */
  previousModelSla: Sla | null;
  draftCount: number;
  /** Code view text. The source of truth for the output pane. */
  editedSla: string;
  /** Editor text as the model last wrote it, to spot hand edits. */
  baselineText: string;
  /** A new model draft arrived while the editor had hand edits; the UI asks what to do. */
  pendingDraft: Sla | null;
  accepted: boolean;
  /** Matches the token of the one request whose response is still wanted. */
  requestToken: number;
  /** Message and file to put back in the composer after the first request failed. */
  restoredInput: RestoredInput | null;
  /** Bumped when the UI should switch to the Code view. */
  codeViewRequest: number;
  nextId: number;
}

export type ApiResponse = ApiResult<SessionResult["body"]>;

export type SessionAction =
  | {
      type: "turn-start";
      token: number;
      first: boolean;
      userText: string | null;
      fileName?: string;
      /** Closes the open question list; null leaves it alone. */
      freeze: FrozenAnswers | null;
      now: number;
    }
  | {
      type: "response";
      token: number;
      res: ApiResponse;
      first: boolean;
      message: string;
      file: InputFile | null;
    }
  | { type: "accept" }
  | { type: "keep-refining" }
  | { type: "new-session"; token: number }
  | { type: "load-candidate"; sla: Sla }
  | { type: "set-editor-text"; text: string }
  | { type: "reset-to-model" }
  | { type: "set-settings"; settings: Settings }
  | { type: "dismiss-pending-draft" };

const stringify = (sla: Sla) => JSON.stringify(sla, null, 2);

export function initialState(): SessionState {
  return {
    sessionId: null,
    rounds: [],
    turnRunning: false,
    settings: DEFAULT_SETTINGS,
    modelSla: null,
    previousModelSla: null,
    draftCount: 0,
    editedSla: "",
    baselineText: "",
    pendingDraft: null,
    accepted: false,
    requestToken: 0,
    restoredInput: null,
    codeViewRequest: 0,
    nextId: 1,
  };
}

export const isEdited = (s: SessionState) => s.editedSla !== s.baselineText;

/** The open question list of the newest round, if the user has not replied to it yet. */
export function selectActiveForm(s: SessionState): QuestionRound | null {
  for (let i = s.rounds.length - 1; i >= 0; i--) {
    const r = s.rounds[i];
    if (r.kind === "user" || r.kind === "pending") return null;
    if (r.kind === "draft" || r.kind === "ask") {
      return r.questions.length > 0 && !r.frozen ? r : null;
    }
  }
  return null;
}

function freezeActiveForm(rounds: Round[], frozen: FrozenAnswers | null): Round[] {
  if (!frozen) return rounds;
  const idx = rounds.findLastIndex((r) => r.kind === "draft" || r.kind === "ask");
  const r = rounds[idx];
  if (!r || (r.kind !== "draft" && r.kind !== "ask") || r.questions.length === 0 || r.frozen) {
    return rounds;
  }
  return rounds.map((x, i) => (i === idx ? { ...r, frozen } : x));
}

function notice(
  state: SessionState,
  title: string,
  detail?: string,
  help?: string,
  action?: "new-session",
): Round {
  return { id: state.nextId, kind: "notice", title, detail, help, action };
}

function detailText(detail: unknown): string | undefined {
  return typeof detail === "string" && detail ? detail : undefined;
}

// Turns a finished request into rounds. Kept out of the reducer switch because it has a
// branch for every response status.
function applyResponse(
  state: SessionState,
  action: Extract<SessionAction, { type: "response" }>,
): SessionState {
  const { res, first, message, file } = action;
  const body = res.body ?? {};
  const rounds = state.rounds.filter((r) => r.kind !== "pending");
  const base: SessionState = { ...state, rounds, turnRunning: false };
  const unchangedDraft = state.modelSla ? state.draftCount : null;

  if (res.status === 200 && typeof body.session_id === "string") {
    const sla = body.sla ?? null;
    const questions = body.questions ?? [];
    const attempts = body.attempts ?? [];
    if (!sla) {
      return {
        ...base,
        sessionId: body.session_id,
        nextId: state.nextId + 1,
        rounds: [
          ...rounds,
          { id: state.nextId, kind: "ask", unchangedDraft, questions, attempts, frozen: null },
        ],
      };
    }
    const draft = state.draftCount + 1;
    let changes = state.modelSla ? describeChanges(diffSlas(state.modelSla, sla)) : [firstDraftLine(sla)];
    if (!changes.length) changes = ["No changes to the SLA"];
    const text = stringify(sla);
    // Hand edits win until the user says otherwise; the baseline moves either way so
    // "Reset to model draft" goes to the newest draft.
    const keepEdits = base.editedSla.trim() !== "" && isEdited(base);
    return {
      ...base,
      sessionId: body.session_id,
      nextId: state.nextId + 1,
      rounds: [
        ...rounds,
        { id: state.nextId, kind: "draft", draft, sla, changes, questions, attempts, frozen: null },
      ],
      draftCount: draft,
      previousModelSla: state.modelSla,
      modelSla: sla,
      baselineText: text,
      editedSla: keepEdits ? base.editedSla : text,
      pendingDraft: keepEdits ? sla : null,
    };
  }

  if (res.status === 422 && Array.isArray(body.errors)) {
    return {
      ...base,
      sessionId: state.sessionId ?? body.session_id ?? null,
      nextId: state.nextId + 1,
      rounds: [
        ...rounds,
        {
          id: state.nextId,
          kind: "failed",
          errors: body.errors,
          attempts: body.attempts ?? [],
          lastCandidate: body.last_candidate ?? null,
          unchangedDraft,
        },
      ],
    };
  }

  // Nothing was saved for a failed first message, so hand both back for a retry.
  const restored: RestoredInput | null =
    first && !state.sessionId
      ? { text: message, file }
      : state.restoredInput;

  let round: Round;
  const detail = detailText(body.detail);
  switch (res.status) {
    case 422: {
      const list = Array.isArray(body.detail) ? body.detail : [];
      const msgs = list.map((d) => d.msg || JSON.stringify(d));
      round = notice(
        state,
        "The server rejected the request",
        msgs.join("; ") || "Check the settings and try again.",
      );
      break;
    }
    case 502:
      round = notice(
        state,
        "The model server returned an error",
        detail,
        "Check that LM Studio (or your OpenAI-compatible server) is running and reachable from the playground, then send again.",
      );
      break;
    case 404:
      round = notice(
        state,
        "This session has expired",
        "Sessions live in the server's memory, so they're dropped after an hour without use or when the server restarts.",
        undefined,
        "new-session",
      );
      break;
    case 409:
      round = notice(
        state,
        "Still working on the previous message",
        "Wait for it to finish, then send again.",
      );
      break;
    case 0:
      round = notice(
        state,
        "Can't reach the playground server",
        detail,
        "Check that the API is running (oakestra-sla-gen serve).",
      );
      break;
    default:
      round = notice(state, "Something went wrong", detail || `The server answered with status ${res.status}.`);
  }
  return { ...base, restoredInput: restored, nextId: state.nextId + 1, rounds: [...rounds, round] };
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "turn-start": {
      let id = state.nextId;
      let rounds = freezeActiveForm(state.rounds, action.freeze);
      if (action.userText) {
        rounds = [...rounds, { id: id++, kind: "user", text: action.userText, fileName: action.fileName }];
      }
      rounds = [...rounds, { id: id++, kind: "pending", first: action.first, startedAt: action.now }];
      return {
        ...state,
        rounds,
        nextId: id,
        turnRunning: true,
        requestToken: action.token,
        restoredInput: null,
      };
    }
    case "response":
      // A response that outlived its conversation (New session, newer send) is dropped.
      if (action.token !== state.requestToken) return state;
      return applyResponse(state, action);
    case "accept": {
      if (!state.modelSla || state.turnRunning) return state;
      const rounds = freezeActiveForm(state.rounds, { answers: [], keepAll: true });
      return {
        ...state,
        accepted: true,
        rounds: [...rounds, { id: state.nextId, kind: "accepted", draft: state.draftCount }],
        nextId: state.nextId + 1,
      };
    }
    case "keep-refining":
      return { ...state, accepted: false };
    case "new-session":
      // Settings outlive the conversation: people compare runs across sessions,
      // and the settings popover keeps its own copy of the retries field that would go stale.
      return { ...initialState(), settings: state.settings, requestToken: action.token };
    case "load-candidate":
      // The baseline stays on the last draft that passed, so "Reset to model draft" goes back to it.
      return {
        ...state,
        editedSla: stringify(action.sla),
        pendingDraft: null,
        codeViewRequest: state.codeViewRequest + 1,
      };
    case "set-editor-text":
      return { ...state, editedSla: action.text };
    case "reset-to-model":
      return { ...state, editedSla: state.baselineText, pendingDraft: null };
    case "set-settings":
      // Settings travel with the first message only.
      return state.sessionId ? state : { ...state, settings: action.settings };
    case "dismiss-pending-draft":
      return { ...state, pendingDraft: null };
  }
}

export interface SessionApi {
  state: SessionState;
  /** True once a session exists on the server, which also locks the settings. */
  settingsLocked: boolean;
  /** Anything a "New session" would throw away. */
  hasUnacceptedWork: boolean;
  /** First message or a free-text follow-up. Only the first message can carry a file. */
  send: (text: string, inputFile?: InputFile | null) => Promise<void>;
  /**
   * Reply to the open questions. `formattedText` comes from formatAnswers; `details` lets the
   * thread show what was picked. `extra` is the free text typed beside the answers and is
   * shown as the user's own bubble.
   */
  answer: (
    formattedText: string,
    details?: { answers: QuestionAnswer[]; extra: string },
  ) => Promise<void>;
  accept: () => void;
  keepRefining: () => void;
  newSession: () => void;
  /** "Fix the last attempt by hand". */
  loadCandidate: (sla: Sla) => void;
  setEditorText: (text: string) => void;
  resetToModel: () => void;
  setSettings: (settings: Settings) => void;
  dismissPendingDraft: () => void;
}

export function useSessionController(): SessionApi {
  const [state, dispatch] = useReducer(sessionReducer, undefined, initialState);
  const tokenRef = useRef(0);
  const { sessionId, turnRunning, settings } = state;

  const run = useCallback(
    async (
      message: string,
      opts: { userText: string | null; fileName?: string; file: InputFile | null; freeze: FrozenAnswers | null },
    ) => {
      if (turnRunning) return;
      const first = !sessionId;
      const token = ++tokenRef.current;
      dispatch({
        type: "turn-start",
        token,
        first,
        userText: opts.userText,
        fileName: opts.fileName,
        freeze: opts.freeze,
        now: Date.now(),
      });
      const res = first
        ? await startSession(settings, message, opts.file)
        : await answerSession(sessionId, message);
      dispatch({ type: "response", token, res, first, message, file: opts.file });
    },
    [turnRunning, sessionId, settings],
  );

  const send = useCallback(
    async (text: string, inputFile?: InputFile | null) => {
      const message = text.trim();
      const file = !sessionId && inputFile ? inputFile : null;
      if (!message && !file) return;
      const userText = file ? `Uploaded ${file.name}` + (message ? `\n\n${message}` : "") : message;
      await run(message, {
        userText,
        fileName: file?.name,
        file,
        // Free text sent beside an open question list closes it as "left to the model".
        freeze: { answers: [], keepAll: false },
      });
    },
    [run, sessionId],
  );

  const answer = useCallback(
    async (formattedText: string, details?: { answers: QuestionAnswer[]; extra: string }) => {
      if (!formattedText.trim()) return;
      const extra = details?.extra.trim() ?? "";
      await run(formattedText, {
        userText: extra || null,
        file: null,
        freeze: { answers: details?.answers ?? [], keepAll: false },
      });
    },
    [run],
  );

  const newSession = useCallback(() => {
    const token = ++tokenRef.current;
    if (sessionId) void deleteSession(sessionId);
    dispatch({ type: "new-session", token });
  }, [sessionId]);

  return {
    state,
    settingsLocked: !!sessionId,
    hasUnacceptedWork: state.rounds.length > 0 && !state.accepted,
    send,
    answer,
    accept: useCallback(() => dispatch({ type: "accept" }), []),
    keepRefining: useCallback(() => dispatch({ type: "keep-refining" }), []),
    newSession,
    loadCandidate: useCallback((sla: Sla) => dispatch({ type: "load-candidate", sla }), []),
    setEditorText: useCallback((text: string) => dispatch({ type: "set-editor-text", text }), []),
    resetToModel: useCallback(() => dispatch({ type: "reset-to-model" }), []),
    setSettings: useCallback((s: Settings) => dispatch({ type: "set-settings", settings: s }), []),
    dismissPendingDraft: useCallback(() => dispatch({ type: "dismiss-pending-draft" }), []),
  };
}
