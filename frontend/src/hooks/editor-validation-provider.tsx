import type { ReactNode } from "react";
import { EditorValidationContext } from "./editor-validation";
import { useSessionContext } from "./session-context";
import { isFromHistory } from "./use-session";
import { useValidation } from "./use-validation";

export function EditorValidationProvider({ children }: { children: ReactNode }) {
  const { state } = useSessionContext();
  // Before the first draft, a baseline can only be an SLA reopened from the history. It passed
  // when it was saved, but the schema or an image may have changed since, so it is checked again.
  const trustedText = isFromHistory(state) ? "" : state.baselineText;
  // No rounds means a new session just started (or none ever did).
  const validation = useValidation(state.editedSla, trustedText, state.rounds.length === 0);
  return <EditorValidationContext.Provider value={validation}>{children}</EditorValidationContext.Provider>;
}
