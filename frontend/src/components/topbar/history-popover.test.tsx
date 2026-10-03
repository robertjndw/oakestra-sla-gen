import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionContext } from "@/hooks/session-context";
import { initialState, type SessionApi, type SessionState } from "@/hooks/use-session";
import { readHistory, writeHistory, type HistoryEntry } from "@/lib/history";
import { HistoryPopover } from "./history-popover";

const sla = JSON.stringify({ applications: [{ microservices: [{}, {}] }] });
const shop: HistoryEntry = { id: "s1", title: "web shop", savedAt: 0, sla, accepted: true };
const blog: HistoryEntry = { id: "s2", title: "blog", savedAt: 0, sla, accepted: false };

function fakeApi(state: Partial<SessionState> = {}, hasUnacceptedWork = false): SessionApi {
  const noop = vi.fn();
  return {
    state: { ...initialState(), ...state },
    settingsLocked: false,
    hasUnacceptedWork,
    send: vi.fn().mockResolvedValue(undefined),
    answer: vi.fn().mockResolvedValue(undefined),
    accept: noop,
    keepRefining: noop,
    newSession: noop,
    openFromHistory: vi.fn(),
    loadCandidate: noop,
    setEditorText: noop,
    resetToModel: noop,
    setSettings: noop,
    dismissPendingDraft: noop,
  };
}

async function openPopover(api: SessionApi) {
  const user = userEvent.setup();
  render(
    <SessionContext.Provider value={api}>
      <HistoryPopover />
    </SessionContext.Provider>,
  );
  await user.click(screen.getByRole("button", { name: "History" }));
  return user;
}

afterEach(() => localStorage.clear());

describe("HistoryPopover", () => {
  it("says when there is nothing saved", async () => {
    await openPopover(fakeApi());
    expect(screen.getByText(/No saved SLAs yet/)).toBeInTheDocument();
  });

  it("lists entries with their service count and opens one", async () => {
    writeHistory([shop, blog]);
    const api = fakeApi();
    const user = await openPopover(api);
    expect(screen.getByText(/2 services · Accepted/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^web shop/ }));
    expect(api.openFromHistory).toHaveBeenCalledWith(shop);
  });

  it("asks before replacing unaccepted work", async () => {
    writeHistory([shop]);
    const api = fakeApi({}, true);
    const user = await openPopover(api);
    await user.click(screen.getByRole("button", { name: /^web shop/ }));
    expect(api.openFromHistory).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(api.openFromHistory).toHaveBeenCalledWith(shop);
  });

  it("deletes an entry but not the current session's", async () => {
    writeHistory([shop, blog]);
    const user = await openPopover(fakeApi({ sessionId: "s1" }));
    expect(screen.getByText(/Current session/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete web shop" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Delete blog" }));
    expect(readHistory().map((e) => e.id)).toEqual(["s1"]);
    expect(screen.queryByText("blog")).toBeNull();
  });

  it("clears everything after confirming", async () => {
    writeHistory([shop, blog]);
    const user = await openPopover(fakeApi());
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(readHistory()).toEqual([]);
  });
});
