import { HISTORY_STORAGE_KEY, MAX_HISTORY_ENTRIES } from "./constants";
import { isObject, parseStored, readRaw, removeStored, writeStored } from "./storage";

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

const isEntry = (v: unknown): v is HistoryEntry =>
  isObject(v) &&
  typeof v.id === "string" &&
  typeof v.title === "string" &&
  typeof v.savedAt === "number" &&
  typeof v.sla === "string" &&
  typeof v.accepted === "boolean";

const isStoredHistory = (v: unknown): v is StoredHistory =>
  isObject(v) && v.version === HISTORY_VERSION && Array.isArray(v.entries) && v.entries.every(isEntry);

const EMPTY: StoredHistory = { version: HISTORY_VERSION, entries: [] };

/** Newest first. Never throws. */
export function parseHistory(raw: string | null): HistoryEntry[] {
  return parseStored(raw, EMPTY, isStoredHistory).entries;
}

export const readRawHistory = (key: string = HISTORY_STORAGE_KEY) => readRaw("local", key);

export const readHistory = (key: string = HISTORY_STORAGE_KEY) => parseHistory(readRawHistory(key));

/**
 * Saves the list, dropping the oldest entries until it fits the storage quota. Leaves storage
 * alone when not even the newest entry fits, so one oversized SLA can't wipe the history.
 */
export function writeHistory(entries: HistoryEntry[], key: string = HISTORY_STORAGE_KEY): boolean {
  if (entries.length === 0) {
    removeStored("local", key);
    return true;
  }
  for (let n = Math.min(entries.length, MAX_HISTORY_ENTRIES); n > 0; n--) {
    if (writeStored("local", key, { version: HISTORY_VERSION, entries: entries.slice(0, n) })) {
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
