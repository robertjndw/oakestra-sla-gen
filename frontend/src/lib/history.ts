import { HISTORY_STORAGE_KEY, MAX_HISTORY_ENTRIES } from "./constants";
import { readStored, removeStored, writeStored } from "./storage";

/** One past session's SLA. Only the SLA is kept: the conversation can't be resumed anyway,
 * because the server forgets sessions after an hour. */
export interface HistoryEntry {
  /** The server session the SLA came from, so later drafts of it replace the entry. */
  id: string;
  title: string;
  savedAt: number;
  /** Editor text including hand edits. Always parses as JSON. */
  sla: string;
  accepted: boolean;
}

// Bump when HistoryEntry changes shape; older lists are then dropped rather than misread.
const HISTORY_VERSION = 1;

interface StoredHistory {
  version: typeof HISTORY_VERSION;
  entries: HistoryEntry[];
}

const isEntry = (v: unknown): v is HistoryEntry => {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.title === "string" &&
    typeof e.savedAt === "number" &&
    typeof e.sla === "string" &&
    typeof e.accepted === "boolean"
  );
};

const isStoredHistory = (v: unknown): v is StoredHistory =>
  typeof v === "object" &&
  v !== null &&
  (v as StoredHistory).version === HISTORY_VERSION &&
  Array.isArray((v as StoredHistory).entries) &&
  (v as StoredHistory).entries.every(isEntry);

const EMPTY: StoredHistory = { version: HISTORY_VERSION, entries: [] };

/** Newest first. Never throws. */
export function readHistory(): HistoryEntry[] {
  return readStored("local", HISTORY_STORAGE_KEY, EMPTY, isStoredHistory).entries;
}

/**
 * Saves the list, dropping the oldest entries until it fits the storage quota. Leaves storage
 * alone when not even the newest entry fits, so one oversized SLA can't wipe the history.
 */
export function writeHistory(entries: HistoryEntry[]): boolean {
  if (entries.length === 0) {
    removeStored("local", HISTORY_STORAGE_KEY);
    return true;
  }
  for (let n = Math.min(entries.length, MAX_HISTORY_ENTRIES); n > 0; n--) {
    if (writeStored("local", HISTORY_STORAGE_KEY, { version: HISTORY_VERSION, entries: entries.slice(0, n) })) {
      return true;
    }
  }
  return false;
}

const sameContent = (a: HistoryEntry, b: HistoryEntry) =>
  a.sla === b.sla && a.accepted === b.accepted && a.title === b.title;

/**
 * Puts `entry` first, replacing an older entry with the same id. Returns the same array when
 * nothing changed, so a reload doesn't bump an untouched session to the top.
 */
export function upsertEntry(entries: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const existing = entries.find((e) => e.id === entry.id);
  if (existing && sameContent(existing, entry)) return entries;
  return [entry, ...entries.filter((e) => e.id !== entry.id)].slice(0, MAX_HISTORY_ENTRIES);
}

const TITLE_MAX = 80;

/** First line of what the user first wrote, shortened for a one-line list. */
export function titleFrom(text: string): string {
  const line = text.trim().split("\n", 1)[0].trim();
  return line.length > TITLE_MAX ? line.slice(0, TITLE_MAX - 1).trimEnd() + "…" : line;
}
