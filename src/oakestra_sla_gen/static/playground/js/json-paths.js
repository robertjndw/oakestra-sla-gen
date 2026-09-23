export function errorLine(message, text) {
  let m = /line (\d+)/.exec(message);
  if (m) return parseInt(m[1], 10);
  m = /position (\d+)/.exec(message);
  if (m) return text.slice(0, parseInt(m[1], 10)).split("\n").length;
  return null;
}

// Maps each JSON path (as validation errors print it) to the line it starts on, so a
// problem can jump to its line. Only runs on text that already parsed.
export function lineIndex(text) {
  let pos = 0, line = 1;
  const map = {};
  function ws() {
    while (pos < text.length) {
      const c = text[pos];
      if (c === "\n") { line++; pos++; } else if (c === " " || c === "\t" || c === "\r") { pos++; } else break;
    }
  }
  function str() {
    const start = ++pos;
    while (pos < text.length && text[pos] !== '"') pos += text[pos] === "\\" ? 2 : 1;
    const raw = text.slice(start, pos);
    pos++;
    try { return JSON.parse('"' + raw + '"'); } catch { return raw; }
  }
  function value(path) {
    ws();
    if (!(path in map)) map[path] = line;
    const c = text[pos];
    if (c === "{") {
      pos++; ws();
      if (text[pos] === "}") { pos++; return; }
      for (;;) {
        ws();
        const key = str();
        ws(); pos++;
        const keyPath = path ? path + "." + key : key;
        map[keyPath] = line;
        value(keyPath);
        ws();
        if (text[pos++] !== ",") return;
      }
    } else if (c === "[") {
      pos++; ws();
      if (text[pos] === "]") { pos++; return; }
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
  try { value(""); } catch {
    // shouldn't happen on JSON that parsed; unmapped paths fall back to line 1
  }
  return map;
}

export function splitProblem(problem) {
  const i = problem.indexOf(": ");
  if (i < 0) return { path: "", message: problem };
  const path = problem.slice(0, i);
  return { path: path === "<root>" ? "" : path, message: problem.slice(i + 2) };
}

export function lineForPath(map, path) {
  let p = path;
  while (p) {
    if (p in map) return map[p];
    const cut = Math.max(p.lastIndexOf("."), p.lastIndexOf("["));
    p = cut > 0 ? p.slice(0, cut) : "";
  }
  return 1;
}
