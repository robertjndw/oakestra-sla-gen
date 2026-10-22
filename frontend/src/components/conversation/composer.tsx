import { useRef, useState, type DragEvent, type KeyboardEvent, type RefObject } from "react";
import { FileTextIcon, HistoryIcon, PaperclipIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
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
  const { state, settingsLocked, send, answer, accept, newSession } = useSessionContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const { turnRunning } = state;
  // Only the first message can carry a file.
  const canAttach = !settingsLocked && !turnRunning;
  // A reopened history SLA is read from the editor at send time, so edits made after opening
  // it are sent too. An upload still wins. It is hidden while the first message is out, like an
  // upload, so its remove button can't start over under a running turn.
  const seedFile: InputFile | null =
    !state.sessionId && !turnRunning && state.historySeed !== null && state.editedSla.trim()
      ? { name: state.historySeed, text: state.editedSla, kind: "sla", origin: "history" }
      : null;
  const attached = inputFile ?? seedFile;
  const model = composerModel({
    sessionId: state.sessionId,
    turnRunning,
    hasModelDraft: !!state.modelSla,
    form,
    text,
    inputFile: attached,
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
    const file = attached;
    onTextChange("");
    onInputFileChange(null);
    if (form) void answer(model.message, { answers: form.answers, extra });
    else void send(extra, file);
  };

  // Enter is a newline and Cmd/Ctrl+Enter sends.
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
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
      // The text is needed right away to tell compose from SLA and to enforce the size limit,
      // so readInputFile handles all uploads. Capture so the textarea never inserts the file.
      onDropCapture={(e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file && canAttach) void attach(file);
      }}
    >
      <form
        aria-label="Message composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <InputGroup className="overflow-hidden">
          {!settingsLocked && attached && (
            <InputGroupAddon align="block-start" className="flex-wrap gap-1">
              <Badge variant="secondary" className="h-6 max-w-full gap-1.5 pr-0.5">
                {attached.origin === "history" ? <HistoryIcon aria-hidden /> : <FileTextIcon aria-hidden />}
                <span data-testid="file-chip-kind">
                  {attached.origin === "history" ? "From history" : KIND_LABEL[attached.kind]}
                </span>
                <span className="truncate font-normal" data-testid="file-chip-name">
                  {attached.name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-5 rounded-full"
                  aria-label={`Remove ${attached.name}`}
                  onClick={() => {
                    // The reopened SLA lives in the editor, so dropping it means starting over.
                    if (attached === seedFile) newSession();
                    else onInputFileChange(null);
                    inputRef.current?.focus();
                  }}
                >
                  <XIcon aria-hidden />
                </Button>
              </Badge>
            </InputGroupAddon>
          )}
          <InputGroupTextarea
            ref={inputRef}
            name="message"
            className="field-sizing-content max-h-48 min-h-16"
            aria-label={model.ariaLabel}
            value={text}
            onChange={(e) => onTextChange(e.currentTarget.value)}
            onKeyDown={onKeyDown}
            placeholder={model.placeholder}
            disabled={turnRunning}
          />
          <InputGroupAddon align="block-end" className="justify-between gap-1">
            <div className="flex min-w-0 items-center gap-1">
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
                <InputGroupButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!canAttach}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Upload docker compose or SLA"
                >
                  <PaperclipIcon className="size-4" />
                  Upload compose or SLA
                </InputGroupButton>
              )}
              <Hint kind={model.hint} action={state.sessionId ? "update" : "generate"} />
            </div>
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
              <InputGroupButton
                type="submit"
                size="sm"
                // Only one primary action at a time; with nothing typed, Accept is the next step.
                variant={model.acceptPrimary ? "outline" : "default"}
                className="px-3"
                disabled={!model.canSend}
                aria-label={model.label}
              >
                {turnRunning ? <Spinner /> : model.label}
              </InputGroupButton>
            </div>
          </InputGroupAddon>
        </InputGroup>
      </form>
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
