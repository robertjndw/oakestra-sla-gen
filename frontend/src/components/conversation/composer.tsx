import { useRef, useState, type DragEvent, type KeyboardEvent, type RefObject } from "react";
import { FileTextIcon, PaperclipIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSessionContext } from "@/hooks/session-context";
import type { InputFile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { composerModel, readInputFile, type ActiveForm } from "./composer-logic";

const IS_MAC = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform || globalThis.navigator?.userAgent || "");
const ACCEPT = ".yml,.yaml,.json,application/x-yaml,text/yaml,application/json";
const KIND_LABEL = { compose: "Compose", sla: "SLA" } as const;

interface Props {
  text: string;
  onTextChange: (text: string) => void;
  inputFile: InputFile | null;
  onInputFileChange: (file: InputFile | null) => void;
  form: ActiveForm | null;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}

export function Composer({ text, onTextChange, inputFile, onInputFileChange, form, inputRef }: Props) {
  const { state, settingsLocked, send, answer, accept } = useSessionContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const { turnRunning } = state;
  // Only the first message can carry a file.
  const canAttach = !settingsLocked && !turnRunning;
  const model = composerModel({
    sessionId: state.sessionId,
    turnRunning,
    hasModelDraft: !!state.modelSla,
    form,
    text,
    inputFile,
  });

  const attach = async (file: File) => {
    const res = await readInputFile(file);
    if (!res.ok) {
      toast.error("File too large", { description: res.error });
      return;
    }
    onInputFileChange(res.file);
    inputRef.current?.focus();
  };

  const submit = () => {
    if (!model.canSend) return;
    const extra = text;
    const file = inputFile;
    onTextChange("");
    onInputFileChange(null);
    if (form) void answer(model.message, { answers: form.answers, extra });
    else void send(extra, file);
  };

  // Enter is a newline and Cmd/Ctrl+Enter sends. PromptInputTextarea would submit on a plain
  // Enter, so this runs in the capture phase and stops the event before its own handler.
  const onKeyDownCapture = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.stopPropagation();
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      submit();
    }
  };

  const isFileDrag = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

  return (
    <div
      className={cn("rounded-xl", dragOver && "ring-2 ring-primary/60")}
      onDragOver={(e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault(); // otherwise the browser navigates to the dropped file
        setDragOver(canAttach);
      }}
      onDragLeave={(e) => {
        // Fires when moving onto a child too, so only clear once the pointer really left.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
      }}
      // Stop the drop here, or PromptInput queues the file as one of its own attachments too.
      // Those only give us a blob URL, and we need the text right away to tell compose from SLA
      // and to enforce the size limit, so readInputFile handles all uploads.
      onDropCapture={(e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file && canAttach) void attach(file);
      }}
    >
      <PromptInput onSubmit={submit} aria-label="Message composer">
        {!settingsLocked && inputFile && (
          <PromptInputHeader className="px-3 pt-3">
            <Badge variant="secondary" className="h-6 max-w-full gap-1.5 pr-0.5">
              <FileTextIcon aria-hidden />
              <span data-testid="file-chip-kind">{KIND_LABEL[inputFile.kind]}</span>
              <span className="truncate font-normal" data-testid="file-chip-name">
                {inputFile.name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-5 rounded-full"
                aria-label={`Remove ${inputFile.name}`}
                onClick={() => {
                  onInputFileChange(null);
                  inputRef.current?.focus();
                }}
              >
                <XIcon aria-hidden />
              </Button>
            </Badge>
          </PromptInputHeader>
        )}
        <PromptInputBody>
          <PromptInputTextarea
            ref={inputRef}
            aria-label={model.ariaLabel}
            value={text}
            onChange={(e) => onTextChange(e.currentTarget.value)}
            onKeyDownCapture={onKeyDownCapture}
            placeholder={model.placeholder}
            disabled={turnRunning}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept={ACCEPT}
              aria-label="Docker compose file or SLA"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (file) void attach(file);
              }}
            />
            {!settingsLocked && (
              <PromptInputButton
                disabled={!canAttach}
                onClick={() => fileInputRef.current?.click()}
                aria-label="Upload docker compose or SLA"
              >
                <PaperclipIcon className="size-4" />
                Upload compose or SLA
              </PromptInputButton>
            )}
            <Hint kind={model.hint} action={state.sessionId ? "update" : "generate"} />
          </PromptInputTools>
          <div className="flex items-center gap-1.5">
            {state.sessionId && state.modelSla && (
              <Button
                type="button"
                variant={model.acceptPrimary ? "default" : "outline"}
                size="sm"
                disabled={turnRunning}
                onClick={accept}
              >
                Accept draft
              </Button>
            )}
            <PromptInputSubmit
              size="sm"
              // Only one primary action at a time; with nothing typed, Accept is the next step.
              variant={model.acceptPrimary ? "outline" : "default"}
              className="px-3"
              status={turnRunning ? "submitted" : undefined}
              disabled={!model.canSend}
              aria-label={model.label}
            >
              {turnRunning ? undefined : model.label}
            </PromptInputSubmit>
          </div>
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

function Hint({ kind, action }: { kind: ReturnType<typeof composerModel>["hint"]; action: string }) {
  if (!kind) return null;
  const cls = "hidden text-muted-foreground text-xs sm:inline";
  if (kind === "answer-or-change") {
    return <span className={cls}>Answer a question or describe a change. Happy with the assumptions? Accept the draft.</span>;
  }
  if (kind === "answer-one") {
    return <span className={cls}>Answer at least one question so the model can draft an SLA.</span>;
  }
  return (
    <span className={cls}>
      <kbd className="font-sans">{IS_MAC ? "⌘" : "Ctrl"}</kbd> <kbd className="font-sans">Enter</kbd>
      {` to ${action}`}
    </span>
  );
}
