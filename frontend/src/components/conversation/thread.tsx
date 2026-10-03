import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
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
  onPickExample: (text: string) => void;
}

export function Thread({ rounds, onPickExample, ...rest }: Props) {
  return (
    <Conversation className="min-h-0 flex-1" aria-live="polite" aria-label="Conversation">
      <ConversationContent className="gap-4">
        {rounds.length === 0 ? (
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
              <Suggestions className="w-full flex-col items-stretch gap-2">
                {EXAMPLE_PROMPTS.map((ex) => (
                  <Suggestion
                    key={ex.text}
                    suggestion={ex.text}
                    onClick={onPickExample}
                    className="h-auto flex-col items-start justify-start gap-0.5 rounded-lg px-3 py-2 text-left font-normal whitespace-normal"
                  >
                    <span>{ex.text}</span>
                    {ex.note && <span className="text-muted-foreground text-xs">{ex.note}</span>}
                  </Suggestion>
                ))}
              </Suggestions>
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
