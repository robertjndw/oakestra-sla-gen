import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
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

export function Thread({ rounds, onPickExample, historySeed, ...rest }: Props) {
  return (
    <Conversation className="min-h-0 flex-1" aria-live="polite" aria-label="Conversation">
      <ConversationContent className="gap-4">
        {rounds.length === 0 && historySeed !== null ? (
          <ConversationEmptyState className="items-start justify-start gap-2 p-2 text-left">
            <h1 className="text-xl font-semibold tracking-tight">Continue from the history</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              &ldquo;{historySeed}&rdquo; is open on the right. Describe a change to keep working on it with the
              model, or just download it. Any edits you make in the Code view are sent with your first message.
            </p>
          </ConversationEmptyState>
        ) : rounds.length === 0 ? (
          <ConversationEmptyState className="items-start justify-start gap-4 p-2 text-left">
            <div className="space-y-2">
              <h1 className="text-xl font-semibold tracking-tight">Describe what you want to deploy</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Write it the way you&apos;d explain it to a colleague: images, ports, resources, and which services
                talk to each other. The model drafts an SLA, checks it against Oakestra&apos;s schema, and asks about
                anything it had to guess. You can also upload a docker compose file to translate, or an existing SLA
                to change through the chat, or drop either onto the composer.
              </p>
            </div>
            <div className="w-full space-y-2">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Or start from an example
              </p>
              <div className="flex flex-col gap-2">
                {EXAMPLE_PROMPTS.map((ex) => (
                  <Item key={ex.text} variant="outline" size="sm" asChild>
                    <button
                      type="button"
                      className="cursor-pointer text-left hover:bg-muted"
                      onClick={() => onPickExample(ex.text)}
                    >
                      <ItemContent className="gap-0.5">
                        <ItemTitle className="line-clamp-none font-normal">{ex.text}</ItemTitle>
                        {ex.note && <ItemDescription className="text-xs">{ex.note}</ItemDescription>}
                      </ItemContent>
                    </button>
                  </Item>
                ))}
              </div>
            </div>
          </ConversationEmptyState>
        ) : (
          rounds.map((round) => (
            <RoundView
              key={round.id}
              round={round}
              activeFormId={rest.activeFormId}
              answers={round.id === rest.activeFormId ? rest.answers : []}
              onAnswersChange={rest.onAnswersChange}
              loadCandidate={rest.loadCandidate}
              newSession={rest.newSession}
            />
          ))
        )}
      </ConversationContent>
      <ConversationScrollButton aria-label="Scroll to latest message" />
    </Conversation>
  );
}
