// A transparent textarea stacked on a highlighted <pre>, so both have to keep the same
// font, padding and scroll position. Kept free of SLA logic so it's easy to replace.
import { $, el } from "./dom.js";

// Must match the editor's line-height in playground.css; used to scroll a line into view.
const LINE_HEIGHT_PX = 20;

const editorEl = $("editor");
const highlightEl = $("highlight");
const gutterEl = $("gutter");

function highlightInto(target, text) {
  const frag = document.createDocumentFragment();
  const re = /("(?:\\.|[^"\\\n])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}\[\],:])/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    if (m[1]) {
      frag.appendChild(el("span", m[2] ? "syn-key" : "syn-str", m[1]));
      if (m[2]) frag.appendChild(el("span", "syn-punc", m[2]));
    } else if (m[3]) {
      frag.appendChild(el("span", "syn-num", m[3]));
    } else if (m[4]) {
      frag.appendChild(el("span", "syn-lit", m[4]));
    } else {
      frag.appendChild(el("span", "syn-punc", m[5]));
    }
    last = re.lastIndex;
  }
  frag.appendChild(document.createTextNode(text.slice(last) + "\n"));
  target.replaceChildren(frag);
}

function paint() {
  const text = editorEl.value;
  highlightInto(highlightEl, text);
  const lines = text.split("\n").length;
  gutterEl.textContent = Array.from({ length: lines }, (_, i) => i + 1).join("\n") + "\n";
  syncScroll();
}

function syncScroll() {
  highlightEl.scrollTop = editorEl.scrollTop;
  highlightEl.scrollLeft = editorEl.scrollLeft;
  gutterEl.scrollTop = editorEl.scrollTop;
}

export const getText = () => editorEl.value;

export function setText(text) {
  editorEl.value = text;
  paint();
}

export const focus = () => editorEl.focus();
export const selectAll = () => editorEl.select();

export function selectLine(line) {
  const lines = editorEl.value.split("\n");
  let start = 0;
  for (let i = 0; i < line - 1 && i < lines.length; i++) start += lines[i].length + 1;
  const end = start + (lines[line - 1] || "").length;
  editorEl.focus();
  editorEl.setSelectionRange(start, end);
  editorEl.scrollTop = Math.max(0, (line - 1) * LINE_HEIGHT_PX - editorEl.clientHeight / 3);
  syncScroll();
}

export function initEditor({ onInput }) {
  editorEl.addEventListener("scroll", syncScroll);
  editorEl.addEventListener("input", () => {
    paint();
    onInput();
  });
  editorEl.addEventListener("keydown", (e) => {
    // Tab should indent inside the JSON, not jump out of the editor.
    if (e.key === "Tab" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      document.execCommand("insertText", false, "  ");
    }
  });
  paint();
}
