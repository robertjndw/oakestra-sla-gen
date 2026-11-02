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
      className="slagen:flex slagen:shrink-0 slagen:flex-wrap slagen:items-center slagen:justify-between slagen:gap-x-4 slagen:gap-y-2 slagen:border-b slagen:bg-amber-soft slagen:px-4 slagen:py-2 slagen:text-sm"
    >
      <p className="slagen:flex slagen:min-w-0 slagen:items-center slagen:gap-2">
        <HistoryIcon className="slagen:size-4 slagen:shrink-0 slagen:text-amber" aria-hidden />
        <span>
          <span className="slagen:font-medium">{`Viewing draft ${draft}`}</span>
          <span className="slagen:text-muted-foreground">{` of ${latest}. Read-only.`}</span>
        </span>
      </p>
      <div className="slagen:flex slagen:items-center slagen:gap-2">
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
