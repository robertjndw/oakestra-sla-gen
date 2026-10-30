import type { ComponentType, Ref } from "react";
import { CopyIcon, DownloadIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { copySla, downloadSla } from "@/lib/file-actions";
import { plural } from "@/lib/format";
import type { ValidationResult } from "@/hooks/use-validation";
import { DraftPicker } from "./draft-picker";
import type { DraftRound } from "./draft-view";
import { isOutputMode, titleFor } from "./output-mode";
import type { OutputMode } from "./output-mode";

export interface HeaderProps {
  /** The text on screen: the working copy, or the older draft being viewed. */
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
  drafts: DraftRound[];
  /** An older draft shown instead of the working copy. */
  viewedDraft: number | null;
  onViewDraft: (draft: number) => void;
  pickerRef?: Ref<HTMLButtonElement>;
}

// The underline sits on the header's bottom border, so the triggers fill the full header height.
const TAB_CLASS =
  "h-full flex-none rounded-none px-3 group-data-horizontal/tabs:after:bottom-[-1px] group-data-[variant=line]/tabs-list:data-active:after:bg-primary";

type BadgeVariant = "default" | "success" | "warning" | "danger";

function badgeFor(p: Pick<HeaderProps, "validation" | "accepted" | "edited" | "viewedDraft">): {
  label: string;
  variant: BadgeVariant;
} {
  // Every model draft passed when it arrived; the live validation belongs to the working copy.
  if (p.viewedDraft) return { label: "Passed validation", variant: "success" };
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
  const { text, validation, mode, onModeChange, drafts, viewedDraft } = props;
  const hasText = text.trim() !== "";
  const badge = badgeFor(props);
  const title = titleFor(props);

  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 border-b bg-card pl-4 pr-2">
      <div className="flex min-w-0 items-center gap-2 py-2">
        <h2 className="text-sm font-semibold">
          {drafts.length > 1 ? (
            <DraftPicker
              title={title}
              drafts={drafts}
              shown={viewedDraft ?? props.draftCount}
              edited={props.edited}
              onSelect={props.onViewDraft}
              triggerRef={props.pickerRef}
            />
          ) : (
            title
          )}
        </h2>
        {hasText && (
          <Badge
            variant={badge.variant}
            aria-live="polite"
            data-status={viewedDraft ? "valid" : validation.status}
          >
            {badge.label}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2 self-stretch">
        <Tabs value={mode} onValueChange={(v) => isOutputMode(v) && onModeChange(v)} className="self-stretch">
          <TabsList variant="line" aria-label="View" className="h-full! gap-0 p-0">
            <TabsTrigger value="visual" className={TAB_CLASS}>
              Visual
            </TabsTrigger>
            <TabsTrigger value="code" className={TAB_CLASS}>
              Code
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Separator orientation="vertical" className="my-3" />
        <div className="flex items-center">
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
