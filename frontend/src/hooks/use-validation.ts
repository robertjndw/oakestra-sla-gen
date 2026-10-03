import { useEffect, useMemo, useState } from "react";
import { validate } from "@/lib/api";
import { VALIDATE_DEBOUNCE_MS } from "@/lib/constants";
import { errorPosition } from "@/lib/json-paths";
import type { Sla } from "@/lib/types";

export type ValidationStatus = "idle" | "checking" | "valid" | "invalid" | "parse-error";

export interface ParseError {
  message: string;
  /** 1-based line, when the engine's message says where it failed. */
  line: number | null;
  column: number | null;
}

export interface ValidationResult {
  status: ValidationStatus;
  /** Validation problems from the server; empty unless status is "invalid". */
  errors: string[];
  parseError: ParseError | null;
  /** The newest editor text that parsed, so a typo does not blank the visual view. */
  sla: Sla | null;
}

// Shared so an unchanged result keeps the same array and downstream memos stay valid.
const NO_ERRORS: string[] = [];

function tryParse(text: string): { sla: Sla } | { error: ParseError } {
  try {
    return { sla: JSON.parse(text) as Sla };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const { line, column } = errorPosition(message, text);
    return { error: { message, line, column } };
  }
}

/**
 * Debounced validation of the editor text. `trustedText` is the model's own draft, which the
 * server already validated, so it skips the round trip.
 */
export function useValidation(
  text: string,
  trustedText: string = "",
  /** True for a fresh conversation, so the previous session's SLA is not shown as a fallback. */
  forgetLast: boolean = false,
): ValidationResult {
  const trusted = text.trim() !== "" && text === trustedText;
  const parsed = useMemo(() => (text.trim() ? tryParse(text) : null), [text]);
  const parsedSla = parsed && "sla" in parsed ? parsed.sla : null;

  const [lastSla, setLastSla] = useState<Sla | null>(null);
  if (parsedSla && parsedSla !== lastSla) setLastSla(parsedSla);
  else if (!parsedSla && forgetLast && lastSla !== null) setLastSla(null);

  const [settledText, setSettledText] = useState<string | null>(null);
  const [remote, setRemote] = useState<{ text: string; errors: string[] } | null>(null);

  const skip = trusted || !text.trim();
  useEffect(() => {
    if (skip) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setSettledText(text);
      if (!parsedSla) return;
      validate(parsedSla).then((res) => {
        if (cancelled) return;
        const errors =
          res.status === 200
            ? (res.body.errors ?? [])
            : [`Could not validate: the server answered with status ${res.status}`];
        setRemote({ text, errors });
      });
    }, VALIDATE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text, parsedSla, skip]);

  const sla = parsedSla ?? (forgetLast ? null : lastSla);
  if (!text.trim()) return { status: "idle", errors: NO_ERRORS, parseError: null, sla };
  if (trusted) return { status: "valid", errors: NO_ERRORS, parseError: null, sla };
  if (settledText !== text) return { status: "checking", errors: NO_ERRORS, parseError: null, sla };
  if (parsed && "error" in parsed) {
    return { status: "parse-error", errors: NO_ERRORS, parseError: parsed.error, sla };
  }
  if (remote?.text !== text) return { status: "checking", errors: NO_ERRORS, parseError: null, sla };
  return {
    status: remote.errors.length ? "invalid" : "valid",
    errors: remote.errors,
    parseError: null,
    sla,
  };
}
