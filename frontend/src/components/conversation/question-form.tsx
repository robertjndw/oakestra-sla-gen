import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { answeredText, type QuestionAnswer } from "@/lib/answers";
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
                {interactive && !frozen ? (
                  q.assumption ? (
                    <AssumptionAnswer
                      n={i + 1}
                      assumption={q.assumption}
                      answer={answer}
                      onChange={(patch) => update(i, patch)}
                    />
                  ) : (
                    <AnswerBox
                      n={i + 1}
                      placeholder="Your answer, or leave it to the model"
                      value={answer.text}
                      onChange={(text) => update(i, { text })}
                    />
                  )
                ) : (
                  <>
                    {q.assumption && <Assumed text={q.assumption} />}
                    {frozen && <Reply q={q} answer={frozen.answers[i]} keepAll={frozen.keepAll} />}
                  </>
                )}
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}

function Assumed({ text }: { text: string }) {
  return (
    <p className="min-w-0 text-sm">
      <strong className="text-amber">Assumed: </strong>
      {text}
    </p>
  );
}

function AnswerBox({
  n,
  placeholder,
  value,
  onChange,
  autoFocus,
}: {
  n: number;
  placeholder: string;
  value: string;
  onChange: (text: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <Textarea
      rows={1}
      className="min-h-9 resize-y"
      aria-label={`Answer to question ${n}`}
      placeholder={placeholder}
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Keeping the assumption is the default, so it shows as the answer until someone changes it. */
function AssumptionAnswer({
  n,
  assumption,
  answer,
  onChange,
}: {
  n: number;
  assumption: string;
  answer: QuestionAnswer;
  onChange: (patch: Partial<QuestionAnswer>) => void;
}) {
  const changeRef = useRef<HTMLButtonElement>(null);
  // Going back to the assumption unmounts the button that had focus; hand it to Change instead
  // of dropping keyboard users at the top of the page.
  const refocusChange = useRef(false);
  useEffect(() => {
    if (answer.mode === "keep" && refocusChange.current) {
      refocusChange.current = false;
      changeRef.current?.focus();
    }
  }, [answer.mode]);

  if (answer.mode === "keep") {
    return (
      <div className="flex items-start justify-between gap-3">
        <Assumed text={assumption} />
        <Button
          ref={changeRef}
          type="button"
          variant="outline"
          size="xs"
          aria-label={`Change the assumption for question ${n}`}
          onClick={() => onChange({ mode: "answer" })}
        >
          Change
        </Button>
      </div>
    );
  }
  return (
    <div
      className="flex flex-col items-start gap-1"
      // Leaving an empty box means the person changed their mind, so show the assumption again.
      // Anything typed stays open so the answer is still visible. Focus moving to the "keep"
      // link counts as staying inside, otherwise the link would vanish while it gets focus.
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        if (!answer.text.trim()) onChange({ mode: "keep" });
      }}
    >
      {/* The text box only appears because Change was just clicked, so typing can start right away. */}
      <AnswerBox n={n} placeholder="Your answer" value={answer.text} onChange={(text) => onChange({ text })} autoFocus />
      <Button
        type="button"
        variant="link"
        size="xs"
        className="h-auto max-w-full px-0 text-muted-foreground"
        onClick={() => {
          refocusChange.current = true;
          onChange({ mode: "keep" });
        }}
      >
        <span className="truncate">{`Keep the assumption (${assumption}) instead`}</span>
      </Button>
    </div>
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
