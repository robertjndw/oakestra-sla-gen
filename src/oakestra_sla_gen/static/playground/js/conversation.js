import { answerSession, deleteSession, startSession } from "./api.js";
import { $, el } from "./dom.js";
import { plural } from "./format.js";
import {
  copyDraft, downloadDraft, editCandidate, renderOutput, resetOutput, rightPane, takeModelDraft,
} from "./output.js";
import { answeredText, attemptsDetails, buildQuestionForm, freezeForm, roundShell } from "./rounds.js";
import { collectSettings, lockSettings } from "./settings.js";
import { describeChanges, diffSlas, firstDraftLine } from "./sla.js";
import { state } from "./state.js";

const EXAMPLES = [
  { text: "A single nginx web server on port 80 with 1 CPU and 512 MB of memory" },
  { text: "My Flask API ghcr.io/acme/orders:2.1 on port 8000, backed by a Postgres database with password ordersecret" },
  { text: "A Redis cache and a Python worker that pulls jobs from it, both pinned to the cluster edge1" },
  { text: "Deploy my app", note: "Too vague on purpose, so you can see the model ask questions first" },
];
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const threadEl = $("thread");
const introEl = $("intro");
const inputEl = $("composer-input");
const sendBtn = $("send-btn");
const acceptBtn = $("accept-btn");
const hintEl = $("composer-hint");
const progressEl = $("progress");

// Bumped by every send and by New session, so a response that arrives after the
// conversation moved on is dropped instead of rendered into the wrong thread.
let requestToken = 0;
let pending = null;     // {el, timer} of the in-progress round
let activeForm = null;  // open questions of the latest round, with their controls

function scrollThread() { threadEl.scrollTop = threadEl.scrollHeight; }

function addToThread(node) {
  introEl.hidden = true;
  threadEl.appendChild(node);
  scrollThread();
}

const addYou = (text) => addToThread(el("div", "you", text));

function startTurn(first) {
  state.turnRunning = true;
  progressEl.hidden = false;
  rightPane.classList.add("busy");
  const art = el("article", "round pending");
  const head = el("div", "round-head");
  const label = el("span");
  head.append(el("span", "spinner"), label);
  art.appendChild(head);
  addToThread(art);
  const verb = first ? "Drafting the SLA" : "Updating the draft";
  const started = Date.now();
  const tick = () => {
    const secs = Math.floor((Date.now() - started) / 1000);
    // qwen at low effort still takes over a minute per SLA, so say that's normal.
    const hint = secs >= 15 ? ". Local models can take a minute or more." : "";
    label.textContent = `${verb}, ${secs}s${hint}`;
  };
  tick();
  pending = { el: art, timer: setInterval(tick, 1000) };
  updateComposer();
  renderOutput();
}

function endTurn() {
  state.turnRunning = false;
  if (pending) {
    clearInterval(pending.timer);
    pending.el.remove();
    pending = null;
  }
  progressEl.hidden = true;
  rightPane.classList.remove("busy");
  updateComposer();
  renderOutput();
}

// The server restates the numbered questions before this text, so numbering the replies
// the same way lets the model line them up.
function composeMessage() {
  const extra = inputEl.value.trim();
  if (!activeForm) return extra;
  const anyAnswer = activeForm.controls.some((c) => answeredText(c));
  if (!anyAnswer && !extra) return "";
  const lines = activeForm.controls.map((c, i) => {
    const text = answeredText(c);
    if (text) return `${i + 1}. ${text}`;
    if (c.q.assumption) return `${i + 1}. Keep the assumption: ${c.q.assumption}`;
    return `${i + 1}. No preference, use your best judgement.`;
  });
  if (extra) lines.push("", "Also: " + extra);
  return lines.join("\n");
}

function kbdHint(action) {
  const frag = document.createDocumentFragment();
  frag.append(el("kbd", null, IS_MAC ? "⌘" : "Ctrl"), " ", el("kbd", null, "Enter"), " to " + action);
  return frag;
}

function updateComposer() {
  $("accepted-bar").hidden = !state.accepted;
  $("composer-main").hidden = state.accepted;
  if (state.accepted) {
    $("accepted-text").textContent = `Draft ${state.draftCount} is accepted.`;
    return;
  }
  const message = composeMessage();
  inputEl.disabled = state.turnRunning;
  sendBtn.disabled = state.turnRunning || !message;
  sendBtn.textContent = state.sessionId ? "Update draft" : "Generate draft";
  acceptBtn.hidden = !state.sessionId || !state.modelSla;
  acceptBtn.disabled = state.turnRunning;
  if (!state.sessionId) {
    inputEl.placeholder = "e.g. A Node.js API on port 3000 with 2 CPUs and 1 GB of memory, talking to a Redis cache";
  } else if (activeForm) {
    inputEl.placeholder = "Anything else to change? (optional)";
  } else {
    inputEl.placeholder = "Describe a change, e.g. give the api 2 CPUs and expose it on 443";
  }
  hintEl.replaceChildren();
  if (state.turnRunning) return;
  if (activeForm && !message) {
    hintEl.textContent = state.modelSla
      ? "Answer a question or describe a change. Happy with the assumptions? Accept the draft."
      : "Answer at least one question so the model can draft an SLA.";
  } else if (message) {
    hintEl.appendChild(kbdHint(state.sessionId ? "update" : "generate"));
  }
}

function onSendShortcut(e) {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    send();
  }
}

function closeForm(keepAll) {
  if (!activeForm) return;
  freezeForm(activeForm, keepAll);
  activeForm = null;
}

async function send() {
  const message = composeMessage();
  if (!message || state.turnRunning) return;
  const extra = inputEl.value.trim();
  const first = !state.sessionId;
  if (activeForm) {
    closeForm(false);
    if (extra) addYou(extra);
  } else {
    addYou(message);
  }
  inputEl.value = "";
  startTurn(first);

  const token = ++requestToken;
  const res = first
    ? await startSession(collectSettings(), message)
    : await answerSession(state.sessionId, message);
  if (token !== requestToken) return;
  endTurn();
  handleResponse(res, first, message);
  updateComposer();
  renderOutput();
}

function adoptSession(id) {
  state.sessionId = id;
  lockSettings(true);
}

function handleResponse(res, first, message) {
  const body = res.body || {};
  if (res.status === 200) {
    adoptSession(body.session_id);
    renderRound(body);
    return;
  }
  if (res.status === 422 && Array.isArray(body.errors)) {
    if (!state.sessionId && body.session_id) adoptSession(body.session_id);
    renderFailedRound(body);
    return;
  }
  // Nothing was saved for a failed first message, so hand it back for a retry.
  if (first && !state.sessionId) inputEl.value = message;
  if (res.status === 422) {
    const msgs = (Array.isArray(body.detail) ? body.detail : []).map((d) => d.msg || JSON.stringify(d));
    notice("The server rejected the request", msgs.join("; ") || "Check the settings and try again.");
  } else if (res.status === 502) {
    notice("The model server returned an error", body.detail, "Check that LM Studio (or your OpenAI-compatible server) is running and reachable from the playground, then send again.");
  } else if (res.status === 404) {
    const art = notice("This session has expired", "Sessions live in the server's memory, so they're dropped after an hour without use or when the server restarts.");
    const actions = el("div", "round-actions");
    const btn = el("button", "btn btn-primary", "Start a new session");
    btn.type = "button";
    btn.addEventListener("click", () => newSession(true));
    actions.appendChild(btn);
    art.appendChild(actions);
  } else if (res.status === 409) {
    notice("Still working on the previous message", "Wait for it to finish, then send again.");
  } else if (res.status === 0) {
    notice("Can't reach the playground server", body.detail, "Check that oakestra-sla-gen serve --playground is still running.");
  } else {
    notice("Something went wrong", body.detail || `The server answered with status ${res.status}.`);
  }
}

function notice(title, detail, help) {
  const art = roundShell("bad", title);
  if (detail) art.appendChild(el("p", null, String(detail)));
  if (help) art.appendChild(el("p", "round-note", help));
  addToThread(art);
  return art;
}

function renderRound(body) {
  const { sla } = body;
  const questions = body.questions || [];
  const attempts = body.attempts || [];
  let art;
  if (sla) {
    state.draftCount++;
    const meta = attempts.length > 1 ? "Passed validation on attempt " + attempts.length : "Passed validation";
    art = roundShell("ok", "Draft " + state.draftCount, meta);
    let changes = state.modelSla ? describeChanges(diffSlas(state.modelSla, sla)) : [firstDraftLine(sla)];
    if (!changes.length) changes = ["No changes to the SLA"];
    const ul = el("ul", "changes");
    for (const c of changes) ul.appendChild(el("li", null, c));
    art.appendChild(ul);
  } else {
    art = roundShell("ask", "Needs more detail", state.modelSla ? `Draft ${state.draftCount} is unchanged` : "No draft yet");
  }
  if (questions.length) {
    art.appendChild(el("p", "round-note", sla
      ? `The model had to guess ${questions.length === 1 ? "one thing" : questions.length + " things"}. Keep each assumption or answer it.`
      : "Answer what you can so the model can draft an SLA."));
    activeForm = buildQuestionForm(questions, { onChange: updateComposer, onKeydown: onSendShortcut });
    art.appendChild(activeForm.list);
  } else if (sla) {
    art.appendChild(el("p", "round-note", "No open questions. Accept the draft or describe another change."));
  }
  const details = attemptsDetails(attempts);
  if (details) art.appendChild(details);
  addToThread(art);

  if (sla) {
    state.previousModelSla = state.modelSla;
    state.modelSla = sla;
    takeModelDraft(sla);
  }
  const firstInput = activeForm?.controls.find((c) => !c.input.hidden);
  (firstInput ? firstInput.input : inputEl).focus();
}

function renderFailedRound(body) {
  const attempts = body.attempts || [];
  const art = roundShell("bad", "No valid draft", "Gave up after " + plural(attempts.length || 1, "attempt"));
  const errors = body.errors || [];
  if (errors.length) {
    const ul = el("ul", "round-errors");
    for (const e of errors.slice(0, 5)) ul.appendChild(el("li", null, e));
    if (errors.length > 5) ul.appendChild(el("li", null, `and ${errors.length - 5} more`));
    art.appendChild(ul);
  }
  art.appendChild(el("p", "round-note", state.modelSla
    ? `Draft ${state.draftCount} is unchanged. Add detail or rephrase, then send again.`
    : "Add detail or rephrase, then send again. More attempts per round in Settings can also help."));
  if (body.last_candidate) {
    const actions = el("div", "round-actions");
    const btn = el("button", "btn", "Fix the last attempt by hand");
    btn.type = "button";
    btn.addEventListener("click", () => editCandidate(body.last_candidate));
    actions.appendChild(btn);
    art.appendChild(actions);
  }
  const details = attemptsDetails(attempts);
  if (details) art.appendChild(details);
  addToThread(art);
}

function accept() {
  if (!state.modelSla || state.turnRunning) return;
  closeForm(true);
  addToThread(el("div", "round-accepted", `You accepted draft ${state.draftCount}`));
  state.accepted = true;
  updateComposer();
  renderOutput();
  $("accepted-download").focus();
}

function newSession(skipConfirm) {
  if (!skipConfirm && threadEl.querySelector(".round, .you") && !state.accepted &&
      !window.confirm("Start over? This clears the conversation and the current draft.")) {
    return;
  }
  requestToken++;
  if (state.turnRunning) endTurn();
  if (state.sessionId) deleteSession(state.sessionId);
  Object.assign(state, {
    sessionId: null, draftCount: 0, modelSla: null, previousModelSla: null, accepted: false,
  });
  activeForm = null;
  for (const child of [...threadEl.children]) if (child !== introEl) child.remove();
  introEl.hidden = false;
  inputEl.value = "";
  resetOutput();
  lockSettings(false);
  updateComposer();
  renderOutput();
  inputEl.focus();
}

export function initConversation() {
  for (const ex of EXAMPLES) {
    const li = el("li");
    const btn = el("button", "example", ex.text);
    btn.type = "button";
    if (ex.note) btn.appendChild(el("span", "example-note", ex.note));
    btn.addEventListener("click", () => {
      inputEl.value = ex.text;
      inputEl.focus();
      updateComposer();
    });
    li.appendChild(btn);
    $("examples").appendChild(li);
  }

  inputEl.addEventListener("keydown", onSendShortcut);
  inputEl.addEventListener("input", updateComposer);
  $("composer").addEventListener("submit", (e) => { e.preventDefault(); send(); });
  acceptBtn.addEventListener("click", accept);
  $("keep-refining").addEventListener("click", () => {
    state.accepted = false;
    updateComposer();
    renderOutput();
    inputEl.focus();
  });
  $("accepted-download").addEventListener("click", downloadDraft);
  $("accepted-copy").addEventListener("click", (e) => copyDraft(e.currentTarget));
  $("new-btn").addEventListener("click", () => newSession(false));

  updateComposer();
  inputEl.focus();
}
