import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-card px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <Logo className="shrink-0 text-primary" />
        <span className="hidden text-sm text-muted-foreground sm:inline">Oakestra</span>
        <span aria-hidden className="hidden text-sm text-border sm:inline">
          /
        </span>
        <span className="truncate text-sm font-semibold whitespace-nowrap">SLA Playground</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {model && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                className="mr-2 hidden max-w-64 items-baseline gap-2 rounded-sm text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:inline-flex"
              >
                <span className="text-muted-foreground">Model</span>
                <span className="truncate font-mono">{model}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>Model the server generates with</TooltipContent>
          </Tooltip>
        )}
        {model && <Separator orientation="vertical" className="mr-1 hidden h-5! lg:block" />}
        <HistoryPopover />
        <SettingsPopover />
        <Button variant="outline" size="sm" className="ml-1" aria-label="New session" onClick={onNewSession}>
          <PlusIcon aria-hidden />
          <span className="hidden sm:inline">New session</span>
        </Button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Start over?"
        description="This clears the conversation and the current draft."
        actionLabel="Start over"
        onConfirm={newSession}
      />
    </header>
  );
}
