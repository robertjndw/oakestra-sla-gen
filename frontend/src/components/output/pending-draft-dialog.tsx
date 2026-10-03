import { ConfirmDialog } from "@/components/confirm-dialog";
import { useSessionContext } from "@/hooks/session-context";

export function PendingDraftDialog() {
  const { state, resetToModel, dismissPendingDraft } = useSessionContext();
  return (
    <ConfirmDialog
      open={state.pendingDraft !== null}
      // Escape or an outside click keeps the edits, since that throws nothing away.
      onOpenChange={(open) => {
        if (!open) dismissPendingDraft();
      }}
      title="The model sent a new draft"
      description="Replace your edits in the Code view with it? You can still go back to it later with Reset to model draft."
      cancelLabel="Keep my edits"
      actionLabel="Replace my edits"
      onConfirm={resetToModel}
    />
  );
}
