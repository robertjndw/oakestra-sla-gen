import type { ReactNode } from "react";
import { useHost } from "@/host/host-context";
import { SessionContext } from "./session-context";
import { restoreSession, usePersistSession, type PersistKeys } from "./session-persistence";
import { useRecordHistory } from "./use-history";
import { sessionReducer, useSessionController, type SessionState } from "./use-session";

/** Nothing came back from a reload: no conversation and nothing in the editor. */
const isBlank = (s: SessionState) => !s.sessionId && s.rounds.length === 0 && s.editedSla === "";

export function SessionProvider({ children }: { children: ReactNode }) {
  const { storageKey, fixedCustomerId, seed } = useHost();
  const keys: PersistKeys = { settings: storageKey("settings"), session: storageKey("session") };
  const session = useSessionController(
    () => {
      const restored = restoreSession(keys);
      if (!seed || !isBlank(restored)) return restored;
      // Applied to the initial state rather than dispatched after mount, so the empty playground
      // never flashes first. Token 0 is the controller's starting token.
      return sessionReducer(restored, { type: "open-history", token: 0, title: seed.title, sla: seed.sla });
    },
    { fixedCustomerId, seed },
  );
  usePersistSession(session.state, keys);
  useRecordHistory(session.state, storageKey("history"));
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
