import { CheckCircle2Icon, CircleHelpIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Status = "ok" | "ask";

const ICONS = { ok: CheckCircle2Icon, ask: CircleHelpIcon } as const;
const COLORS = { ok: "text-primary", ask: "text-amber-dot" } as const;
const LABELS = { ok: "Passed", ask: "Needs input" } as const;

interface Props {
  status: Status;
  title: string;
  meta?: string;
  /** Makes the title a button. */
  onTitleClick?: () => void;
  /** Accessible name of the title button; should contain the title. */
  titleLabel?: string;
  /** The SLA pane shows this round. */
  current?: boolean;
  /** Shown as an older draft rather than the working copy. */
  viewing?: boolean;
}

export function StatusHead({ status, title, meta, onTitleClick, titleLabel, current, viewing }: Props) {
  const Icon = ICONS[status];
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <Icon className={cn("size-4 shrink-0", COLORS[status])} aria-label={LABELS[status]} role="img" />
      {onTitleClick ? (
        <button
          type="button"
          aria-label={titleLabel}
          aria-current={current || undefined}
          onClick={onTitleClick}
          className="cursor-pointer rounded-sm font-medium underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {title}
        </button>
      ) : (
        <span className="font-medium">{title}</span>
      )}
      {viewing && <Badge variant="warning">Viewing</Badge>}
      {meta && <span className="text-muted-foreground text-xs">{meta}</span>}
    </div>
  );
}
