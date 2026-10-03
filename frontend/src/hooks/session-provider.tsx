import type { ReactNode } from "react";
import { SessionContext } from "./session-context";
import { useSessionController } from "./use-session";

export function SessionProvider({ children }: { children: ReactNode }) {
  const session = useSessionController();
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
