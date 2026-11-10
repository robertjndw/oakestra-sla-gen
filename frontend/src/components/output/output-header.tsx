import type { ComponentType, Ref } from "react";
import { CopyIcon, DownloadIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHost } from "@/host/host-context";
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
  "slagen:h-full slagen:flex-none slagen:rounded-none slagen:px-3 slagen:group-data-horizontal/tabs:after:bottom-[-1px] slagen:group-data-[variant=line]/tabs-list:data-active:after:bg-primary";

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
          className="slagen:text-muted-foreground slagen:hover:text-foreground"
          disabled={disabled}
          onClick={onClick}
        >
          <Icon className="slagen:size-4" />
          <span className="slagen:sr-only">{label}</span>
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
  const { notify } = useHost();
  const hasText = text.trim() !== "";
  const badge = badgeFor(props);
  const title = titleFor(props);

  return (
    <div className="slagen:flex slagen:min-h-11 slagen:flex-wrap slagen:items-center slagen:justify-between slagen:gap-x-4 slagen:border-b slagen:bg-card slagen:pl-4 slagen:pr-2">
      <div className="slagen:flex slagen:min-w-0 slagen:items-center slagen:gap-2 slagen:py-2">
        <h2 className="slagen:text-sm slagen:font-semibold">
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
      <div className="slagen:flex slagen:items-center slagen:gap-2 slagen:self-stretch">
        <Tabs value={mode} onValueChange={(v) => isOutputMode(v) && onModeChange(v)} className="slagen:self-stretch">
          <TabsList variant="line" aria-label="View" className="slagen:h-full! slagen:gap-0 slagen:p-0">
            <TabsTrigger value="visual" className={TAB_CLASS}>
              Visual
            </TabsTrigger>
            <TabsTrigger value="code" className={TAB_CLASS}>
              Code
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Separator orientation="vertical" className="slagen:my-3" />
        <div className="slagen:flex slagen:items-center">
          <HeaderAction tooltip="Copy" label="Copy the SLA" icon={CopyIcon} disabled={!hasText} onClick={() => void copySla(text, notify)} />
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
