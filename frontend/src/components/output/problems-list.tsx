import { ScrollArea } from "@/components/ui/scroll-area";
import type { ProblemItem } from "./problems";

interface Props {
  items: ProblemItem[];
  onSelect: (line: number) => void;
}

export function ProblemsList({ items, onSelect }: Props) {
  if (!items.length) return null;
  return (
    <ScrollArea className="slagen:max-h-44 slagen:shrink-0 slagen:border-t">
      <ul aria-label="Problems" className="slagen:divide-y">
        {items.map((item, i) => (
          <li key={i}>
            <button
              type="button"
              disabled={!item.line}
              onClick={() => item.line && onSelect(item.line)}
              className="slagen:flex slagen:w-full slagen:items-baseline slagen:gap-3 slagen:px-4 slagen:py-2 slagen:text-left slagen:text-sm slagen:hover:bg-rust-soft slagen:focus-visible:bg-rust-soft slagen:focus-visible:outline-none slagen:enabled:cursor-pointer slagen:disabled:cursor-default"
            >
              <span className="slagen:w-14 slagen:shrink-0 slagen:font-mono slagen:text-xs slagen:text-rust">
                {item.line ? "Line " + item.line : "JSON"}
              </span>
              <span className="slagen:min-w-0">
                {item.message}
                {item.path && (
                  <span className="slagen:mt-0.5 slagen:block slagen:font-mono slagen:text-xs slagen:break-all slagen:text-muted-foreground">
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
