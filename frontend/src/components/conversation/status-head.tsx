import { CheckCircle2Icon, CircleHelpIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Status = "ok" | "ask";

const ICONS = { ok: CheckCircle2Icon, ask: CircleHelpIcon } as const;
const COLORS = { ok: "text-primary", ask: "text-amber-dot" } as const;
const LABELS = { ok: "Passed", ask: "Needs input" } as const;

export function StatusHead({ status, title, meta }: { status: Status; title: string; meta?: string }) {
  const Icon = ICONS[status];
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <Icon className={cn("size-4 shrink-0", COLORS[status])} aria-label={LABELS[status]} role="img" />
      <span className="font-medium">{title}</span>
      {meta && <span className="text-muted-foreground text-xs">{meta}</span>}
    </div>
  );
}
