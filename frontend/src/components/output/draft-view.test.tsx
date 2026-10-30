import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatusHead } from "@/components/conversation/status-head";
import { Thread } from "@/components/conversation/thread";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionContext } from "@/hooks/session-context";
import { initialState, type SessionApi, type SessionState } from "@/hooks/use-session";
import { MODE_STORAGE_KEY } from "@/lib/constants";
import type { Sla } from "@/lib/types";
import { slaText } from "@/lib/sla";
import { clearViewedDraft, type DraftRound } from "./draft-view";
import { OutputPane } from "./output-pane";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const slaFor = (memory: number): Sla => ({
  applications: [{ application_name: "a", microservices: [{ microservice_name: "web", memory }] }],
});

function draftRound(draft: number): DraftRound {
  return {
    id: draft,
    kind: "draft",
    draft,
    sla: slaFor(draft * 100),
    changes: [`change ${draft}`],
    questions: [],
    attempts: [],
    frozen: null,
  };
}

function stateWith(n: number, over: Partial<SessionState> = {}): SessionState {
  const rounds = Array.from({ length: n }, (_, i) => draftRound(i + 1));
  const text = slaText(rounds[n - 1].sla);
  return {
    ...initialState(),
    sessionId: "s1",
    rounds,
    draftCount: n,
    modelSla: rounds[n - 1].sla,
    previousModelSla: rounds[n - 2]?.sla ?? null,
    editedSla: text,
    baselineText: text,
    nextId: n + 1,
    ...over,
  };
}

// Cast rather than spelled out in full, so a new SessionApi member elsewhere doesn't break this.
function fakeApi(state: SessionState) {
  return { state, setEditorText: vi.fn(), resetToModel: vi.fn(), dismissPendingDraft: vi.fn() } as unknown as SessionApi;
}

function pane(api: SessionApi) {
  return (
    <SessionContext.Provider value={api}>
      <TooltipProvider>
        <OutputPane />
        <Thread
          rounds={api.state.rounds}
          activeFormId={null}
          answers={[]}
          onAnswersChange={() => {}}
          loadCandidate={() => {}}
          newSession={() => {}}
          historySeed={null}
          onPickExample={() => {}}
        />
      </TooltipProvider>
    </SessionContext.Provider>
  );
}

const renderPane = (api: SessionApi) => render(pane(api));

beforeEach(() => {
  // jsdom has no layout, so every element looks off screen and gets scrolled to.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  clearViewedDraft();
  localStorage.clear();
});

describe("viewing an older draft", () => {
  it("picks a draft from the header and goes back to the latest", async () => {
    const user = userEvent.setup();
    renderPane(fakeApi(stateWith(3)));
    await user.click(screen.getByRole("button", { name: /Draft 3, choose a draft to view/ }));
    await user.click(screen.getByRole("menuitemradio", { name: /Draft 1/ }));

    const bar = screen.getByText("Viewing draft 1").closest("[role=status]") as HTMLElement;
    expect(bar).toHaveTextContent("of 3. Read-only.");
    expect(screen.getByRole("button", { name: /^Draft 1, choose/ })).toBeInTheDocument();

    await user.click(within(bar).getByRole("button", { name: "Back to latest" }));
    expect(screen.queryByText("Viewing draft 1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Draft 3, choose/ })).toHaveFocus();
  });

  it("opens a draft from its heading in the conversation", async () => {
    const user = userEvent.setup();
    renderPane(fakeApi(stateWith(2)));
    await user.click(screen.getByRole("button", { name: "View draft 1 in the SLA pane" }));
    expect(screen.getByText("Viewing draft 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View draft 1 in the SLA pane" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("Viewing", { selector: "[data-slot=badge]" })).toBeInTheDocument();
  });

  it("restores a draft straight away when there are no hand edits", async () => {
    const user = userEvent.setup();
    const api = fakeApi(stateWith(3));
    renderPane(api);
    await user.click(screen.getByRole("button", { name: "View draft 2 in the SLA pane" }));
    await user.click(screen.getByRole("button", { name: "Restore this draft" }));
    expect(api.setEditorText).toHaveBeenCalledWith(slaText(slaFor(200)));
    expect(screen.queryByText("Viewing draft 2")).not.toBeInTheDocument();
  });

  it("asks before a restore replaces hand edits", async () => {
    const user = userEvent.setup();
    const api = fakeApi(stateWith(3, { editedSla: "{}" }));
    renderPane(api);
    await user.click(screen.getByRole("button", { name: "View draft 1 in the SLA pane" }));
    await user.click(screen.getByRole("button", { name: "Restore this draft" }));
    expect(api.setEditorText).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Replace my edits" }));
    expect(api.setEditorText).toHaveBeenCalledWith(slaText(slaFor(100)));
  });

  it("puts focus on the picker after confirming a restore", async () => {
    const user = userEvent.setup();
    renderPane(fakeApi(stateWith(3, { editedSla: "{}" })));
    await user.click(screen.getByRole("button", { name: "View draft 1 in the SLA pane" }));
    await user.click(screen.getByRole("button", { name: "Restore this draft" }));
    await user.click(screen.getByRole("button", { name: "Replace my edits" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^Draft 3, .*choose/ })).toHaveFocus());
  });

  it("leaves the viewed draft when a failed attempt is loaded into the editor", async () => {
    const user = userEvent.setup();
    const state = stateWith(3);
    const { rerender } = renderPane(fakeApi(state));
    await user.click(screen.getByRole("button", { name: "View draft 1 in the SLA pane" }));
    expect(screen.getByText("Viewing draft 1")).toBeInTheDocument();

    rerender(pane(fakeApi({ ...state, codeViewRequest: state.codeViewRequest + 1 })));
    expect(screen.queryByText("Viewing draft 1")).not.toBeInTheDocument();
  });

  it("turns Show changes off when the viewing ends", async () => {
    localStorage.setItem(MODE_STORAGE_KEY, JSON.stringify("code"));
    const user = userEvent.setup();
    renderPane(fakeApi(stateWith(3)));
    await user.click(screen.getByRole("button", { name: "View draft 2 in the SLA pane" }));
    const toggle = await screen.findByRole("switch", { name: "Show changes" });
    await user.click(toggle);
    expect(toggle).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Back to latest" }));
    expect(await screen.findByRole("switch", { name: "Show changes" })).not.toBeChecked();
  });

  it("offers no picker or heading buttons with a single draft", () => {
    localStorage.setItem(MODE_STORAGE_KEY, JSON.stringify("visual"));
    renderPane(fakeApi(stateWith(1)));
    expect(screen.queryByRole("button", { name: /choose a draft/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /View draft/ })).not.toBeInTheDocument();
  });
});

describe("StatusHead", () => {
  it("renders a plain title without a click handler", () => {
    render(<StatusHead status="ok" title="Draft 1" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
