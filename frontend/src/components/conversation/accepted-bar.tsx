import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle2Icon } from "lucide-react";
import { copyText, downloadText } from "@/lib/file-actions";

export function AcceptedBar({
  draft,
  sla,
  onKeepRefining,
}: {
  draft: number;
  sla: string;
  onKeepRefining: () => void;
}) {
  const copy = async () => {
    if (await copyText(sla)) toast.success("Copied the SLA JSON");
    else toast.error("Could not copy the SLA JSON");
  };
  return (
    <Alert>
      <CheckCircle2Icon className="text-primary" />
      <AlertTitle>{`Draft ${draft} is accepted.`}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>Download it or copy the JSON.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" autoFocus onClick={() => downloadText(sla, "sla.json")}>
            Download sla.json
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={copy}>
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
