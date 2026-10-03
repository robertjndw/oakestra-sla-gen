import type { Text } from "@codemirror/state";
import { lineForPath, lineIndex, splitProblem } from "@/lib/json-paths";
import type { ParseError } from "@/hooks/use-validation";

export interface ProblemItem {
  /** 1-based line, or null when the position is unknown. */
  line: number | null;
  path: string;
  message: string;
}

export interface EditorDiagnostic {
  from: number;
  to: number;
  severity: "error";
  message: string;
}

// A fresh [] per keystroke would make CodeView re-dispatch diagnostics every time.
const NO_ITEMS: ProblemItem[] = [];

/** One entry per problem for the list under the editor; a syntax error replaces the server's. */
export function problemItems(
  text: string,
  errors: string[],
  parseError: ParseError | null,
): ProblemItem[] {
  if (parseError) return [{ line: parseError.line, path: "", message: parseError.message }];
  if (!errors.length) return NO_ITEMS;
  const map = lineIndex(text);
  return errors.map((e) => {
    const { path, message } = splitProblem(e);
    return { line: lineForPath(map, path), path, message };
  });
}

/** Squiggles cover the whole line, since the server only reports JSON paths. */
export function toDiagnostics(doc: Text, items: ProblemItem[]): EditorDiagnostic[] {
  return items.map((item) => {
    const { from, to } = doc.line(Math.min(Math.max(item.line ?? 1, 1), doc.lines));
    return {
      from,
      to,
      severity: "error",
      message: item.path ? `${item.message} (${item.path})` : item.message,
    };
  });
}

export interface ServiceProblems {
  by: Record<string, string[]>;
  global: string[];
}

const SERVICE_PATH = /^applications\[(\d+)\]\.microservices\[(\d+)\]/;

/** Keys are "appIndex/serviceIndex". Problems outside any service are global. */
export function problemsByService(errors: string[], parseError: ParseError | null): ServiceProblems {
  const by: Record<string, string[]> = {};
  const global: string[] = [];
  if (parseError) return { by, global };
  for (const problem of errors) {
    const m = SERVICE_PATH.exec(problem);
    if (!m) {
      global.push(problem);
      continue;
    }
    const parts = splitProblem(problem);
    const where = parts.path.length > m[0].length ? ` (${parts.path.slice(m[0].length + 1)})` : "";
    (by[`${m[1]}/${m[2]}`] ??= []).push(parts.message + where);
  }
  return { by, global };
}
