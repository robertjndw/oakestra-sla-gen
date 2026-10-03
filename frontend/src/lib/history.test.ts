import { afterEach, describe, expect, it, vi } from "vitest";
import { HISTORY_STORAGE_KEY, MAX_HISTORY_ENTRIES } from "./constants";
import { readHistory, titleFrom, upsertEntry, writeHistory, type HistoryEntry } from "./history";

const entry = (id: string, sla = "{}"): HistoryEntry => ({ id, title: id, savedAt: 1, sla, accepted: false });

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("upsertEntry", () => {
  it("puts a new entry first", () => {
    expect(upsertEntry([entry("a")], entry("b")).map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("moves an updated entry to the top instead of duplicating it", () => {
    const list = [entry("a"), entry("b")];
    expect(upsertEntry(list, entry("b", '{"x":1}')).map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("returns the same list when nothing but the time changed", () => {
    const list = [entry("a"), entry("b")];
    expect(upsertEntry(list, { ...entry("b"), savedAt: 99 })).toBe(list);
  });

  it("keeps at most the newest entries", () => {
    let list: HistoryEntry[] = [];
    for (let i = 0; i <= MAX_HISTORY_ENTRIES; i++) list = upsertEntry(list, entry(String(i)));
    expect(list).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(list[0].id).toBe(String(MAX_HISTORY_ENTRIES));
    expect(list.some((e) => e.id === "0")).toBe(false);
  });
});

describe("readHistory / writeHistory", () => {
  it("round-trips", () => {
    writeHistory([entry("a"), entry("b")]);
    expect(readHistory().map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("drops a list of another version or shape", () => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify({ version: 0, entries: [entry("a")] }));
    expect(readHistory()).toEqual([]);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify({ version: 1, entries: [{ id: "a" }] }));
    expect(readHistory()).toEqual([]);
  });

  it("drops the oldest entries until the list fits the quota", () => {
    const list = [entry("new"), entry("mid"), entry("old")];
    const quota = JSON.stringify({ version: 1, entries: list.slice(0, 2) }).length;
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (value.length > quota) throw new DOMException("full", "QuotaExceededError");
      setItem.call(this, key, value);
    });
    expect(writeHistory(list)).toBe(true);
    expect(readHistory().map((e) => e.id)).toEqual(["new", "mid"]);
  });

  it("leaves the stored list alone when not even the newest entry fits", () => {
    writeHistory([entry("a")]);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(writeHistory([entry("b"), entry("a")])).toBe(false);
    expect(readHistory().map((e) => e.id)).toEqual(["a"]);
  });
});

describe("titleFrom", () => {
  it("takes the first line and shortens long text", () => {
    expect(titleFrom("  nginx on port 80\nwith tls ")).toBe("nginx on port 80");
    const long = titleFrom("a".repeat(200));
    expect(long).toHaveLength(80);
    expect(long.endsWith("…")).toBe(true);
  });
});
