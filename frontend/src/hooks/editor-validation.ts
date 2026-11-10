import { createContext, useContext } from "react";
import type { ValidationResult } from "./use-validation";

export const EditorValidationContext = createContext<ValidationResult | null>(null);

/**
 * Validation of the editor's working copy. Lives above the panes so the output pane and the
 * host's toolbar actions read the same result instead of each sending their own /validate calls.
 */
export function useEditorValidation(): ValidationResult {
  const ctx = useContext(EditorValidationContext);
  if (!ctx) throw new Error("useEditorValidation must be used inside <EditorValidationProvider>");
  return ctx;
}
