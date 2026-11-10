import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEditorValidation } from "@/hooks/editor-validation";
import { useSessionContext } from "@/hooks/session-context";
import { useModelName } from "@/hooks/use-info";
import { useHost, type PlaygroundActionsProps } from "@/host/host-context";
import { HistoryPopover } from "./history-popover";
import { SettingsPopover } from "./settings-popover";

function HostActions() {
  const { Actions } = useHost();
  const { state } = useSessionContext();
  const { status, errors } = useEditorValidation();
  if (!Actions) return null;
  const props: PlaygroundActionsProps = {
    sla: state.editedSla,
    validation: { status, errors },
    turnRunning: state.turnRunning,
  };
  return <Actions {...props} />;
}

/** Model, history, settings, New session and the host's own actions. Brand-free, so hosts can reuse it. */
export function PlaygroundToolbar() {
  const { hasUnacceptedWork, newSession } = useSessionContext();
  const model = useModelName();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onNewSession = () => {
    if (hasUnacceptedWork) setConfirmOpen(true);
    else newSession();
  };

  return (
    <div className="slagen:ml-auto slagen:flex slagen:shrink-0 slagen:items-center slagen:gap-1">
      {model && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              className="slagen:mr-2 slagen:hidden slagen:max-w-64 slagen:items-baseline slagen:gap-2 slagen:rounded-sm slagen:text-xs slagen:focus-visible:ring-2 slagen:focus-visible:ring-ring slagen:focus-visible:outline-none slagen:@5xl:inline-flex"
            >
              <span className="slagen:text-muted-foreground">Model</span>
              <span className="slagen:truncate slagen:font-mono">{model}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>Model the server generates with</TooltipContent>
        </Tooltip>
      )}
      {model && <Separator orientation="vertical" className="slagen:mr-1 slagen:hidden slagen:h-5! slagen:@5xl:block" />}
      <HistoryPopover />
      <SettingsPopover />
      <Button variant="outline" size="sm" className="slagen:ml-1" aria-label="New session" onClick={onNewSession}>
        <PlusIcon aria-hidden />
        <span className="slagen:hidden slagen:sm:inline">New session</span>
      </Button>
      <HostActions />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Start over?"
        description="This clears the conversation and the current draft."
        actionLabel="Start over"
        onConfirm={newSession}
      />
    </div>
  );
}
