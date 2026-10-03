import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HISTORY_SAVE_DEBOUNCE_MS, HISTORY_STORAGE_KEY } from "@/lib/constants";
import { readHistory, writeHistory, type HistoryEntry } from "@/lib/history";
import type { Sla } from "@/lib/types";
import { draftEntry, saveToHistory, sessionTitle, useHistoryEntries, useRecordHistory } from "./use-history";
import { initialState, sessionReducer, type SessionAction, type SessionState } from "./use-session";

const sla: Sla = { applications: [{ application_name: "shop", microservices: [{ microservice_name: "web" }] }] };
const run = (state: SessionState, ...actions: SessionAction[]) => actions.reduce(sessionReducer, state);

const firstDraft = (userText = "a web shop", fileName?: string) =>
  run(
    initialState(),
    { type: "turn-start", token: 1, first: true, userText, fileName, freeze: null, now: 0 },
    {
      type: "response",
      token: 1,
      res: { status: 200, body: { session_id: "s1", sla, questions: [], attempts: [] } },
      first: true,
      message: userText,
      file: null,
    },
  );

describe("sessionTitle", () => {
  it("uses the first message", () => {
    expect(sessionTitle(firstDraft("a web shop\nwith a db"))).toBe("a web shop");
  });

  it("uses the note beside an upload, or else the application names", () => {
    expect(sessionTitle(firstDraft("Uploaded c.yml\n\nadd redis", "c.yml"))).toBe("add redis");
    expect(sessionTitle(firstDraft("Uploaded c.yml", "c.yml"))).toBe("shop");
  });

  it("keeps the title of an SLA continued from the history", () => {
    expect(sessionTitle({ ...firstDraft(), historySeed: "old shop" })).toBe("old shop");
  });
});

describe("draftEntry", () => {
  it("is null before the first draft and while the JSON is broken", () => {
    expect(draftEntry(initialState())).toBeNull();
    expect(draftEntry(run(firstDraft(), { type: "set-editor-text", text: "{" }))).toBeNull();
  });

  it("keeps hand edits and the accepted flag", () => {
    const s = run(firstDraft(), { type: "set-editor-text", text: '{"edited":true}' }, { type: "accept" });
    expect(draftEntry(s)).toEqual({ id: "s1", title: "a web shop", sla: '{"edited":true}', accepted: true });
  });
});

describe("useRecordHistory", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("saves once typing pauses", () => {
    const { rerender } = renderHook(({ s }) => useRecordHistory(s), { initialProps: { s: firstDraft() } });
    expect(readHistory()).toEqual([]);
    act(() => vi.advanceTimersByTime(HISTORY_SAVE_DEBOUNCE_MS));
    expect(readHistory().map((e) => e.sla)).toEqual([firstDraft().editedSla]);

    rerender({ s: run(firstDraft(), { type: "set-editor-text", text: "{}" }) });
    act(() => vi.advanceTimersByTime(HISTORY_SAVE_DEBOUNCE_MS));
    expect(readHistory().map((e) => e.sla)).toEqual(["{}"]);
  });

  it("writes a pending change right away when the session ends", () => {
    const { rerender } = renderHook(({ s }) => useRecordHistory(s), { initialProps: { s: firstDraft() } });
    rerender({ s: initialState() });
    expect(readHistory().map((e) => e.id)).toEqual(["s1"]);
  });

  it("writes a pending change when the page goes away", () => {
    renderHook(() => useRecordHistory(firstDraft()));
    window.dispatchEvent(new Event("pagehide"));
    expect(readHistory()).toHaveLength(1);
  });
});

describe("useHistoryEntries", () => {
  const entry = (id: string): HistoryEntry => ({ id, title: id, savedAt: 1, sla: "{}", accepted: false });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("picks up what was written before it mounted", () => {
    writeHistory([entry("a")]);
    const { result } = renderHook(() => useHistoryEntries());
    expect(result.current.map((e) => e.id)).toEqual(["a"]);
  });

  it("doesn't read storage again on re-render", () => {
    const { result, rerender } = renderHook(() => useHistoryEntries());
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    rerender();
    rerender();
    expect(getItem).not.toHaveBeenCalled();
    expect(result.current).toEqual([]);
  });

  it("updates on its own saves and on other tabs' writes", () => {
    const { result } = renderHook(() => useHistoryEntries());
    act(() => saveToHistory(entry("a")));
    expect(result.current.map((e) => e.id)).toEqual(["a"]);

    // Another tab: storage changes without a commit here, then the event arrives.
    writeHistory([entry("b"), entry("a")]);
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: HISTORY_STORAGE_KEY })));
    expect(result.current.map((e) => e.id)).toEqual(["b", "a"]);
  });
});
