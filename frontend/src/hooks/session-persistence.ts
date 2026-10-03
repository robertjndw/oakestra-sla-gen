import { useCallback, useEffect, useRef } from "react";
import {
  DEFAULT_SETTINGS,
  MAX_RETRIES,
  MIN_RETRIES,
  SESSION_SAVE_DEBOUNCE_MS,
  SESSION_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
} from "@/lib/constants";
import { isObject, readStored, removeStored, writeStored } from "@/lib/storage";
import type { Settings } from "@/lib/types";
import { initialState, reopenLostForm, type RestoredInput, type Round, type SessionState } from "./use-session";

// Bump when Round or the persisted fields change shape. Older snapshots are then dropped
// instead of being rendered with fields the UI no longer knows.
const SNAPSHOT_VERSION = 1;

type PersistedFields = Pick<
  SessionState,
  | "sessionId"
  | "rounds"
  | "settings"
  | "modelSla"
  | "previousModelSla"
  | "draftCount"
  | "editedSla"
  | "baselineText"
  | "pendingDraft"
  | "accepted"
  | "historySeed"
  | "nextId"
>;

export interface SessionSnapshot extends PersistedFields {
  version: typeof SNAPSHOT_VERSION;
}

const isObjectOrNull = (v: unknown) => v === null || isObject(v);

export function isSettings(v: unknown): v is Settings {
  return (
    isObject(v) &&
    Number.isInteger(v.maxRetries) &&
    (v.maxRetries as number) >= MIN_RETRIES &&
    (v.maxRetries as number) <= MAX_RETRIES &&
    typeof v.customerId === "string" &&
    typeof v.checkImages === "boolean"
  );
}

function isSnapshot(v: unknown): v is SessionSnapshot {
  return (
    isObject(v) &&
    v.version === SNAPSHOT_VERSION &&
    (v.sessionId === null || typeof v.sessionId === "string") &&
    Array.isArray(v.rounds) &&
    v.rounds.every((r) => isObject(r) && typeof r.id === "number" && typeof r.kind === "string") &&
    isSettings(v.settings) &&
    isObjectOrNull(v.modelSla) &&
    isObjectOrNull(v.previousModelSla) &&
    isObjectOrNull(v.pendingDraft) &&
    typeof v.draftCount === "number" &&
    typeof v.editedSla === "string" &&
    typeof v.baselineText === "string" &&
    typeof v.accepted === "boolean" &&
    (v.historySeed === null || typeof v.historySeed === "string") &&
    typeof v.nextId === "number"
  );
}

/** Null when there is nothing worth bringing back after a reload. */
export function toSnapshot(s: SessionState): SessionSnapshot | null {
  if (!s.sessionId && s.rounds.length === 0 && s.editedSla === "") return null;
  return {
    version: SNAPSHOT_VERSION,
    sessionId: s.sessionId,
    rounds: s.rounds,
    settings: s.settings,
    modelSla: s.modelSla,
    previousModelSla: s.previousModelSla,
    draftCount: s.draftCount,
    editedSla: s.editedSla,
    baselineText: s.baselineText,
    pendingDraft: s.pendingDraft,
    accepted: s.accepted,
    historySeed: s.historySeed,
    nextId: s.nextId,
  };
}

/**
 * Rebuilds the state a snapshot was taken from. The response to a request that was still running
 * at reload never arrives, so its pending round becomes a notice. A lost first message goes back
 * into the composer because the server never confirmed a session for it.
 */
export function fromSnapshot(snap: SessionSnapshot, storedSettings: Settings): SessionState {
  const { version: _version, ...fields } = snap;
  const pendingIdx = fields.rounds.findIndex((r) => r.kind === "pending");
  if (pendingIdx === -1) {
    return {
      ...initialState(),
      ...fields,
      settings: fields.sessionId ? fields.settings : storedSettings,
    };
  }

  const lost = fields.rounds[pendingIdx];
  const first = lost.kind === "pending" && lost.first;
  const userRound = fields.rounds[pendingIdx - 1];
  let restoredInput: RestoredInput | null = null;
  // A file upload's bubble text is a summary, not what was sent, so only plain messages come back.
  if (first && userRound?.kind === "user" && !userRound.fileName) {
    restoredInput = { text: userRound.text, file: null };
  }
  // The lost turn closed the open question list at turn-start, but its answers never reached the
  // server, so the list is reopened.
  const lostForm = reopenLostForm(fields.rounds);
  const rounds = lostForm.rounds;
  if (lostForm.text !== null) restoredInput = { text: lostForm.text, file: null };
  const notice: Round = {
    id: fields.nextId,
    kind: "notice",
    title: "The page reloaded before the reply arrived",
    detail: first
      ? "Send your message again."
      : "The server may still have finished it. If the draft doesn't reflect your last message, send it again.",
  };
  return {
    ...initialState(),
    ...fields,
    settings: fields.sessionId ? fields.settings : storedSettings,
    rounds: [...rounds.filter((r) => r.kind !== "pending"), notice],
    nextId: fields.nextId + 1,
    restoredInput,
  };
}

/** Initial state for the app: the last snapshot of this tab, or a fresh session with saved settings. */
export function restoreSession(): SessionState {
  const settings = readStored("local", SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS, isSettings);
  const snap = readStored<SessionSnapshot | null>("session", SESSION_STORAGE_KEY, null, isSnapshot);
  return snap ? fromSnapshot(snap, settings) : { ...initialState(), settings };
}

export function usePersistSession(state: SessionState): void {
  const { settings } = state;
  useEffect(() => {
    writeStored("local", SETTINGS_STORAGE_KEY, settings);
  }, [settings]);

  // Debounced because the snapshot carries every draft, too much to stringify per keystroke.
  const pending = useRef<SessionState | null>(null);
  const flush = useCallback(() => {
    const s = pending.current;
    pending.current = null;
    if (!s) return;
    const snap = toSnapshot(s);
    // A failed write (full quota) must not leave an older snapshot behind: a reload would bring
    // back a conversation that no longer matches the server's session.
    if (!snap || !writeStored("session", SESSION_STORAGE_KEY, snap)) {
      removeStored("session", SESSION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    pending.current = state;
    const timer = setTimeout(flush, SESSION_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state, flush]);

  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);
}
