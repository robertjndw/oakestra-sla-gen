import { ScrollArea } from "@/components/ui/scroll-area";
import type { ProblemItem } from "./problems";

interface Props {
  items: ProblemItem[];
  onSelect: (line: number) => void;
}

export function ProblemsList({ items, onSelect }: Props) {
  if (!items.length) return null;
  return (
    <ScrollArea className="max-h-44 shrink-0 border-t">
      <ul aria-label="Problems" className="divide-y">
        {items.map((item, i) => (
          <li key={i}>
            <button
              type="button"
              disabled={!item.line}
              onClick={() => item.line && onSelect(item.line)}
              className="flex w-full items-baseline gap-3 px-4 py-2 text-left text-sm hover:bg-rust-soft focus-visible:bg-rust-soft focus-visible:outline-none enabled:cursor-pointer disabled:cursor-default"
            >
              <span className="w-14 shrink-0 font-mono text-xs text-rust">
                {item.line ? "Line " + item.line : "JSON"}
              </span>
              <span className="min-w-0">
                {item.message}
                {item.path && (
                  <span className="mt-0.5 block font-mono text-xs break-all text-muted-foreground">
                    {item.path}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}
