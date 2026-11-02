import { Button } from "@oakestra/ui";
import type { ComponentType, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ActionButtonProps {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: ReactNode;
  /** Set when the action can't run right now; disables the button and explains why. */
  disabledReason?: string | null;
  onClick: () => void;
}

/** The host's primary button in the playground toolbar, next to New session. */
export function ActionButton({ icon: Icon, children, disabledReason, onClick }: ActionButtonProps) {
  const button = (
    <Button size="sm" className="slagen:ml-1" disabled={!!disabledReason} onClick={onClick}>
      <Icon aria-hidden />
      <span className="slagen:max-w-56 slagen:truncate">{children}</span>
    </Button>
  );
  if (!disabledReason) return button;
  // A disabled button gets no pointer or focus events, so the tooltip hangs on a wrapper. The
  // Tooltip is the playground's own, which already has a provider around the toolbar.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} aria-label={disabledReason} className="slagen:inline-flex slagen:rounded-md">
          {button}
        </span>
      </TooltipTrigger>
      <TooltipContent className="slagen:max-w-72">{disabledReason}</TooltipContent>
    </Tooltip>
  );
}
