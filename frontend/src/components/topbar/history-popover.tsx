import { useMemo, useState } from "react";
import { CopyIcon, DownloadIcon, HistoryIcon, Trash2Icon } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSessionContext } from "@/hooks/session-context";
import { useHost } from "@/host/host-context";
import { clearHistory, removeFromHistory, useHistoryEntries } from "@/hooks/use-history";
import { copySla, downloadSla } from "@/lib/file-actions";
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
  const { notify, storageKey } = useHost();
  const historyKey = storageKey("history");
  const entries = useHistoryEntries(historyKey);
  const { state, hasUnacceptedWork, openFromHistory } = useSessionContext();
  const [open, setOpen] = useState(false);
  const [confirmEntry, setConfirmEntry] = useState<HistoryEntry | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  // metaLine parses every saved SLA and the history changes on every save, so only do it
  // while the list is actually visible.
  const rows = useMemo(
    () => (open ? entries.map((e) => ({ entry: e, meta: metaLine(e, e.id === state.sessionId) })) : []),
    [open, entries, state.sessionId],
  );

  const pick = (entry: HistoryEntry) => {
    setOpen(false);
    if (entry.id === state.sessionId) return;
    if (hasUnacceptedWork) setConfirmEntry(entry);
    else openFromHistory(entry);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="slagen:gap-1.5" aria-label="History">
            <HistoryIcon className="slagen:size-3.5 slagen:text-muted-foreground" aria-hidden />
            <span className="slagen:hidden slagen:sm:inline">History</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="slagen:w-[min(26rem,calc(100vw-2rem))] slagen:gap-2 slagen:p-2">
          <div className="slagen:flex slagen:items-center slagen:justify-between slagen:gap-2 slagen:px-2 slagen:pt-1">
            <h2 className="slagen:font-medium">History</h2>
            {entries.length > 0 && (
              <Button type="button" variant="ghost" size="xs" onClick={() => setConfirmClear(true)}>
                Clear all
              </Button>
            )}
          </div>
          {entries.length === 0 ? (
            <p className="slagen:px-2 slagen:pb-2 slagen:text-muted-foreground">
              No saved SLAs yet. The latest draft of every session is kept here.
            </p>
          ) : (
            <ul aria-label="Saved SLAs" className="slagen:-mx-0.5 slagen:flex slagen:max-h-80 slagen:flex-col slagen:overflow-y-auto slagen:px-0.5">
              {rows.map(({ entry, meta }) => (
                <li key={entry.id} className="slagen:flex slagen:items-center slagen:gap-1 slagen:rounded-md slagen:hover:bg-muted">
                  <button
                    type="button"
                    className="slagen:min-w-0 slagen:flex-1 slagen:rounded-md slagen:px-2 slagen:py-1.5 slagen:text-left slagen:focus-visible:ring-2 slagen:focus-visible:ring-ring slagen:focus-visible:outline-none"
                    onClick={() => pick(entry)}
                  >
                    <span className="slagen:block slagen:truncate slagen:font-medium">{entry.title}</span>
                    <span className="slagen:block slagen:truncate slagen:text-xs slagen:text-muted-foreground">{meta}</span>
                  </button>
                  <div className="slagen:flex slagen:shrink-0 slagen:items-center slagen:pr-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Copy ${entry.title}`}
                      onClick={() => void copySla(entry.sla, notify)}
                    >
                      <CopyIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Download ${entry.title}`}
                      onClick={() => downloadSla(entry.sla)}
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
                        onClick={() => removeFromHistory(entry.id, historyKey)}
                      >
                        <Trash2Icon />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="slagen:border-t slagen:px-2 slagen:pt-2 slagen:pb-1 slagen:text-xs slagen:text-muted-foreground">
            Saved in this browser only, including any secrets in the SLAs.
          </p>
        </PopoverContent>
      </Popover>

      <ConfirmDialog
        open={confirmEntry !== null}
        onOpenChange={(o) => !o && setConfirmEntry(null)}
        title="Open this SLA?"
        description={
          state.modelSla
            ? "This ends the current conversation. Its latest draft stays in the history."
            : "This clears the current conversation."
        }
        actionLabel="Open"
        onConfirm={() => confirmEntry && openFromHistory(confirmEntry)}
      />

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear the history?"
        description={`This deletes ${plural(entries.length, "saved SLA")} from this browser. It can't be undone.`}
        actionLabel="Clear"
        onConfirm={() => clearHistory(historyKey)}
      />
    </>
  );
}
