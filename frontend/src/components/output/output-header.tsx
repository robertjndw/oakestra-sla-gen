import { CopyIcon, DownloadIcon } from "lucide-react";
import {
  ArtifactAction,
  ArtifactActions,
  ArtifactHeader,
  ArtifactTitle,
} from "@/components/ai-elements/artifact";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { copySla, downloadSla } from "@/lib/file-actions";
import { plural } from "@/lib/format";
import type { ValidationResult } from "@/hooks/use-validation";
import { isOutputMode, titleFor } from "./output-mode";
import type { OutputMode } from "./output-mode";

export interface HeaderProps {
  text: string;
  hasSla: boolean;
  draftCount: number;
  edited: boolean;
  /** The editor holds an SLA reopened from the history and the model hasn't drafted yet. */
  fromHistory: boolean;
  accepted: boolean;
  validation: ValidationResult;
  mode: OutputMode;
  onModeChange: (mode: OutputMode) => void;
}

type BadgeVariant = "default" | "success" | "warning" | "danger";

function badgeFor(p: Pick<HeaderProps, "validation" | "accepted" | "edited">): { label: string; variant: BadgeVariant } {
  const { status, errors } = p.validation;
  if (status === "parse-error") return { label: "Invalid JSON", variant: "danger" };
  if (status === "invalid") return { label: plural(errors.length, "problem"), variant: "danger" };
  if (status === "checking") return { label: "Checking", variant: "warning" };
  if (p.accepted && !p.edited) return { label: "Accepted", variant: "default" };
  return { label: p.edited ? "Valid" : "Passed validation", variant: "success" };
}

export function OutputHeader(props: HeaderProps) {
  const { text, validation, mode, onModeChange } = props;
  const hasText = text.trim() !== "";
  const badge = badgeFor(props);

  return (
    <ArtifactHeader className="flex-wrap gap-y-2">
      <div className="flex min-w-0 items-center gap-2">
        <ArtifactTitle className="text-base font-semibold" role="heading" aria-level={2}>
          {titleFor(props)}
        </ArtifactTitle>
        {hasText && (
          <Badge variant={badge.variant} aria-live="polite" data-status={validation.status}>
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
          <ArtifactAction tooltip="Copy" label="Copy the SLA" icon={CopyIcon} disabled={!hasText} onClick={() => void copySla(text)} />
          <ArtifactAction
            tooltip="Download sla.json"
            label="Download sla.json"
            icon={DownloadIcon}
            disabled={!hasText}
            onClick={() => downloadSla(text)}
          />
        </ArtifactActions>
      </div>
    </ArtifactHeader>
  );
}
