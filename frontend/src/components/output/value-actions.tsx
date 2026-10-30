import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { copyWithToast } from "@/lib/file-actions";

// Tailwind only sees whole class names, so each hover group gets its own spelled-out set.
const REVEAL_ON = {
  row: "group-hover/row:opacity-100 group-focus-within/row:opacity-100",
  env: "group-hover/env:opacity-100 group-focus-within/env:opacity-100",
};

const ICON_BUTTON = "-my-1 size-5 align-middle text-muted-foreground hover:text-foreground";

/**
 * Copies `value` and confirms with a toast. Hidden until its row is hovered or holds focus, but
 * always in the tab order, and always visible on touch screens, which have no hover.
 */
export function CopyButton({ value, what, group = "row" }: { value: string; what: string; group?: "row" | "env" }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={`Copy ${what}`}
      className={`${ICON_BUTTON} ml-1 opacity-0 focus-visible:opacity-100 pointer-coarse:opacity-100 ${REVEAL_ON[group]}`}
      onClick={async () => {
        if (await copyWithToast(value, what)) setCopied(true);
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}

export function RevealButton({ revealed, what, onToggle }: { revealed: boolean; what: string; onToggle: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={`${revealed ? "Hide" : "Show"} ${what}`}
      className={`${ICON_BUTTON} ml-1`}
      onClick={onToggle}
    >
      {revealed ? <EyeOffIcon /> : <EyeIcon />}
    </Button>
  );
}

/** Stands in for a hidden value. Always the same length, so it doesn't give the real one away. */
export function Masked() {
  return (
    <>
      <span aria-hidden className="tracking-widest select-none">
        ••••••••
      </span>
      <span className="sr-only">hidden</span>
    </>
  );
}
