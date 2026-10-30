import { LocateFixedIcon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { highlightField, releaseFields, unhighlightField, useServiceMounted } from "@/components/output/field-highlight";
import { focusField } from "@/components/output/focus-service";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { answeredText, type QuestionAnswer } from "@/lib/answers";
import { describeFieldRef, parseFieldRef, type FieldRef } from "@/lib/field-ref";
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
  const refs = useMemo(() => questions.map((q) => parseFieldRef(q.field)), [questions]);
  // A question can disappear while hovered or focused, e.g. when a new round replaces the form.
  useEffect(() => () => releaseFields(refs), [refs]);

  return (
    <ol className="divide-y overflow-hidden rounded-lg border bg-card" aria-label="Questions from the model">
      {questions.map((q, i) => {
        const answer = answers[i] ?? { mode: q.assumption ? "keep" : "answer", text: "" };
        const ref = refs[i];
        return (
          <li
            key={i}
            className="flex gap-3 px-3 py-3"
            onPointerEnter={() => highlightField(ref, "hover")}
            onPointerLeave={() => unhighlightField(ref, "hover")}
            onFocus={() => highlightField(ref, "focus")}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) unhighlightField(ref, "focus");
            }}
          >
            <span aria-hidden className="w-3 shrink-0 text-right text-muted-foreground text-xs tabular-nums leading-5">
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {/* The topic is the short handle, so it leads and the full question follows. */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <span className="sr-only">{`Question ${i + 1}: `}</span>
                  {q.topic && <p className="text-sm font-medium">{q.topic}</p>}
                  <p className={q.topic ? "text-muted-foreground text-sm" : "text-sm font-medium"}>{q.question}</p>
                </div>
                {ref && <ShowField fieldRef={ref} />}
              </div>
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
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Only offered while the service's card is on screen, i.e. the Visual view shows it. */
function ShowField({ fieldRef }: { fieldRef: FieldRef }) {
  const shown = useServiceMounted(fieldRef.service);
  if (!shown) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="-mt-0.5 shrink-0 text-muted-foreground"
      aria-label={`Show ${describeFieldRef(fieldRef)}`}
      onClick={() => focusField(fieldRef)}
    >
      <LocateFixedIcon />
      Show
    </Button>
  );
}

function Assumed({ text }: { text: string }) {
  return (
    <p className="min-w-0 text-sm">
      <span className="mr-2 text-amber text-xs font-medium">Assumed</span>
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
      <div className="flex items-baseline justify-between gap-3">
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
