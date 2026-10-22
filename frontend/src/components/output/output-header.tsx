import type { ComponentType } from "react";
import { CopyIcon, DownloadIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

function HeaderAction({
  tooltip,
  label,
  icon: Icon,
  disabled,
  onClick,
}: {
  tooltip: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          disabled={disabled}
          onClick={onClick}
        >
          <Icon className="size-4" />
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function OutputHeader(props: HeaderProps) {
  const { text, validation, mode, onModeChange } = props;
  const hasText = text.trim() !== "";
  const badge = badgeFor(props);

  return (
    <div className="flex flex-wrap items-center justify-between gap-y-2 border-b bg-muted/50 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="text-base font-semibold">{titleFor(props)}</h2>
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
        <div className="flex items-center gap-1">
          <HeaderAction tooltip="Copy" label="Copy the SLA" icon={CopyIcon} disabled={!hasText} onClick={() => void copySla(text)} />
          <HeaderAction
            tooltip="Download sla.json"
            label="Download sla.json"
            icon={DownloadIcon}
            disabled={!hasText}
            onClick={() => downloadSla(text)}
          />
        </div>
      </div>
    </div>
  );
}
