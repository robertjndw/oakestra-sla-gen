import { ChevronDownIcon, CircleHelpIcon, LockIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSessionContext } from "@/hooks/session-context";
import { MAX_RETRIES, MIN_RETRIES } from "@/lib/constants";
import { plural } from "@/lib/format";

const clampRetries = (n: number) => Math.max(MIN_RETRIES, Math.min(MAX_RETRIES, n));

// Sits next to the label rather than inside it, so it stays readable and clickable when the
// field is locked and the label is dimmed.
function LabelWithHelp({ htmlFor, label, children }: { htmlFor: string; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`About ${label}`}
            className="rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <CircleHelpIcon className="size-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-72">
          {children}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function SettingsPopover() {
  const { state, settingsLocked, setSettings } = useSessionContext();
  const { settings } = state;
  // Kept as text while typing so the field can be empty; clamped when it loses focus.
  const [retriesText, setRetriesText] = useState(String(settings.maxRetries));

  const commitRetries = () => {
    const parsed = parseInt(retriesText, 10);
    const next = clampRetries(Number.isFinite(parsed) ? parsed : settings.maxRetries);
    setRetriesText(String(next));
    setSettings({ ...settings, maxRetries: next });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          {settingsLocked && <LockIcon className="size-3.5 text-muted-foreground" aria-label="Locked" />}
          Settings
          <span className="hidden text-muted-foreground sm:inline">
            {plural(settings.maxRetries, "attempt")}
          </span>
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80"
        // By default the first focusable element gets focus on open. That is the first help icon,
        // and focus opens its tooltip as if it were hovered. Focusing the content itself (Radix
        // makes it tabIndex -1) keeps keyboard users inside the popover without that.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        <FieldGroup className="gap-4">
          <Field data-disabled={settingsLocked} className="gap-1.5">
            <LabelWithHelp htmlFor="setting-retries" label="Attempts per round">
              {`How many tries the model gets per message (${MIN_RETRIES} to ${MAX_RETRIES}). When a draft fails validation, the errors go back to the model and it tries again. More attempts help weaker models get there but make a round take longer.`}
            </LabelWithHelp>
            <Input
              id="setting-retries"
              type="number"
              min={MIN_RETRIES}
              max={MAX_RETRIES}
              step={1}
              value={retriesText}
              disabled={settingsLocked}
              onChange={(e) => setRetriesText(e.target.value)}
              onBlur={commitRetries}
            />
          </Field>
          <Field data-disabled={settingsLocked} className="gap-1.5">
            <LabelWithHelp htmlFor="setting-customer" label="Customer ID">
              The Oakestra customer ID written into the SLA&apos;s customerID field. Leave it empty to use Admin,
              or to keep the ID of an uploaded SLA.
            </LabelWithHelp>
            <Input
              id="setting-customer"
              type="text"
              value={settings.customerId}
              placeholder="Admin, or the uploaded SLA's own"
              disabled={settingsLocked}
              onChange={(e) => setSettings({ ...settings, customerId: e.target.value })}
            />
          </Field>
          <Field orientation="horizontal" data-disabled={settingsLocked} className="gap-2">
            <Switch
              id="setting-images"
              checked={settings.checkImages}
              disabled={settingsLocked}
              onCheckedChange={(checked) => setSettings({ ...settings, checkImages: checked })}
            />
            <LabelWithHelp htmlFor="setting-images" label="Check that images exist">
              Looks up every container image in its registry. A missing image the model picked counts as a
              validation error and is retried. One you named yourself is kept but raised as a question, since
              it may be private. Turn it off if the server can&apos;t reach the registries.
            </LabelWithHelp>
          </Field>
        </FieldGroup>
        {settingsLocked && (
          <Alert variant="warning" role="status" className="px-3 py-2">
            <LockIcon />
            <AlertDescription className="text-xs">
              These are fixed for the current session. Start a new session to change them.
            </AlertDescription>
          </Alert>
        )}
      </PopoverContent>
    </Popover>
  );
}
