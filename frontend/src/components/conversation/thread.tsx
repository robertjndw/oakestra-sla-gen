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

const EMPTY_STATE_CLASS = "slagen:flex slagen:size-full slagen:flex-col slagen:items-start slagen:justify-start slagen:p-2 slagen:text-left";

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
      <MessageScroller className="slagen:min-h-0 slagen:flex-1">
        <MessageScrollerViewport aria-label="Conversation">
          <MessageScrollerContent className="slagen:gap-5 slagen:p-4">
            {rounds.length === 0 && historySeed !== null ? (
              <div className={EMPTY_STATE_CLASS + " slagen:gap-2"}>
                <h1 className="slagen:text-lg slagen:font-semibold">Continue from the history</h1>
                <p className="slagen:max-w-prose slagen:text-muted-foreground slagen:text-sm slagen:leading-relaxed">
                  &ldquo;{historySeed}&rdquo; is open on the right. Describe a change to keep working on it with the
                  model, or just download it. Any edits you make in the Code view are sent with your first message.
                </p>
              </div>
            ) : rounds.length === 0 ? (
              <div className={EMPTY_STATE_CLASS + " slagen:gap-6"}>
                <div className="slagen:space-y-2">
                  <h1 className="slagen:text-lg slagen:font-semibold">Describe your deployment</h1>
                  <p className="slagen:max-w-prose slagen:text-muted-foreground slagen:text-sm slagen:leading-relaxed">
                    Name the images, ports, resources and which services talk to each other. The model drafts an SLA,
                    validates it against Oakestra&apos;s schema and asks about anything it had to guess. You can also
                    attach a Docker Compose file or an existing SLA.
                  </p>
                </div>
                <div className="slagen:w-full slagen:space-y-2">
                  <h2 className="slagen:text-muted-foreground slagen:text-xs slagen:font-medium">Examples</h2>
                  <ul className="slagen:divide-y slagen:overflow-hidden slagen:rounded-lg slagen:border slagen:bg-card">
                    {EXAMPLE_PROMPTS.map((ex) => (
                      <li key={ex.text}>
                        <button
                          type="button"
                          className="slagen:flex slagen:w-full slagen:cursor-pointer slagen:flex-col slagen:gap-0.5 slagen:px-3 slagen:py-2.5 slagen:text-left slagen:text-sm slagen:outline-none slagen:hover:bg-muted/60 slagen:focus-visible:bg-muted/60 slagen:focus-visible:ring-2 slagen:focus-visible:ring-ring slagen:focus-visible:ring-inset"
                          onClick={() => onPickExample(ex.text)}
                        >
                          <span>{ex.text}</span>
                          {ex.note && <span className="slagen:text-muted-foreground slagen:text-xs">{ex.note}</span>}
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
