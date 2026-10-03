import { Message, MessageContent } from "@/components/ai-elements/message";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2Icon, FileTextIcon, OctagonAlertIcon } from "lucide-react";
import type { QuestionAnswer } from "@/lib/answers";
import type { QuestionRound, Round } from "@/hooks/use-session";
import { plural } from "@/lib/format";
import type { Sla } from "@/lib/types";
import { Attempts } from "./attempts";
import { PendingRound } from "./pending-round";
import { QuestionForm } from "./question-form";
import { StatusHead } from "./status-head";

export interface RoundViewProps {
  round: Round;
  /** Id of the round whose question form takes input, if any. */
  activeFormId: number | null;
  answers: QuestionAnswer[];
  onAnswersChange: (answers: QuestionAnswer[]) => void;
  loadCandidate: (sla: Sla) => void;
  newSession: () => void;
}

export function RoundView({ round, activeFormId, answers, onAnswersChange, loadCandidate, newSession }: RoundViewProps) {
  switch (round.kind) {
    case "user":
      return (
        <Message from="user">
          <MessageContent>
            {round.fileName && (
              <Badge variant="outline" className="max-w-full bg-background">
                <FileTextIcon aria-hidden />
                <span className="truncate">{round.fileName}</span>
              </Badge>
            )}
            <p className="whitespace-pre-wrap break-words">{round.text}</p>
          </MessageContent>
        </Message>
      );
    case "pending":
      return <PendingRound first={round.first} startedAt={round.startedAt} />;
    case "draft":
    case "ask":
      return (
        <QuestionRoundView
          round={round}
          interactive={round.id === activeFormId}
          answers={answers}
          onAnswersChange={onAnswersChange}
        />
      );
    case "failed": {
      const shown = round.errors.slice(0, 5);
      return (
        <Message from="assistant">
          <MessageContent className="w-full">
            <Alert variant="destructive">
              <OctagonAlertIcon />
              <AlertTitle>{`No valid draft. Gave up after ${plural(round.attempts.length || 1, "attempt")}`}</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                {shown.length > 0 && (
                  <ul className="list-disc space-y-0.5 pl-4">
                    {shown.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                    {round.errors.length > 5 && <li>{`and ${round.errors.length - 5} more`}</li>}
                  </ul>
                )}
                <p>
                  {round.unchangedDraft !== null
                    ? `Draft ${round.unchangedDraft} is unchanged. Add detail or rephrase, then send again.`
                    : "Add detail or rephrase, then send again. More attempts per round can also help, but Settings only change for a new session."}
                </p>
                {round.lastCandidate && (
                  <div>
                    <Button type="button" variant="outline" size="sm" onClick={() => loadCandidate(round.lastCandidate!)}>
                      Fix the last attempt by hand
                    </Button>
                  </div>
                )}
                <div className="text-foreground">
                  <Attempts attempts={round.attempts} />
                </div>
              </AlertDescription>
            </Alert>
          </MessageContent>
        </Message>
      );
    }
    case "notice":
      return (
        <Message from="assistant">
          <MessageContent className="w-full">
            <Alert>
              <OctagonAlertIcon />
              <AlertTitle>{round.title}</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                {round.detail && <p>{round.detail}</p>}
                {round.help && <p>{round.help}</p>}
                {round.action === "new-session" && (
                  <div>
                    <Button type="button" size="sm" onClick={newSession}>
                      Start a new session
                    </Button>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          </MessageContent>
        </Message>
      );
    case "accepted":
      return (
        <p className="flex items-center gap-2 text-sm text-primary" role="status">
          <CheckCircle2Icon className="size-4" aria-hidden />
          {`You accepted draft ${round.draft}`}
        </p>
      );
  }
}

function QuestionRoundView({
  round,
  interactive,
  answers,
  onAnswersChange,
}: {
  round: QuestionRound;
  interactive: boolean;
  answers: QuestionAnswer[];
  onAnswersChange: (answers: QuestionAnswer[]) => void;
}) {
  const n = round.questions.length;
  const isDraft = round.kind === "draft";
  let note: string | null = null;
  if (n > 0 && interactive) {
    note = isDraft
      ? `The model had to guess ${n === 1 ? "one thing" : `${n} things`}. Keep each assumption or answer it.`
      : "Answer what you can so the model can draft an SLA.";
  } else if (n === 0 && isDraft) {
    note = "No open questions. Accept the draft or describe another change.";
  }
  const title = isDraft ? `Draft ${round.draft}` : "Needs more detail";
  const meta = isDraft
    ? round.attempts.length > 1
      ? `Passed validation on attempt ${round.attempts.length}`
      : "Passed validation"
    : round.unchangedDraft !== null
      ? `Draft ${round.unchangedDraft} is unchanged`
      : "No draft yet";
  return (
    <Message from="assistant">
      <MessageContent className="gap-3">
        <StatusHead status={isDraft ? "ok" : "ask"} title={title} meta={meta} />
        {isDraft && (
          <ul className="list-disc space-y-0.5 pl-5">
            {round.changes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        )}
        {note && <p className="text-muted-foreground">{note}</p>}
        {n > 0 && (
          <QuestionForm
            questions={round.questions}
            answers={answers}
            onChange={onAnswersChange}
            frozen={round.frozen}
            interactive={interactive}
          />
        )}
        <Attempts attempts={round.attempts} />
      </MessageContent>
    </Message>
  );
}
