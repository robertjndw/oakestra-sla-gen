import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSessionContext } from "@/hooks/session-context";

export function PendingDraftDialog() {
  const { state, resetToModel, dismissPendingDraft } = useSessionContext();
  return (
    <AlertDialog
      open={state.pendingDraft !== null}
      // Escape or an outside click keeps the edits, since that throws nothing away.
      onOpenChange={(open) => {
        if (!open) dismissPendingDraft();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>The model sent a new draft</AlertDialogTitle>
          <AlertDialogDescription>
            Replace your edits in the Code view with it? You can still go back to it later with
            Reset to model draft.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep my edits</AlertDialogCancel>
          <AlertDialogAction onClick={resetToModel}>Replace my edits</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
