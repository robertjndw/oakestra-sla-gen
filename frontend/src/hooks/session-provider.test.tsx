import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HostProvider } from "@/host/host-provider";
import type { PlaygroundHost } from "@/host/host-context";
import { SESSION_STORAGE_KEY, SETTINGS_STORAGE_KEY } from "@/lib/constants";
import { useSessionContext } from "./session-context";
import { SessionProvider } from "./session-provider";

function Probe() {
  const { state, newSession, openFromHistory } = useSessionContext();
  return (
    <>
      <output data-testid="probe">
        {JSON.stringify({ seed: state.historySeed, sla: state.editedSla, retries: state.settings.maxRetries })}
      </output>
      <button onClick={() => openFromHistory({ title: "other", sla: "{}" })}>open other</button>
      <button onClick={newSession}>new session</button>
    </>
  );
}

const probe = () => JSON.parse(screen.getByTestId("probe").textContent!);
const click = (name: string) => act(() => screen.getByRole("button", { name }).click());

function renderWith(host: Partial<PlaygroundHost>) {
  render(
    <HostProvider host={host}>
      <SessionProvider>
        <Probe />
      </SessionProvider>
    </HostProvider>,
  );
  return probe();
}

const seed = { title: "from the dashboard", sla: '{"applications":[]}' };

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("SessionProvider with a host", () => {
  it("opens the host's seed SLA when nothing was restored", () => {
    expect(renderWith({ seed })).toMatchObject({ seed: "from the dashboard", sla: seed.sla });
  });

  it("starts a new session from the seed again", () => {
    renderWith({ seed });
    click("open other");
    expect(probe()).toMatchObject({ seed: "other", sla: "{}" });
    click("new session");
    expect(probe()).toMatchObject({ seed: "from the dashboard", sla: seed.sla });
  });

  it("starts a new session blank without a seed", () => {
    renderWith({});
    click("open other");
    click("new session");
    expect(probe()).toMatchObject({ seed: null, sla: "" });
  });

  it("leaves a restored conversation alone", () => {
    const snap = { ...JSON.parse(JSON.stringify(baseSnapshot)), editedSla: "{}" };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snap));
    expect(renderWith({ seed })).toMatchObject({ seed: null, sla: "{}" });
  });

  it("reads and writes storage under the host's keys", () => {
    localStorage.setItem("dash-settings", JSON.stringify({ maxRetries: 7, customerId: "", checkImages: true }));
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ maxRetries: 2, customerId: "", checkImages: true }));
    const out = renderWith({ storageKey: (name) => `dash-${name}` });
    expect(out.retries).toBe(7);
  });
});

// The smallest snapshot restoreSession accepts.
const baseSnapshot = {
  version: 1,
  sessionId: null,
  rounds: [],
  settings: { maxRetries: 3, customerId: "", checkImages: true },
  modelSla: null,
  previousModelSla: null,
  draftCount: 0,
  editedSla: "",
  baselineText: "",
  pendingDraft: null,
  accepted: false,
  historySeed: null,
  nextId: 1,
};
