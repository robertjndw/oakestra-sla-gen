// The editor text is the source of truth. Visual renders the last version of it that parsed,
// so a typo in Code doesn't blank the Visual view.
import { validate } from "./api.js";
import { $, el } from "./dom.js";
import * as editor from "./editor.js";
import { plural } from "./format.js";
import { errorLine, lineForPath, lineIndex, splitProblem } from "./json-paths.js";
import { state } from "./state.js";
import { renderVisual } from "./visual.js";

const MODE_KEY = "oakestra-playground-mode";

export const rightPane = document.querySelector(".pane-right");

let mode = "visual";
let baselineText = "";  // editor text as the model last wrote it, to spot edits
let shownSla = null;    // last editor JSON that parsed
let problems = [];
let parseError = null;  // {message, line}
let validateSeq = 0;
let debounceId = null;

const isEdited = () => editor.getText() !== baselineText;

export function takeModelDraft(sla) {
  const text = JSON.stringify(sla, null, 2);
  const keepEdits = editor.getText().trim() && isEdited() &&
    !window.confirm("The model sent a new draft. Replace your edits in the Code view with it?");
  baselineText = text;
  if (keepEdits) {
    settle();
    return;
  }
  // The server only sends drafts that passed validation, so skip the /validate round trip.
  editor.setText(text);
  clearTimeout(debounceId);
  validateSeq++;
  shownSla = sla;
  problems = [];
  parseError = null;
  renderOutput();
}

// Leaves baselineText alone on purpose: this attempt failed validation, so "Reset to model
// draft" should still go back to the last draft that passed.
export function editCandidate(sla) {
  editor.setText(JSON.stringify(sla, null, 2));
  setMode("code");
  settle();
  editor.focus();
}

export function resetOutput() {
  baselineText = "";
  shownSla = null;
  problems = [];
  parseError = null;
  editor.setText("");
}

function settle() {
  clearTimeout(debounceId);
  const text = editor.getText();
  if (!text.trim()) {
    // An empty editor would blank the visual view; keep showing the last good version.
    renderOutput();
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    parseError = { message: e.message, line: errorLine(e.message, text) };
    renderOutput();
    return;
  }
  parseError = null;
  shownSla = parsed;
  renderOutput();
  const seq = ++validateSeq;
  validate(parsed).then((res) => {
    if (seq !== validateSeq) return;
    problems = res.status === 200
      ? (res.body.errors || [])
      : ["Could not validate: the server answered with status " + res.status];
    renderOutput();
  });
}

function setMode(next) {
  mode = next;
  $("mode-visual-btn").setAttribute("aria-pressed", String(next === "visual"));
  $("mode-code-btn").setAttribute("aria-pressed", String(next === "code"));
  rightPane.classList.toggle("code-mode", next === "code");
  try { localStorage.setItem(MODE_KEY, next); } catch {
    // storage unavailable (private mode, blocked site data): the mode just won't persist
  }
  renderOutput();
}

export function renderOutput() {
  const hasText = !!editor.getText().trim();
  const showCode = mode === "code" && (hasText || shownSla);
  const showVisual = mode === "visual" && shownSla;
  $("out-empty").hidden = !!(showCode || showVisual);
  $("code-view").hidden = !showCode;
  $("visual-view").hidden = !showVisual;
  $("copy-btn").disabled = $("download-btn").disabled = !hasText;

  if (!shownSla && !hasText) {
    let title, text;
    if (state.turnRunning) {
      title = "Working on a draft";
      text = "The model writes the SLA, then it's validated and retried if needed. It appears here once it passes.";
    } else if (state.sessionId) {
      title = "No draft yet";
      text = "Answer the questions on the left so the model has enough to go on.";
    } else {
      title = "Your SLA shows up here";
      text = "Visual shows the services and how they connect. Code is the SLA JSON, which you can edit, validate and download.";
    }
    $("out-empty-title").textContent = title;
    $("out-empty-text").textContent = text;
  }

  const edited = hasText && isEdited();
  $("draft-title").textContent = !hasText && !shownSla ? "No draft yet"
    : state.draftCount === 0 ? "Hand-edited SLA"
    : `Draft ${state.draftCount}${edited ? ", edited" : ""}`;

  const badge = $("badge");
  badge.hidden = !hasText;
  if (parseError) {
    badge.className = "badge badge-bad"; badge.textContent = "Invalid JSON";
  } else if (problems.length) {
    badge.className = "badge badge-bad"; badge.textContent = plural(problems.length, "problem");
  } else if (state.accepted && !edited) {
    badge.className = "badge badge-done"; badge.textContent = "Accepted";
  } else {
    badge.className = "badge badge-ok"; badge.textContent = edited ? "Valid" : "Passed validation";
  }

  $("reset-btn").hidden = !(edited && baselineText);
  $("code-status").textContent = parseError ? "" : edited
    ? "Edited by hand. Validated as you type."
    : hasText ? "This is the draft as the model wrote it." : "";
  renderProblems();
  if (showVisual) {
    renderVisual({ sla: shownSla, previous: state.previousModelSla, problems, parseError });
  }
}

function renderProblems() {
  let items = [];
  if (parseError) {
    items = [{ line: parseError.line, path: "", message: parseError.message }];
  } else if (problems.length) {
    const map = lineIndex(editor.getText());
    items = problems.map((p) => {
      const { path, message } = splitProblem(p);
      return { line: lineForPath(map, path), path, message };
    });
  }
  $("problems").replaceChildren(...items.map((item) => {
    const li = el("li");
    const btn = el("button", "problem");
    btn.type = "button";
    btn.appendChild(el("span", "problem-line", item.line ? "Line " + item.line : "JSON"));
    const text = el("span", null, item.message);
    if (item.path) text.appendChild(el("span", "problem-path", item.path));
    btn.appendChild(text);
    if (item.line) {
      btn.addEventListener("click", () => {
        setMode("code");
        editor.selectLine(item.line);
      });
    } else {
      btn.disabled = true;
    }
    li.appendChild(btn);
    return li;
  }));
}

export function copyDraft(button) {
  const text = editor.getText();
  if (!text) return;
  const original = button.textContent;
  const done = (label) => {
    button.textContent = label;
    setTimeout(() => { button.textContent = original; }, 1500);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => done("Copied"), () => done("Copy failed"));
  } else {
    editor.selectAll();
    done(document.execCommand("copy") ? "Copied" : "Copy failed");
  }
}

export function downloadDraft() {
  const text = editor.getText();
  if (!text) return;
  const url = URL.createObjectURL(new Blob([text.endsWith("\n") ? text : text + "\n"], { type: "application/json" }));
  const a = el("a");
  a.href = url;
  a.download = "sla.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function initOutput() {
  editor.initEditor({
    onInput() {
      clearTimeout(debounceId);
      debounceId = setTimeout(settle, 400);
    },
  });
  $("reset-btn").addEventListener("click", () => {
    editor.setText(baselineText);
    settle();
  });
  $("mode-visual-btn").addEventListener("click", () => setMode("visual"));
  $("mode-code-btn").addEventListener("click", () => setMode("code"));
  $("copy-btn").addEventListener("click", (e) => copyDraft(e.currentTarget));
  $("download-btn").addEventListener("click", downloadDraft);

  let savedMode = "visual";
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === "visual" || stored === "code") savedMode = stored;
  } catch {
    // storage unavailable: start in the default mode
  }
  setMode(savedMode);
}
