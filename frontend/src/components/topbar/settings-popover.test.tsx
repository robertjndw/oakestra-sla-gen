import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionContext } from "@/hooks/session-context";
import { initialState, type SessionApi } from "@/hooks/use-session";
import { SettingsPopover } from "./settings-popover";

function fakeApi(): SessionApi {
  const noop = vi.fn();
  return {
    state: initialState(),
    settingsLocked: false,
    hasUnacceptedWork: false,
    send: vi.fn().mockResolvedValue(undefined),
    answer: vi.fn().mockResolvedValue(undefined),
    accept: noop,
    keepRefining: noop,
    newSession: noop,
    openFromHistory: noop,
    loadCandidate: noop,
    setEditorText: noop,
    resetToModel: noop,
    setSettings: noop,
    dismissPendingDraft: noop,
  };
}

describe("SettingsPopover", () => {
  it("does not open a help tooltip just because the popover opened", async () => {
    const user = userEvent.setup();
    render(
      <SessionContext.Provider value={fakeApi()}>
        <TooltipProvider delayDuration={0}>
          <SettingsPopover />
        </TooltipProvider>
      </SessionContext.Provider>,
    );
    await user.click(screen.getByRole("button", { name: /settings/i }));

    expect(screen.getByLabelText("Attempts per round")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "About Attempts per round" })).not.toHaveFocus();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
