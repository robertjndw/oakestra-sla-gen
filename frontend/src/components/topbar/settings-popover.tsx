import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useSessionContext } from "@/hooks/session-context";
import { MAX_RETRIES, MIN_RETRIES, OUTPUT_METHODS } from "@/lib/constants";
import { plural } from "@/lib/format";
import type { OutputMethod } from "@/lib/types";

const clampRetries = (n: number) => Math.max(MIN_RETRIES, Math.min(MAX_RETRIES, n));

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
          Settings
          <span className="hidden text-muted-foreground sm:inline">
            {settings.method}, {plural(settings.maxRetries, "attempt")}
          </span>
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="setting-method">Output method</Label>
          <Select
            value={settings.method}
            disabled={settingsLocked}
            onValueChange={(v) => setSettings({ ...settings, method: v as OutputMethod })}
          >
            <SelectTrigger id="setting-method" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OUTPUT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="setting-retries">Attempts per round</Label>
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
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="setting-customer">Customer ID</Label>
          <Input
            id="setting-customer"
            type="text"
            value={settings.customerId}
            placeholder="Admin, or the uploaded SLA's own"
            disabled={settingsLocked}
            onChange={(e) => setSettings({ ...settings, customerId: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="setting-images"
            checked={settings.checkImages}
            disabled={settingsLocked}
            onCheckedChange={(checked) => setSettings({ ...settings, checkImages: checked })}
          />
          <Label htmlFor="setting-images">Check that images exist</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Each round retries until the SLA passes validation or runs out of attempts.
        </p>
        {settingsLocked && (
          <p className="rounded-md bg-amber-soft px-2.5 py-1.5 text-xs text-amber">
            These are fixed for the current session. Start a new session to change them.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
