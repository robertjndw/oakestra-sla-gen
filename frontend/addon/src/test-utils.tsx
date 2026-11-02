import type { ReactNode } from "react";
import { useLocation } from "react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { PlaygroundActionsProps } from "@/host/host-context";

/** The playground renders host actions inside its own TooltipProvider. */
export function InToolbar({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      {children}
      <Location />
    </TooltipProvider>
  );
}

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

export const actionProps = (sla: unknown, overrides: Partial<PlaygroundActionsProps> = {}): PlaygroundActionsProps => ({
  sla: typeof sla === "string" ? sla : JSON.stringify(sla),
  title: "Draft",
  validation: { status: "valid", errors: [] },
  accepted: false,
  turnRunning: false,
  ...overrides,
});
