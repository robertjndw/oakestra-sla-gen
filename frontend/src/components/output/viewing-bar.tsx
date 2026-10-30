import { HistoryIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  draft: number;
  latest: number;
  onRestore: () => void;
  onBack: () => void;
}

export function ViewingBar({ draft, latest, onRestore, onBack }: Props) {
  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b bg-amber-soft px-4 py-2 text-sm"
    >
      <p className="flex min-w-0 items-center gap-2">
        <HistoryIcon className="size-4 shrink-0 text-amber" aria-hidden />
        <span>
          <span className="font-medium">{`Viewing draft ${draft}`}</span>
          <span className="text-muted-foreground">{` of ${latest}. Read-only.`}</span>
        </span>
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onRestore}>
          Restore this draft
        </Button>
        <Button type="button" size="sm" onClick={onBack}>
          Back to latest
        </Button>
      </div>
    </div>
  );
}
