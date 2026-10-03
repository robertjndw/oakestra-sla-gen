import { createContext, useContext } from "react";
import type { SessionApi } from "./use-session";

export const SessionContext = createContext<SessionApi | null>(null);

export function useSessionContext(): SessionApi {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSessionContext must be used inside <SessionProvider>");
  return ctx;
}
