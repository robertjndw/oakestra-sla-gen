import type { Clarification } from "./types";

export type AnswerMode = "keep" | "answer";

export interface QuestionAnswer {
  mode: AnswerMode;
  text: string;
}

/** The reply text for one question, or "" when the user keeps the assumption or defers. */
export function answeredText(answer: QuestionAnswer): string {
  return answer.mode === "answer" ? answer.text.trim() : "";
}

/**
 * Builds the follow-up message. The server restates the numbered questions before this text,
 * so numbering the replies the same way lets the model line them up. Returns "" when there is
 * nothing to send. With no open questions it is just the free text.
 */
export function formatAnswers(
  questions: Clarification[],
  answers: QuestionAnswer[],
  extra: string,
): string {
  const free = extra.trim();
  if (questions.length === 0) return free;
  const anyAnswer = answers.some((a) => answeredText(a));
  if (!anyAnswer && !free) return "";
  const lines = questions.map((q, i) => {
    const text = answers[i] ? answeredText(answers[i]) : "";
    if (text) return `${i + 1}. ${text}`;
    if (q.assumption) return `${i + 1}. Keep the assumption: ${q.assumption}`;
    return `${i + 1}. No preference, use your best judgement.`;
  });
  if (free) lines.push("", "Also: " + free);
  return lines.join("\n");
}

/** Default answers for a fresh question list: keep assumptions where there is one. */
export function initialAnswers(questions: Clarification[]): QuestionAnswer[] {
  return questions.map((q) => ({ mode: q.assumption ? "keep" : "answer", text: "" }));
}
