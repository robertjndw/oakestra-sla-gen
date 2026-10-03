import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSessionContext } from "@/hooks/session-context";
import { useModelName } from "@/hooks/use-info";
import { HistoryPopover } from "./history-popover";
import { Logo } from "./logo";
import { SettingsPopover } from "./settings-popover";

export function TopBar() {
  const { hasUnacceptedWork, newSession } = useSessionContext();
  const model = useModelName();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onNewSession = () => {
    if (hasUnacceptedWork) setConfirmOpen(true);
    else newSession();
  };

  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b bg-card px-4">
      <div className="flex min-w-0 items-center gap-2 text-primary">
        <Logo />
        <span className="truncate font-semibold whitespace-nowrap text-foreground">SLA Playground</span>
        <span className="hidden text-sm text-muted-foreground sm:inline">for Oakestra</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {model && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" tabIndex={0} className="hidden max-w-48 gap-1.5 md:inline-flex">
                <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span className="sr-only">Model: </span>
                <span className="truncate">{model}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Model the server generates with</TooltipContent>
          </Tooltip>
        )}
        <HistoryPopover />
        <SettingsPopover />
        <Button variant="outline" size="sm" onClick={onNewSession}>
          New session
        </Button>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start over?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears the conversation and the current draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={newSession}>Start over</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
