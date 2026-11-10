import type { Ref } from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { Button } from "@/components/ui/button";
import type { DraftRound } from "./draft-view";

interface Props {
  title: string;
  drafts: DraftRound[];
  /** Draft on screen; the latest one stands for the working copy. */
  shown: number;
  /** The working copy has hand edits. */
  edited: boolean;
  onSelect: (draft: number) => void;
  triggerRef?: Ref<HTMLButtonElement>;
}

function metaFor(d: DraftRound, latest: boolean, edited: boolean): string {
  if (latest) return edited ? "Latest, with your edits" : "Latest";
  return d.changes[0] ?? "";
}

export function DraftPicker({ title, drafts, shown, edited, onSelect, triggerRef }: Props) {
  const latest = drafts[drafts.length - 1]?.draft;
  const newestFirst = [...drafts].reverse();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button ref={triggerRef} type="button" variant="ghost" size="sm" className="slagen:-ml-2 slagen:h-7 slagen:gap-1 slagen:px-2 slagen:font-semibold">
          {title}
          <span className="slagen:sr-only">, choose a draft to view</span>
          <ChevronDownIcon className="slagen:size-3.5 slagen:text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="slagen:z-50 slagen:max-h-80 slagen:w-72 slagen:overflow-y-auto slagen:rounded-md slagen:bg-popover slagen:p-1 slagen:text-sm slagen:shadow-md slagen:ring-1 slagen:ring-foreground/10 slagen:text-popover-foreground slagen:outline-none slagen:data-[state=open]:animate-in slagen:data-[state=open]:fade-in-0 slagen:data-[state=closed]:animate-out slagen:data-[state=closed]:fade-out-0"
        >
          <DropdownMenu.RadioGroup value={String(shown)} onValueChange={(v) => onSelect(Number(v))}>
            {newestFirst.map((d) => {
              const meta = metaFor(d, d.draft === latest, edited);
              return (
                <DropdownMenu.RadioItem
                  key={d.id}
                  value={String(d.draft)}
                  className="slagen:relative slagen:flex slagen:cursor-pointer slagen:flex-col slagen:gap-0.5 slagen:rounded-sm slagen:py-1.5 slagen:pr-2 slagen:pl-7 slagen:outline-none slagen:select-none slagen:data-highlighted:bg-muted"
                >
                  <DropdownMenu.ItemIndicator className="slagen:absolute slagen:top-2 slagen:left-2 slagen:flex">
                    <CheckIcon className="slagen:size-3.5 slagen:text-primary" aria-hidden />
                  </DropdownMenu.ItemIndicator>
                  <span className="slagen:font-medium">{`Draft ${d.draft}`}</span>
                  {meta && <span className="slagen:truncate slagen:text-xs slagen:text-muted-foreground">{meta}</span>}
                </DropdownMenu.RadioItem>
              );
            })}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
