import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useSessionContext } from "@/hooks/session-context";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { useValidation } from "@/hooks/use-validation";
import { MODE_STORAGE_KEY } from "@/lib/constants";
import { slaText } from "@/lib/sla";
import { cn } from "@/lib/utils";
import { isEdited } from "@/hooks/use-session";
import { diffBase } from "./diff-base";
import { draftRounds, findDraft, OUTPUT_PANE_ID, useViewedDraft } from "./draft-view";
import { EmptyOutput } from "./empty-output";
import { OutputHeader } from "./output-header";
import { isOutputMode } from "./output-mode";
import type { OutputMode } from "./output-mode";
import { PendingDraftDialog } from "./pending-draft-dialog";
import { problemItems } from "./problems";
import { VisualBoundary } from "./visual-boundary";
import { ViewingBar } from "./viewing-bar";
import { VisualView } from "./visual-view";
import "./output.css";

// CodeMirror is only needed once someone opens the Code tab.
const CodeView = lazy(() => import("./code-view"));

function codeStatus(parseError: boolean, edited: boolean, hasText: boolean, fromHistory: boolean): string {
  if (parseError) return "";
  if (edited) return "Edited by hand. Validated as you type.";
  if (fromHistory) return "As saved in the history.";
  return hasText ? "This is the draft as the model wrote it." : "";
}

// Shared so the memos below see the same empty list for an older draft on every render.
const NO_ERRORS: string[] = [];

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
  // Before the first draft, a baseline can only be an SLA reopened from the history. It passed
  // when it was saved, but the schema or an image may have changed since, so it is checked again.
  const fromHistory = state.draftCount === 0 && state.historySeed !== null;
  const trustedText = fromHistory ? "" : state.baselineText;
  // No rounds means a new session just started (or none ever did).
  const validation = useValidation(text, trustedText, state.rounds.length === 0);
  const [mode, setMode] = useLocalStorageState<OutputMode>(MODE_STORAGE_KEY, "visual", isOutputMode);
  const { viewed, viewDraft } = useViewedDraft();
  const drafts = useMemo(() => draftRounds(state.rounds), [state.rounds]);
  const [showDiff, setShowDiff] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const pickerRef = useRef<HTMLButtonElement>(null);

  // "Fix the last attempt by hand" bumps the request; adjust during render rather than in an effect.
  const [seenRequest, setSeenRequest] = useState(state.codeViewRequest);
  if (seenRequest !== state.codeViewRequest) {
    setSeenRequest(state.codeViewRequest);
    setMode("code");
  }

  const hasText = text.trim() !== "";
  const handEdited = isEdited(state);
  const edited = hasText && handEdited;
  const { sla, parseError } = validation;
  const viewedText = useMemo(() => (viewed ? slaText(viewed.sla) : null), [viewed]);
  const shownText = viewedText ?? text;
  const showCode = mode === "code" && (viewed !== null || hasText || sla !== null);
  const visualSla = viewed?.sla ?? sla;
  const showVisual = mode === "visual" && visualSla !== null;
  const items = useMemo(
    () => (viewed ? [] : problemItems(text, validation.errors, parseError)),
    [viewed, text, validation.errors, parseError],
  );
  const base = useMemo(
    () =>
      diffBase({
        viewed,
        drafts,
        draftCount: state.draftCount,
        edited: handEdited,
        baselineText: state.baselineText,
        fromHistory,
      }),
    [viewed, drafts, state.draftCount, handEdited, state.baselineText, fromHistory],
  );
  // Once the working copy has nothing to compare with (a new session, back to one draft), the
  // switch goes away. Left on, it would make the editor read-only the moment a comparison shows up
  // again, which can be in the middle of typing the first hand edit.
  if (!viewed && base === null && showDiff) setShowDiff(false);
  // The switch belongs to one comparison. Carried from a viewed draft to the working copy it would
  // make the editor read-only.
  const viewedDraft = viewed?.draft ?? null;
  const [seenViewed, setSeenViewed] = useState(viewedDraft);
  if (seenViewed !== viewedDraft) {
    setSeenViewed(viewedDraft);
    if (showDiff) setShowDiff(false);
  }
  // A draft arriving while the dialog is up ends the viewing, and with it the question.
  if (!viewed && confirmRestore) setConfirmRestore(false);
  const viewedPrevious = viewed ? (findDraft(drafts, viewed.draft - 1)?.sla ?? null) : null;

  // The picker trigger outlives the bar, so focus has somewhere to go when the bar's buttons vanish.
  const backToLatest = () => {
    viewDraft(null);
    pickerRef.current?.focus();
  };
  const restore = () => {
    if (!viewed || viewedText === null) return;
    setEditorText(viewedText);
    backToLatest();
    // Hand edits never reach the model, so it is worth saying that the next draft builds on the
    // latest one, not on the restored one.
    toast.success(`Restored draft ${viewed.draft}`, {
      description: `It's your working copy now. The model still refines from draft ${state.draftCount}.`,
    });
  };
  const requestRestore = () => {
    if (viewed && handEdited && text !== viewedText) setConfirmRestore(true);
    else restore();
  };

  return (
    <div
      id={OUTPUT_PANE_ID}
      role="region"
      aria-label="SLA"
      aria-busy={state.turnRunning}
      className="flex min-h-[520px] flex-col overflow-hidden bg-card lg:min-h-0"
    >
      <OutputHeader
        text={shownText}
        hasSla={visualSla !== null}
        draftCount={state.draftCount}
        edited={edited}
        fromHistory={fromHistory}
        accepted={state.accepted}
        validation={validation}
        mode={mode}
        onModeChange={setMode}
        drafts={drafts}
        viewedDraft={viewedDraft}
        onViewDraft={viewDraft}
        pickerRef={pickerRef}
      />
      {state.turnRunning ? (
        <div role="progressbar" aria-label="Generating a draft" className="relative h-0.5 shrink-0 overflow-hidden bg-muted">
          <div className="output-indeterminate absolute inset-y-0 left-0 w-1/3 animate-[output-indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-primary" />
        </div>
      ) : (
        // Holds the bar's height so the content does not jump when a turn starts or ends.
        <div aria-hidden className="h-0.5 shrink-0" />
      )}
      {viewed && (
        <ViewingBar draft={viewed.draft} latest={state.draftCount} onRestore={requestRestore} onBack={backToLatest} />
      )}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col transition-opacity duration-200",
          // CodeMirror scrolls itself and has to reach the edges.
          showCode ? "overflow-visible p-0" : "overflow-auto p-4 sm:p-6",
          state.turnRunning && "opacity-55",
        )}
      >
        {showVisual && visualSla && (
          <VisualBoundary resetKey={visualSla}>
            <VisualView
              sla={visualSla}
              previous={viewed ? viewedPrevious : state.previousModelSla}
              errors={viewed ? NO_ERRORS : validation.errors}
              parseError={viewed ? null : parseError}
            />
          </VisualBoundary>
        )}
        {showCode && (
          <Suspense fallback={<EditorPlaceholder />}>
            <CodeView
              // A fresh editor per document, so undo can't step from the working copy into an
              // older draft (or back) and turn it into a hand edit.
              key={viewed ? `draft-${viewed.draft}` : "working"}
              text={shownText}
              items={items}
              status={
                viewed
                  ? `Draft ${viewed.draft} as the model wrote it.`
                  : codeStatus(parseError !== null, edited, hasText, fromHistory)
              }
              resetLabel={!state.baselineText ? null : fromHistory ? "Reset to saved SLA" : "Reset to model draft"}
              canReset={edited}
              readOnly={viewed !== null}
              diff={base}
              showDiff={showDiff}
              onShowDiffChange={setShowDiff}
              onChange={setEditorText}
              onReset={resetToModel}
            />
          </Suspense>
        )}
        {!showCode && !showVisual && (
          <EmptyOutput turnRunning={state.turnRunning} hasSession={state.sessionId !== null} />
        )}
      </div>
      <PendingDraftDialog />
      <ConfirmDialog
        open={confirmRestore}
        onOpenChange={setConfirmRestore}
        title={viewed ? `Replace your edits with draft ${viewed.draft}?` : "Replace your edits?"}
        description={`This discards your hand edits in the Code view. Reset to model draft still goes back to draft ${state.draftCount}.`}
        actionLabel="Replace my edits"
        onConfirm={restore}
        // Focusing the trigger inside restore() loses to the dialog's focus trap, and Radix would
        // then return focus to the Restore button, which is gone by now.
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          pickerRef.current?.focus();
        }}
      />
    </div>
  );
}
