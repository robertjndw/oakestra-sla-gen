import { lazy, Suspense, useMemo, useState } from "react";
import { Artifact, ArtifactContent } from "@/components/ai-elements/artifact";
import { useSessionContext } from "@/hooks/session-context";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { useValidation } from "@/hooks/use-validation";
import { MODE_STORAGE_KEY } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { isEdited } from "@/hooks/use-session";
import { EmptyOutput } from "./empty-output";
import { OutputHeader } from "./output-header";
import { isOutputMode } from "./output-mode";
import type { OutputMode } from "./output-mode";
import { PendingDraftDialog } from "./pending-draft-dialog";
import { problemItems } from "./problems";
import { VisualBoundary } from "./visual-boundary";
import { VisualView } from "./visual-view";
import "./output.css";

// CodeMirror is only needed once someone opens the Code tab.
const CodeView = lazy(() => import("./code-view"));

function codeStatus(parseError: boolean, edited: boolean, hasText: boolean): string {
  if (parseError) return "";
  if (edited) return "Edited by hand. Validated as you type.";
  return hasText ? "This is the draft as the model wrote it." : "";
}

function EditorPlaceholder() {
  return (
    <div role="status" className="flex min-h-0 flex-1 p-4">
      <div className="flex-1 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      <span className="sr-only">Loading the editor</span>
    </div>
  );
}

export function OutputPane() {
  const session = useSessionContext();
  const { state, setEditorText, resetToModel } = session;
  const text = state.editedSla;
  // No rounds means a new session just started (or none ever did).
  const validation = useValidation(text, state.baselineText, state.rounds.length === 0);
  const [mode, setMode] = useLocalStorageState<OutputMode>(MODE_STORAGE_KEY, "visual", isOutputMode);

  // "Fix the last attempt by hand" bumps the request; adjust during render rather than in an effect.
  const [seenRequest, setSeenRequest] = useState(state.codeViewRequest);
  if (seenRequest !== state.codeViewRequest) {
    setSeenRequest(state.codeViewRequest);
    setMode("code");
  }

  const hasText = text.trim() !== "";
  const edited = hasText && isEdited(state);
  const { sla, parseError } = validation;
  const showCode = mode === "code" && (hasText || sla !== null);
  const showVisual = mode === "visual" && sla !== null;
  const items = useMemo(
    () => problemItems(text, validation.errors, parseError),
    [text, validation.errors, parseError],
  );

  return (
    <Artifact
      role="region"
      aria-label="SLA"
      aria-busy={state.turnRunning}
      className="min-h-[520px] rounded-none border-0 border-t bg-card shadow-none lg:min-h-0 lg:border-t-0 lg:border-l"
    >
      <OutputHeader
        text={text}
        hasSla={sla !== null}
        draftCount={state.draftCount}
        edited={edited}
        accepted={state.accepted}
        validation={validation}
        mode={mode}
        onModeChange={setMode}
      />
      {state.turnRunning ? (
        <div role="progressbar" aria-label="Generating a draft" className="relative h-0.5 shrink-0 overflow-hidden bg-muted">
          <div className="output-indeterminate absolute inset-y-0 left-0 w-1/3 animate-[output-indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-primary" />
        </div>
      ) : (
        // Holds the bar's height so the content does not jump when a turn starts or ends.
        <div aria-hidden className="h-0.5 shrink-0" />
      )}
      <ArtifactContent
        className={cn(
          "flex min-h-0 flex-col transition-opacity duration-200",
          // CodeMirror scrolls itself and has to reach the edges.
          showCode ? "overflow-visible p-0" : "overflow-auto p-4 sm:p-6",
          state.turnRunning && "opacity-55",
        )}
      >
        {showVisual && sla && (
          <VisualBoundary resetKey={sla}>
            <VisualView
              sla={sla}
              previous={state.previousModelSla}
              errors={validation.errors}
              parseError={parseError}
            />
          </VisualBoundary>
        )}
        {showCode && (
          <Suspense fallback={<EditorPlaceholder />}>
            <CodeView
              text={text}
              items={items}
              status={codeStatus(parseError !== null, edited, hasText)}
              hasModelDraft={state.baselineText !== ""}
              canReset={edited}
              onChange={setEditorText}
              onReset={resetToModel}
            />
          </Suspense>
        )}
        {!showCode && !showVisual && (
          <EmptyOutput turnRunning={state.turnRunning} hasSession={state.sessionId !== null} />
        )}
      </ArtifactContent>
      <PendingDraftDialog />
    </Artifact>
  );
}
