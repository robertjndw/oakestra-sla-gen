import { useRef, useState } from "react";
import { useSessionContext } from "@/hooks/session-context";
import { selectActiveForm, type ComposeFile, type RestoredInput } from "@/hooks/use-session";
import { initialAnswers, type QuestionAnswer } from "@/lib/answers";
import { AcceptedBar } from "./accepted-bar";
import { Composer } from "./composer";
import { Thread } from "./thread";

export function ConversationPane() {
  const { state, loadCandidate, newSession, keepRefining } = useSessionContext();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [composeFile, setComposeFile] = useState<ComposeFile | null>(null);
  // Kept here, not in the form, so the composer can build the reply from the same state.
  const [answersById, setAnswersById] = useState<Record<number, QuestionAnswer[]>>({});

  // Adjusting state while rendering (not in an effect) avoids a frame with stale composer text.
  const [seenRestore, setSeenRestore] = useState<RestoredInput | null>(null);
  const restored = state.restoredInput;
  if (restored && restored !== seenRestore) {
    setSeenRestore(restored);
    setText(restored.text);
    setComposeFile(restored.compose);
  }
  const [prevSessionId, setPrevSessionId] = useState(state.sessionId);
  if (prevSessionId !== state.sessionId) {
    setPrevSessionId(state.sessionId);
    if (state.sessionId === null) {
      setText("");
      setComposeFile(null);
      setAnswersById({});
    }
  }

  const activeRound = selectActiveForm(state);
  const activeFormId = activeRound?.id ?? null;
  const activeAnswers = activeRound
    ? (answersById[activeRound.id] ?? initialAnswers(activeRound.questions))
    : [];
  const form = activeRound ? { questions: activeRound.questions, answers: activeAnswers } : null;

  const pickExample = (example: string) => {
    setText(example);
    inputRef.current?.focus();
  };

  return (
    <section aria-label="Conversation" className="flex min-h-0 min-w-0 flex-col border-b lg:border-r lg:border-b-0">
      <Thread
        rounds={state.rounds}
        activeFormId={activeFormId}
        answers={activeAnswers}
        onAnswersChange={(a) => activeRound && setAnswersById((m) => ({ ...m, [activeRound.id]: a }))}
        loadCandidate={loadCandidate}
        newSession={newSession}
        onPickExample={pickExample}
      />
      <div className="shrink-0 border-t bg-background p-3">
        {state.accepted ? (
          <AcceptedBar draft={state.draftCount} sla={state.editedSla} onKeepRefining={keepRefining} />
        ) : (
          <Composer
            text={text}
            onTextChange={setText}
            composeFile={composeFile}
            onComposeFileChange={setComposeFile}
            form={form}
            inputRef={inputRef}
          />
        )}
      </div>
    </section>
  );
}
