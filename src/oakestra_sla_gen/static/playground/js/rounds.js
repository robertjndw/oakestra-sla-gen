import { el, svg } from "./dom.js";
import { plural } from "./format.js";

const STATUS_COLORS = { ok: "var(--accent)", ask: "var(--amber-dot)", bad: "var(--rust)" };
const STATUS_MARKS = {
  ok: "M5.2 9.3 L7.8 11.8 L12.8 6.6",
  ask: "M6.9 7 A2.1 2.1 0 1 1 9.9 8.9 C9.3 9.3 9 9.7 9 10.4 M9 12.9 L9 13",
  bad: "M6 6 L12 12 M12 6 L6 12",
};

function statusIcon(kind) {
  const s = svg("svg", { class: "status-icon", viewBox: "0 0 18 18", "aria-hidden": "true" });
  s.appendChild(svg("circle", { cx: 9, cy: 9, r: 8, fill: STATUS_COLORS[kind] }));
  s.appendChild(svg("path", {
    d: STATUS_MARKS[kind], fill: "none", stroke: "var(--surface)", "stroke-width": 2,
    "stroke-linecap": "round", "stroke-linejoin": "round",
  }));
  return s;
}

export function roundShell(kind, title, meta) {
  const art = el("article", "round" + (kind === "bad" ? " round-failed" : ""));
  const head = el("div", "round-head");
  head.appendChild(statusIcon(kind));
  head.appendChild(el("span", "round-title", title));
  if (meta) head.appendChild(el("span", "round-meta", meta));
  art.appendChild(head);
  return art;
}

export function attemptsDetails(attempts) {
  if (!attempts || attempts.length < 2) return null;
  const d = el("details", "attempts");
  d.appendChild(el("summary", null, `Show all ${attempts.length} attempts`));
  const ol = el("ol", "attempt-list");
  for (const a of attempts) {
    const li = el("li");
    if (!a.errors?.length) {
      li.appendChild(el("span", "attempt-ok", "Passed validation"));
    } else {
      li.appendChild(el("span", null, "Rejected with " + plural(a.errors.length, "problem")));
      const ul = el("ul");
      for (const e of a.errors) ul.appendChild(el("li", null, e));
      li.appendChild(ul);
    }
    ol.appendChild(li);
  }
  d.appendChild(ol);
  return d;
}

// `list` is the DOM to insert; `controls` is what composeMessage reads the answers from.
export function buildQuestionForm(questions, { onChange, onKeydown }) {
  const list = el("ol", "questions");
  const controls = questions.map((q, i) => {
    const li = el("li", "q");
    if (q.topic) li.appendChild(el("span", "q-topic", q.topic));
    li.appendChild(el("p", "q-text", q.question));
    if (q.assumption) {
      const assume = el("p", "q-assume");
      assume.appendChild(el("strong", null, "Assumed: "));
      assume.appendChild(document.createTextNode(q.assumption));
      li.appendChild(assume);
    }
    const box = el("div", "q-controls");
    const input = el("input", "q-input");
    input.type = "text";
    input.setAttribute("aria-label", `Answer to question ${i + 1}`);
    input.placeholder = q.assumption ? "Your answer" : "Your answer, or leave it to the model";
    const ctl = { q, li, box, input, mode: q.assumption ? "keep" : "answer" };
    if (q.assumption) {
      const seg = el("div", "seg seg-sm");
      seg.setAttribute("role", "group");
      seg.setAttribute("aria-label", `Question ${i + 1}`);
      const keep = el("button", null, "Keep assumption");
      const answer = el("button", null, "Answer");
      keep.type = answer.type = "button";
      const choose = (m) => {
        ctl.mode = m;
        keep.setAttribute("aria-pressed", String(m === "keep"));
        answer.setAttribute("aria-pressed", String(m === "answer"));
        input.hidden = m !== "answer";
        if (m === "answer") input.focus();
        onChange();
      };
      keep.addEventListener("click", () => choose("keep"));
      answer.addEventListener("click", () => choose("answer"));
      seg.append(keep, answer);
      box.appendChild(seg);
      keep.setAttribute("aria-pressed", "true");
      answer.setAttribute("aria-pressed", "false");
      input.hidden = true;
    }
    input.addEventListener("input", onChange);
    input.addEventListener("keydown", onKeydown);
    box.appendChild(input);
    li.appendChild(box);
    list.appendChild(li);
    return ctl;
  });
  return { controls, list };
}

export const answeredText = (ctl) => ctl.mode === "answer" ? ctl.input.value.trim() : "";

export function freezeForm(form, keepAll) {
  for (const ctl of form.controls) {
    const text = keepAll ? "" : answeredText(ctl);
    ctl.box.remove();
    if (text) {
      ctl.li.appendChild(el("p", "q-reply q-reply-answer", "You: " + text));
    } else {
      ctl.li.appendChild(el("p", "q-reply", ctl.q.assumption ? "Kept: " + ctl.q.assumption : "Left to the model"));
    }
  }
  form.list.classList.add("answered");
}
