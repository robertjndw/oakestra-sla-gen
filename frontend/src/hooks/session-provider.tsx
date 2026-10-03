import type { ReactNode } from "react";
import { SessionContext } from "./session-context";
import { restoreSession, usePersistSession } from "./session-persistence";
import { useRecordHistory } from "./use-history";
import { useSessionController } from "./use-session";

export function SessionProvider({ children }: { children: ReactNode }) {
  const session = useSessionController(restoreSession);
  usePersistSession(session.state);
  useRecordHistory(session.state);
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
