export type OutputMode = "visual" | "code";
export const isOutputMode = (v: unknown): v is OutputMode => v === "visual" || v === "code";

export function titleFor(p: { text: string; hasSla: boolean; draftCount: number; edited: boolean }): string {
  if (!p.text.trim() && !p.hasSla) return "No draft yet";
  if (p.draftCount === 0) return "Hand-edited SLA";
  return `Draft ${p.draftCount}${p.edited ? ", edited" : ""}`;
}
