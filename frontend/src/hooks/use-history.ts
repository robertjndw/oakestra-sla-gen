import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { HISTORY_SAVE_DEBOUNCE_MS, HISTORY_STORAGE_KEY } from "@/lib/constants";
import { readHistory, titleFrom, upsertEntry, writeHistory, type HistoryEntry } from "@/lib/history";
import type { SessionState } from "./use-session";

// localStorage is the store itself, so other tabs' writes show up too. Reading it means pulling
// a string of up to a few MB, too much to do on every render of the top bar. So while anyone is
// subscribed, the parsed list is served from memory and only refreshed by our own commits, other
// tabs' storage events, and the first subscribe (which catches writes made while nobody listened).
let lastRaw: string | null | undefined;
let lastEntries: HistoryEntry[] = [];
const listeners = new Set<() => void>();

function rawHistory(): string | null {
  try {
    return localStorage.getItem(HISTORY_STORAGE_KEY);
  } catch {
    return null;
  }
}

// Memoized on the raw string because useSyncExternalStore needs a stable snapshot.
function refresh(): HistoryEntry[] {
  const raw = rawHistory();
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastEntries = readHistory();
  }
  return lastEntries;
}

// Unsubscribed, nothing would tell the cache it went stale, so storage is checked each time.
const getSnapshot = (): HistoryEntry[] => (listeners.size > 0 ? lastEntries : refresh());

function subscribe(onChange: () => void): () => void {
  // React re-reads the snapshot after subscribing, so a change found here still renders.
  if (listeners.size === 0) refresh();
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== HISTORY_STORAGE_KEY && e.key !== null) return;
    refresh();
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function commit(next: HistoryEntry[]) {
  if (next === getSnapshot()) return;
  writeHistory(next);
  // Read back rather than caching `next`: the write may have dropped entries to fit the quota,
  // or failed outright.
  refresh();
  listeners.forEach((l) => l());
}

export const saveToHistory = (entry: HistoryEntry) => commit(upsertEntry(getSnapshot(), entry));
export const removeFromHistory = (id: string) => commit(getSnapshot().filter((e) => e.id !== id));
export const clearHistory = () => commit([]);

/** Newest first. */
export function useHistoryEntries(): HistoryEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function sessionTitle(s: SessionState): string {
  if (s.historySeed) return s.historySeed;
  const first = s.rounds.find((r) => r.kind === "user");
  if (first?.kind === "user") {
    if (!first.fileName) return titleFrom(first.text);
    // An upload's bubble is "Uploaded <file>" plus the note typed beside it.
    const note = first.text.split("\n\n").slice(1).join("\n\n");
    if (note.trim()) return titleFrom(note);
  }
  const names = (s.modelSla?.applications ?? []).flatMap((a) => a.application_name || []);
  if (names.length) return titleFrom(names.join(", "));
  return first?.kind === "user" && first.fileName ? first.fileName : "Untitled SLA";
}

type DraftEntry = Omit<HistoryEntry, "savedAt">;

/** What the history should hold for this session, or null when there is nothing to keep yet. */
export function draftEntry(s: SessionState): DraftEntry | null {
  if (!s.sessionId || !s.modelSla) return null;
  try {
    JSON.parse(s.editedSla);
  } catch {
    // Mid-edit text that doesn't parse would reopen as a broken SLA, so keep the last version
    // that did.
    return null;
  }
  return { id: s.sessionId, title: sessionTitle(s), sla: s.editedSla, accepted: s.accepted };
}

/** Keeps the history entry of the current session up to date with its latest draft. */
export function useRecordHistory(state: SessionState): void {
  const entry = draftEntry(state);
  const id = entry?.id ?? null;
  const title = entry?.title ?? "";
  const sla = entry?.sla ?? "";
  const accepted = entry?.accepted ?? false;

  const pending = useRef<DraftEntry | null>(null);
  const flush = useCallback(() => {
    const e = pending.current;
    pending.current = null;
    if (e) saveToHistory({ ...e, savedAt: Date.now() });
  }, []);

  useEffect(() => {
    // Leaving a session (or breaking the JSON) cancels the timer below, so whatever was
    // waiting for it is written now rather than lost.
    if (pending.current && pending.current.id !== id) flush();
    if (id === null) return;
    pending.current = { id, title, sla, accepted };
    const timer = setTimeout(flush, HISTORY_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [id, title, sla, accepted, flush]);

  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);
}
