import { useRef, useState } from "react";
import { useSessionContext } from "@/hooks/session-context";
import { useSessionStorageState } from "@/hooks/use-local-storage-state";
import { selectActiveForm, type RestoredInput } from "@/hooks/use-session";
import { initialAnswers, type QuestionAnswer } from "@/lib/answers";
import { COMPOSER_STORAGE_KEY } from "@/lib/constants";
import type { InputFile } from "@/lib/types";
import { AcceptedBar } from "./accepted-bar";
import { Composer } from "./composer";
import { Thread } from "./thread";

const isString = (v: unknown): v is string => typeof v === "string";

export function ConversationPane() {
  const { state, loadCandidate, newSession, keepRefining } = useSessionContext();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useSessionStorageState(COMPOSER_STORAGE_KEY, "", isString);
  const [inputFile, setInputFile] = useState<InputFile | null>(null);
  // Kept here, not in the form, so the composer can build the reply from the same state.
  const [answersById, setAnswersById] = useState<Record<number, QuestionAnswer[]>>({});

  // Adjusting state while rendering (not in an effect) avoids a frame with stale composer text.
  // The reset comes first so a restore in the same render isn't wiped by it.
  const [prevSessionId, setPrevSessionId] = useState(state.sessionId);
  if (prevSessionId !== state.sessionId) {
    setPrevSessionId(state.sessionId);
    if (state.sessionId === null) {
      setText("");
      setInputFile(null);
      setAnswersById({});
    }
  }
  // Opening a history entry before any session exists leaves the session id alone, but an upload
  // still attached would win over the reopened SLA at send time.
  const [prevSeed, setPrevSeed] = useState(state.historySeed);
  if (prevSeed !== state.historySeed) {
    setPrevSeed(state.historySeed);
    if (state.historySeed !== null) setInputFile(null);
  }
  const [seenRestore, setSeenRestore] = useState<RestoredInput | null>(null);
  const restored = state.restoredInput;
  if (restored && restored !== seenRestore) {
    setSeenRestore(restored);
    setText(restored.text);
    // A history SLA isn't a real file. The composer attaches it straight from the editor.
    setInputFile(restored.file?.origin === "history" ? null : restored.file);
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
        historySeed={state.sessionId ? null : state.historySeed}
        onPickExample={pickExample}
      />
      <div className="shrink-0 border-t bg-background p-3">
        {state.accepted ? (
          <AcceptedBar draft={state.draftCount} sla={state.editedSla} onKeepRefining={keepRefining} />
        ) : (
          <Composer
            text={text}
            onTextChange={setText}
            inputFile={inputFile}
            onInputFileChange={setInputFile}
            form={form}
            inputRef={inputRef}
          />
        )}
      </div>
    </section>
  );
}
