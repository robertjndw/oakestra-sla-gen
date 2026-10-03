import { CopyIcon, DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import {
  ArtifactAction,
  ArtifactActions,
  ArtifactHeader,
  ArtifactTitle,
} from "@/components/ai-elements/artifact";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { copyText, downloadText } from "@/lib/file-actions";
import { plural } from "@/lib/format";
import type { ValidationResult } from "@/hooks/use-validation";
import { isOutputMode, titleFor } from "./output-mode";
import type { OutputMode } from "./output-mode";

export interface HeaderProps {
  text: string;
  hasSla: boolean;
  draftCount: number;
  edited: boolean;
  accepted: boolean;
  validation: ValidationResult;
  mode: OutputMode;
  onModeChange: (mode: OutputMode) => void;
}

function badgeFor(p: Pick<HeaderProps, "validation" | "accepted" | "edited">): { label: string; className: string } {
  const { status, errors } = p.validation;
  if (status === "parse-error") return { label: "Invalid JSON", className: "bg-rust-soft text-rust" };
  if (status === "invalid") return { label: plural(errors.length, "problem"), className: "bg-rust-soft text-rust" };
  if (status === "checking") return { label: "Checking", className: "bg-amber-soft text-amber" };
  if (p.accepted && !p.edited) return { label: "Accepted", className: "bg-primary text-primary-foreground" };
  return { label: p.edited ? "Valid" : "Passed validation", className: "bg-accent text-accent-foreground" };
}

export function OutputHeader(props: HeaderProps) {
  const { text, validation, mode, onModeChange } = props;
  const hasText = text.trim() !== "";
  const badge = badgeFor(props);

  async function copy() {
    if (await copyText(text)) toast.success("Copied the SLA to the clipboard");
    else toast.error("Could not copy the SLA");
  }

  return (
    <ArtifactHeader className="flex-wrap gap-y-2">
      <div className="flex min-w-0 items-center gap-2">
        <ArtifactTitle className="text-base font-semibold" role="heading" aria-level={2}>
          {titleFor(props)}
        </ArtifactTitle>
        {hasText && (
          <Badge className={badge.className} aria-live="polite" data-status={validation.status}>
            {badge.label}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Tabs value={mode} onValueChange={(v) => isOutputMode(v) && onModeChange(v)}>
          <TabsList aria-label="View">
            <TabsTrigger value="visual">Visual</TabsTrigger>
            <TabsTrigger value="code">Code</TabsTrigger>
          </TabsList>
        </Tabs>
        <ArtifactActions>
          <ArtifactAction tooltip="Copy" label="Copy the SLA" icon={CopyIcon} disabled={!hasText} onClick={copy} />
          <ArtifactAction
            tooltip="Download sla.json"
            label="Download sla.json"
            icon={DownloadIcon}
            disabled={!hasText}
            onClick={() => downloadText(text, "sla.json")}
          />
        </ArtifactActions>
      </div>
    </ArtifactHeader>
  );
}
