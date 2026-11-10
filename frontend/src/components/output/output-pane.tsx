import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useEditorValidation } from "@/hooks/editor-validation";
import { useSessionContext } from "@/hooks/session-context";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { useHost } from "@/host/host-context";
import { slaText } from "@/lib/sla";
import { cn } from "@/lib/utils";
import { isEdited, isFromHistory } from "@/hooks/use-session";
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
    <div role="status" className="slagen:flex slagen:min-h-0 slagen:flex-1 slagen:p-4">
      <div className="slagen:flex-1 slagen:animate-pulse slagen:rounded-lg slagen:bg-muted slagen:motion-reduce:animate-none" />
      <span className="slagen:sr-only">Loading the editor</span>
    </div>
  );
}

export function OutputPane() {
  const session = useSessionContext();
  const { notify, storageKey } = useHost();
  const { state, setEditorText, resetToModel } = session;
  const text = state.editedSla;
  const fromHistory = isFromHistory(state);
  const validation = useEditorValidation();
  const [mode, setMode] = useLocalStorageState<OutputMode>(storageKey("mode"), "visual", isOutputMode);
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
    notify.success(`Restored draft ${viewed.draft}`, {
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
      className="slagen:flex slagen:min-h-[520px] slagen:flex-col slagen:overflow-hidden slagen:bg-card slagen:@5xl:min-h-0"
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
        <div role="progressbar" aria-label="Generating a draft" className="slagen:relative slagen:h-0.5 slagen:shrink-0 slagen:overflow-hidden slagen:bg-muted">
          <div className="slagen:absolute slagen:inset-y-0 slagen:left-0 slagen:w-1/3 slagen:animate-indeterminate slagen:rounded-full slagen:bg-primary slagen:motion-reduce:[animation-duration:4s]" />
        </div>
      ) : (
        // Holds the bar's height so the content does not jump when a turn starts or ends.
        <div aria-hidden className="slagen:h-0.5 slagen:shrink-0" />
      )}
      {viewed && (
        <ViewingBar draft={viewed.draft} latest={state.draftCount} onRestore={requestRestore} onBack={backToLatest} />
      )}
      <div
        className={cn(
          "slagen:flex slagen:min-h-0 slagen:flex-1 slagen:flex-col slagen:transition-opacity slagen:duration-200",
          // CodeMirror scrolls itself and has to reach the edges.
          showCode ? "slagen:overflow-visible slagen:p-0" : "slagen:overflow-auto slagen:p-4 slagen:sm:p-6",
          state.turnRunning && "slagen:opacity-55",
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
