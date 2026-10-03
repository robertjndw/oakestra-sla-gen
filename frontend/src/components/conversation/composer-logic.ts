import { formatAnswers, type QuestionAnswer } from "@/lib/answers";
import { MAX_UPLOAD_CHARS } from "@/lib/constants";
import type { Clarification, InputFile, InputFileKind } from "@/lib/types";

export interface ActiveForm {
  questions: Clarification[];
  answers: QuestionAnswer[];
}

export interface ComposerInput {
  sessionId: string | null;
  turnRunning: boolean;
  hasModelDraft: boolean;
  form: ActiveForm | null;
  text: string;
  inputFile: InputFile | null;
}

export interface ComposerModel {
  /** What would be sent; "" when there is nothing to send. */
  message: string;
  canSend: boolean;
  label: string;
  placeholder: string;
  ariaLabel: string;
  hint: "answer-or-change" | "answer-one" | "shortcut" | null;
}

export function composerModel(i: ComposerInput): ComposerModel {
  const attached = i.sessionId ? null : (i.inputFile?.kind ?? null);
  const message = i.form ? formatAnswers(i.form.questions, i.form.answers, i.text) : i.text.trim();
  const canSend = !i.turnRunning && (!!message || !!attached);

  let label = i.sessionId ? "Update draft" : "Generate draft";
  if (i.form) label = "Send answers";

  let placeholder: string;
  let ariaLabel: string;
  if (!i.sessionId) {
    ariaLabel = "Describe what to deploy";
    if (attached === "sla") placeholder = "What should change? e.g. give the api 2 CPUs and add a Redis cache (optional)";
    else if (attached === "compose") placeholder = "Anything to add? e.g. pin the api to cluster edge1 (optional)";
    else placeholder = "e.g. A Node.js API on port 3000 with 2 CPUs and 1 GB of memory, talking to a Redis cache";
  } else if (i.form) {
    ariaLabel = "Anything else to change";
    placeholder = "Anything else to change? (optional)";
  } else {
    ariaLabel = "Describe a change";
    placeholder = "Describe a change, e.g. give the api 2 CPUs and expose it on 443";
  }

  let hint: ComposerModel["hint"] = null;
  if (!i.turnRunning) {
    if (i.form && !message) hint = i.hasModelDraft ? "answer-or-change" : "answer-one";
    else if (message || attached) hint = "shortcut";
  }
  return { message, canSend, label, placeholder, ariaLabel, hint };
}

export type ReadResult = { ok: true; file: InputFile } | { ok: false; error: string };

/**
 * Decided mostly by content: compose files can be JSON too, and an SLA saved from somewhere
 * else may not end in .json. The extension only breaks the tie for text that doesn't parse, so
 * a broken sla.json gets the server's "invalid JSON" error rather than "no services".
 */
export function detectKind(name: string, text: string): InputFileKind {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return /\.json$/i.test(name) ? "sla" : "compose";
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) return "compose";
  return "services" in data ? "compose" : "sla";
}

export async function readInputFile(file: File): Promise<ReadResult> {
  const text = await file.text();
  if (text.length > MAX_UPLOAD_CHARS) {
    return {
      ok: false,
      error: `${file.name} is ${text.length.toLocaleString("en-US")} characters; the limit is ${MAX_UPLOAD_CHARS.toLocaleString("en-US")}.`,
    };
  }
  return { ok: true, file: { name: file.name, text, kind: detectKind(file.name, text) } };
}
