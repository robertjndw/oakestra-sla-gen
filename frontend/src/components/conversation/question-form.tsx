import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { answeredText, type AnswerMode, type QuestionAnswer } from "@/lib/answers";
import type { FrozenAnswers } from "@/hooks/use-session";
import type { Clarification } from "@/lib/types";

interface Props {
  questions: Clarification[];
  /** Current answers while the form is open. Ignored once frozen. */
  answers: QuestionAnswer[];
  onChange: (answers: QuestionAnswer[]) => void;
  /** Set once the user replied; the form becomes a read-only record. */
  frozen: FrozenAnswers | null;
  /** Only the newest open form takes input; older ones can never be reopened. */
  interactive: boolean;
}

export function QuestionForm({ questions, answers, onChange, frozen, interactive }: Props) {
  const update = (i: number, patch: Partial<QuestionAnswer>) =>
    onChange(answers.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  return (
    <ol className="flex flex-col gap-2" aria-label="Questions from the model">
      {questions.map((q, i) => {
        const answer = answers[i] ?? { mode: q.assumption ? "keep" : "answer", text: "" };
        return (
          <li key={i}>
            <Card size="sm" className="gap-2 py-3">
              <CardContent className="flex flex-col gap-2 px-3">
                {q.topic && (
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    {q.topic}
                  </span>
                )}
                <p className="text-sm font-medium">{`${i + 1}. ${q.question}`}</p>
                {q.assumption && (
                  <p className="text-sm">
                    <strong className="text-amber">Assumed: </strong>
                    {q.assumption}
                  </p>
                )}
                {frozen ? (
                  <Reply q={q} answer={frozen.answers[i]} keepAll={frozen.keepAll} />
                ) : interactive ? (
                  <div className="flex flex-col gap-2">
                    {q.assumption && (
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        size="sm"
                        spacing={0}
                        value={answer.mode}
                        aria-label={`Question ${i + 1}`}
                        // Radix reports "" when the active item is clicked again; keep the mode instead.
                        onValueChange={(v) => v && update(i, { mode: v as AnswerMode })}
                      >
                        <ToggleGroupItem value="keep">Keep assumption</ToggleGroupItem>
                        <ToggleGroupItem value="answer">Answer</ToggleGroupItem>
                      </ToggleGroup>
                    )}
                    {answer.mode === "answer" && (
                      <Textarea
                        rows={1}
                        className="min-h-9 resize-y"
                        aria-label={`Answer to question ${i + 1}`}
                        placeholder={q.assumption ? "Your answer" : "Your answer, or leave it to the model"}
                        value={answer.text}
                        onChange={(e) => update(i, { text: e.target.value })}
                      />
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}

function Reply({ q, answer, keepAll }: { q: Clarification; answer?: QuestionAnswer; keepAll: boolean }) {
  const text = keepAll || !answer ? "" : answeredText(answer);
  if (text) return <p className="text-sm text-primary">{`You: ${text}`}</p>;
  return (
    <p className="text-muted-foreground text-sm">
      {q.assumption ? `Kept: ${q.assumption}` : "Left to the model"}
    </p>
  );
}
