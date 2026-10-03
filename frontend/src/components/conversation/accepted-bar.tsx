import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle2Icon } from "lucide-react";
import { copySla, downloadSla } from "@/lib/file-actions";

export function AcceptedBar({
  draft,
  sla,
  onKeepRefining,
}: {
  draft: number;
  sla: string;
  onKeepRefining: () => void;
}) {
  return (
    <Alert>
      <CheckCircle2Icon className="text-primary" />
      <AlertTitle>{`Draft ${draft} is accepted.`}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>Download it or copy the JSON.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" autoFocus onClick={() => downloadSla(sla)}>
            Download sla.json
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void copySla(sla)}>
            Copy JSON
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onKeepRefining}>
            Keep refining
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
