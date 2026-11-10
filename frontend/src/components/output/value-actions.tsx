import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useHost } from "@/host/host-context";
import { copyWithNotice } from "@/lib/file-actions";

// Tailwind only sees whole class names, so each hover group gets its own spelled-out set.
const REVEAL_ON = {
  row: "slagen:group-hover/row:opacity-100 slagen:group-focus-within/row:opacity-100",
  env: "slagen:group-hover/env:opacity-100 slagen:group-focus-within/env:opacity-100",
};

const ICON_BUTTON = "slagen:-my-1 slagen:size-5 slagen:align-middle slagen:text-muted-foreground slagen:hover:text-foreground";

/**
 * Copies `value` and confirms with a notification. Hidden until its row is hovered or holds focus, but
 * always in the tab order, and always visible on touch screens, which have no hover.
 */
export function CopyButton({ value, what, group = "row" }: { value: string; what: string; group?: "row" | "env" }) {
  const { notify } = useHost();
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
      className={`${ICON_BUTTON} slagen:ml-1 slagen:opacity-0 slagen:focus-visible:opacity-100 slagen:pointer-coarse:opacity-100 ${REVEAL_ON[group]}`}
      onClick={async () => {
        if (await copyWithNotice(value, what, notify)) setCopied(true);
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
      className={`${ICON_BUTTON} slagen:ml-1`}
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
      <span aria-hidden className="slagen:tracking-widest slagen:select-none">
        ••••••••
      </span>
      <span className="slagen:sr-only">hidden</span>
    </>
  );
}
