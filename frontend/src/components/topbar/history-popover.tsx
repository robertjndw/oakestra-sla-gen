import { useMemo, useState } from "react";
import { CopyIcon, DownloadIcon, HistoryIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSessionContext } from "@/hooks/session-context";
import { clearHistory, removeFromHistory, useHistoryEntries } from "@/hooks/use-history";
import { copyText, downloadText } from "@/lib/file-actions";
import { plural } from "@/lib/format";
import type { HistoryEntry } from "@/lib/history";
import { services } from "@/lib/sla";
import type { Sla } from "@/lib/types";

const savedAtLabel = (ts: number) =>
  new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function metaLine(entry: HistoryEntry, current: boolean): string {
  let count: number | null = null;
  try {
    count = services(JSON.parse(entry.sla) as Sla).length;
  } catch {
    // Entries are checked to parse before they're saved, but another tab or an old build may
    // have written this one. Just leave the count out.
  }
  return [
    current ? "Current session" : null,
    count === null ? null : plural(count, "service"),
    entry.accepted ? "Accepted" : null,
    savedAtLabel(entry.savedAt),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function HistoryPopover() {
  const entries = useHistoryEntries();
  const { state, hasUnacceptedWork, openFromHistory } = useSessionContext();
  const [open, setOpen] = useState(false);
  const [confirmEntry, setConfirmEntry] = useState<HistoryEntry | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const rows = useMemo(
    () => entries.map((e) => ({ entry: e, meta: metaLine(e, e.id === state.sessionId) })),
    [entries, state.sessionId],
  );

  const pick = (entry: HistoryEntry) => {
    setOpen(false);
    if (entry.id === state.sessionId) return;
    if (hasUnacceptedWork) setConfirmEntry(entry);
    else openFromHistory(entry);
  };

  const copy = async (entry: HistoryEntry) => {
    if (await copyText(entry.sla)) toast.success("Copied the SLA JSON");
    else toast.error("Could not copy the SLA JSON");
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5" aria-label="History">
            <HistoryIcon className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="hidden sm:inline">History</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(26rem,calc(100vw-2rem))] gap-2 p-2">
          <div className="flex items-center justify-between gap-2 px-2 pt-1">
            <h2 className="font-medium">History</h2>
            {entries.length > 0 && (
              <Button type="button" variant="ghost" size="xs" onClick={() => setConfirmClear(true)}>
                Clear all
              </Button>
            )}
          </div>
          {entries.length === 0 ? (
            <p className="px-2 pb-2 text-muted-foreground">
              No saved SLAs yet. The latest draft of every session is kept here.
            </p>
          ) : (
            <ul aria-label="Saved SLAs" className="-mx-0.5 flex max-h-80 flex-col overflow-y-auto px-0.5">
              {rows.map(({ entry, meta }) => (
                <li key={entry.id} className="flex items-center gap-1 rounded-md hover:bg-muted">
                  <button
                    type="button"
                    className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    onClick={() => pick(entry)}
                  >
                    <span className="block truncate font-medium">{entry.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{meta}</span>
                  </button>
                  <div className="flex shrink-0 items-center pr-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Copy ${entry.title}`}
                      onClick={() => void copy(entry)}
                    >
                      <CopyIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Download ${entry.title}`}
                      onClick={() => downloadText(entry.sla, "sla.json")}
                    >
                      <DownloadIcon />
                    </Button>
                    {/* No point deleting the current session's entry, its next change would save it again. */}
                    {entry.id !== state.sessionId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${entry.title}`}
                        onClick={() => removeFromHistory(entry.id)}
                      >
                        <Trash2Icon />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t px-2 pt-2 pb-1 text-xs text-muted-foreground">
            Saved in this browser only, including any secrets in the SLAs.
          </p>
        </PopoverContent>
      </Popover>

      <AlertDialog open={confirmEntry !== null} onOpenChange={(o) => !o && setConfirmEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Open this SLA?</AlertDialogTitle>
            <AlertDialogDescription>
              {state.modelSla
                ? "This ends the current conversation. Its latest draft stays in the history."
                : "This clears the current conversation."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmEntry && openFromHistory(confirmEntry)}>Open</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear the history?</AlertDialogTitle>
            <AlertDialogDescription>
              {`This deletes ${plural(entries.length, "saved SLA")} from this browser. It can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={clearHistory}>Clear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
