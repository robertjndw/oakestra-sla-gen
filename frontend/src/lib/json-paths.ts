export interface ParseErrorPosition {
  line: number | null;
  column: number | null;
}

/** Pulls a line (and column when present) out of a JSON.parse error message across engines. */
export function errorPosition(message: string, text: string): ParseErrorPosition {
  const col = /column (\d+)/.exec(message);
  const column = col ? parseInt(col[1], 10) : null;
  const line = errorLine(message, text);
  return { line, column };
}

export function errorLine(message: string, text: string): number | null {
  let m = /line (\d+)/.exec(message);
  if (m) return parseInt(m[1], 10);
  m = /position (\d+)/.exec(message);
  if (m) return text.slice(0, parseInt(m[1], 10)).split("\n").length;
  return null;
}

/** Maps each JSON path (as validation errors print it) to the line it starts on. */
export type LineIndex = Record<string, number>;

// Only runs on text that already parsed, so it can be a forgiving scanner instead of a parser.
export function lineIndex(text: string): LineIndex {
  let pos = 0;
  let line = 1;
  const map: LineIndex = {};

  function ws() {
    while (pos < text.length) {
      const c = text[pos];
      if (c === "\n") {
        line++;
        pos++;
      } else if (c === " " || c === "\t" || c === "\r") {
        pos++;
      } else break;
    }
  }

  function str(): string {
    const start = ++pos;
    while (pos < text.length && text[pos] !== '"') pos += text[pos] === "\\" ? 2 : 1;
    const raw = text.slice(start, pos);
    pos++;
    try {
      return JSON.parse('"' + raw + '"') as string;
    } catch {
      return raw;
    }
  }

  function value(path: string) {
    ws();
    if (!(path in map)) map[path] = line;
    const c = text[pos];
    if (c === "{") {
      pos++;
      ws();
      if (text[pos] === "}") {
        pos++;
        return;
      }
      for (;;) {
        ws();
        const key = str();
        ws();
        pos++;
        const keyPath = path ? path + "." + key : key;
        map[keyPath] = line;
        value(keyPath);
        ws();
        if (text[pos++] !== ",") return;
      }
    } else if (c === "[") {
      pos++;
      ws();
      if (text[pos] === "]") {
        pos++;
        return;
      }
      for (let i = 0; ; i++) {
        value(`${path}[${i}]`);
        ws();
        if (text[pos++] !== ",") return;
      }
    } else if (c === '"') {
      str();
    } else {
      while (pos < text.length && ",}] \n\r\t".indexOf(text[pos]) < 0) pos++;
    }
  }

  try {
    value("");
  } catch {
    // shouldn't happen on JSON that parsed; unmapped paths fall back to line 1
  }
  return map;
}

export function splitProblem(problem: string): { path: string; message: string } {
  const i = problem.indexOf(": ");
  if (i < 0) return { path: "", message: problem };
  const path = problem.slice(0, i);
  return { path: path === "<root>" ? "" : path, message: problem.slice(i + 2) };
}

export function lineForPath(map: LineIndex, path: string): number {
  let p = path;
  while (p) {
    if (p in map) return map[p];
    const cut = Math.max(p.lastIndexOf("."), p.lastIndexOf("["));
    p = cut > 0 ? p.slice(0, cut) : "";
  }
  return 1;
}
