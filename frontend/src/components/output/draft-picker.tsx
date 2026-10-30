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
        <Button ref={triggerRef} type="button" variant="ghost" size="sm" className="-ml-2 h-7 gap-1 px-2 font-semibold">
          {title}
          <span className="sr-only">, choose a draft to view</span>
          <ChevronDownIcon className="size-3.5 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-50 max-h-80 w-72 overflow-y-auto rounded-md bg-popover p-1 text-sm shadow-md ring-1 ring-foreground/10 text-popover-foreground outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        >
          <DropdownMenu.RadioGroup value={String(shown)} onValueChange={(v) => onSelect(Number(v))}>
            {newestFirst.map((d) => {
              const meta = metaFor(d, d.draft === latest, edited);
              return (
                <DropdownMenu.RadioItem
                  key={d.id}
                  value={String(d.draft)}
                  className="relative flex cursor-pointer flex-col gap-0.5 rounded-sm py-1.5 pr-2 pl-7 outline-none select-none data-highlighted:bg-muted"
                >
                  <DropdownMenu.ItemIndicator className="absolute top-2 left-2 flex">
                    <CheckIcon className="size-3.5 text-primary" aria-hidden />
                  </DropdownMenu.ItemIndicator>
                  <span className="font-medium">{`Draft ${d.draft}`}</span>
                  {meta && <span className="truncate text-xs text-muted-foreground">{meta}</span>}
                </DropdownMenu.RadioItem>
              );
            })}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
