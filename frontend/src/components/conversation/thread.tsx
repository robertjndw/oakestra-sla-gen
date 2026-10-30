import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { EXAMPLE_PROMPTS } from "@/lib/constants";
import type { Round } from "@/hooks/use-session";
import type { QuestionAnswer } from "@/lib/answers";
import type { Sla } from "@/lib/types";
import { RoundView } from "./round-view";

interface Props {
  rounds: Round[];
  activeFormId: number | null;
  answers: QuestionAnswer[];
  onAnswersChange: (answers: QuestionAnswer[]) => void;
  loadCandidate: (sla: Sla) => void;
  newSession: () => void;
  /** Title of the SLA reopened from the history, before the first message. */
  historySeed: string | null;
  onPickExample: (text: string) => void;
}

const EMPTY_STATE_CLASS = "flex size-full flex-col items-start justify-start p-2 text-left";

export function Thread({
  rounds,
  activeFormId,
  answers,
  onAnswersChange,
  loadCandidate,
  newSession,
  historySeed,
  onPickExample,
}: Props) {
  return (
    <MessageScrollerProvider autoScroll>
      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport aria-label="Conversation">
          <MessageScrollerContent className="gap-5 p-4">
            {rounds.length === 0 && historySeed !== null ? (
              <div className={EMPTY_STATE_CLASS + " gap-2"}>
                <h1 className="text-lg font-semibold">Continue from the history</h1>
                <p className="max-w-prose text-muted-foreground text-sm leading-relaxed">
                  &ldquo;{historySeed}&rdquo; is open on the right. Describe a change to keep working on it with the
                  model, or just download it. Any edits you make in the Code view are sent with your first message.
                </p>
              </div>
            ) : rounds.length === 0 ? (
              <div className={EMPTY_STATE_CLASS + " gap-6"}>
                <div className="space-y-2">
                  <h1 className="text-lg font-semibold">Describe your deployment</h1>
                  <p className="max-w-prose text-muted-foreground text-sm leading-relaxed">
                    Name the images, ports, resources and which services talk to each other. The model drafts an SLA,
                    validates it against Oakestra&apos;s schema and asks about anything it had to guess. You can also
                    attach a Docker Compose file or an existing SLA.
                  </p>
                </div>
                <div className="w-full space-y-2">
                  <h2 className="text-muted-foreground text-xs font-medium">Examples</h2>
                  <ul className="divide-y overflow-hidden rounded-lg border bg-card">
                    {EXAMPLE_PROMPTS.map((ex) => (
                      <li key={ex.text}>
                        <button
                          type="button"
                          className="flex w-full cursor-pointer flex-col gap-0.5 px-3 py-2.5 text-left text-sm outline-none hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                          onClick={() => onPickExample(ex.text)}
                        >
                          <span>{ex.text}</span>
                          {ex.note && <span className="text-muted-foreground text-xs">{ex.note}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              rounds.map((round) => (
                <MessageScrollerItem key={round.id} messageId={String(round.id)} scrollAnchor={round.kind === "user"}>
                  <RoundView
                    round={round}
                    activeFormId={activeFormId}
                    answers={round.id === activeFormId ? answers : []}
                    onAnswersChange={onAnswersChange}
                    loadCandidate={loadCandidate}
                    newSession={newSession}
                  />
                </MessageScrollerItem>
              ))
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton aria-label="Scroll to latest message" />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
