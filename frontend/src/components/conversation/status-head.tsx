import { CheckCircle2Icon, CircleHelpIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Status = "ok" | "ask";

const ICONS = { ok: CheckCircle2Icon, ask: CircleHelpIcon } as const;
const COLORS = { ok: "slagen:text-primary", ask: "slagen:text-amber-dot" } as const;
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
    <div className="slagen:flex slagen:flex-wrap slagen:items-center slagen:gap-x-2 slagen:gap-y-0.5">
      <Icon className={cn("slagen:size-4 slagen:shrink-0", COLORS[status])} aria-label={LABELS[status]} role="img" />
      {onTitleClick ? (
        <button
          type="button"
          aria-label={titleLabel}
          aria-current={current || undefined}
          onClick={onTitleClick}
          className="slagen:cursor-pointer slagen:rounded-sm slagen:font-medium slagen:underline slagen:decoration-border slagen:underline-offset-4 slagen:outline-none slagen:hover:decoration-foreground slagen:focus-visible:ring-2 slagen:focus-visible:ring-ring slagen:focus-visible:ring-offset-2 slagen:focus-visible:ring-offset-background"
        >
          {title}
        </button>
      ) : (
        <span className="slagen:font-medium">{title}</span>
      )}
      {viewing && <Badge variant="warning">Viewing</Badge>}
      {meta && <span className="slagen:text-muted-foreground slagen:text-xs">{meta}</span>}
    </div>
  );
}
