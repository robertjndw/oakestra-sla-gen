import { json } from "@codemirror/lang-json";
import { lintGutter, setDiagnostics } from "@codemirror/lint";
import { Chunk, getChunks, getOriginalDoc, goToNextChunk, goToPreviousChunk, unifiedMergeView, updateOriginalDoc } from "@codemirror/merge";
import { ChangeSet, Text } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { plural } from "@/lib/format";
import type { DiffBase } from "./diff-base";
import { ProblemsList } from "./problems-list";
import type { ProblemItem } from "./problems";
import { toDiagnostics } from "./problems";
import { jsonTokenColors } from "./syntax-plugin";
import { useIsDark } from "@/hooks/use-is-dark";
import "./output.css";

interface Props {
  text: string;
  items: ProblemItem[];
  status: string;
  /** Names the text to go back to (a model draft or a saved SLA); null hides the button. */
  resetLabel: string | null;
  /** The text differs from it. */
  canReset: boolean;
  /** An older draft is shown, not the working copy. */
  readOnly: boolean;
  /** What "Show changes" compares with; null hides the switch. */
  diff: DiffBase | null;
  showDiff: boolean;
  onShowDiffChange: (show: boolean) => void;
  onChange: (text: string) => void;
  onReset: () => void;
}

function editorTheme(dark: boolean) {
  return EditorView.theme(
    {
      "&": {
        height: "100%",
        backgroundColor: "var(--card)",
        color: "var(--foreground)",
        fontSize: "12.5px",
      },
      ".cm-scroller": {
        fontFamily: "var(--font-mono)",
        lineHeight: "1.6",
      },
      ".cm-content": { caretColor: "var(--foreground)" },
      "&.cm-focused": { outline: "none" },
      ".cm-cursor": { borderLeftColor: "var(--foreground)" },
      ".cm-gutters": {
        backgroundColor: "var(--card)",
        color: "var(--muted-foreground)",
        border: "none",
        borderRight: "1px solid var(--border)",
        paddingLeft: "8px",
      },
      ".cm-activeLine": { backgroundColor: "color-mix(in oklab, var(--muted) 70%, transparent)" },
      ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--foreground)" },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
        backgroundColor: "color-mix(in oklab, var(--primary) 28%, transparent)",
      },
      ".cm-tooltip": {
        backgroundColor: "var(--popover)",
        color: "var(--popover-foreground)",
        border: "1px solid var(--border)",
        borderRadius: "6px",
      },
      ".cm-placeholder": { color: "var(--muted-foreground)" },
      // The merge package's own colors are fixed reds and greens for light and dark. These
      // selectors match the specificity of its &light/&dark rules, and a theme always wins a tie
      // with a base theme.
      "&.cm-merge-b .cm-changedLine": { backgroundColor: "var(--accent)" },
      "&.cm-merge-b .cm-changedText": {
        background: "color-mix(in oklab, var(--primary) 24%, transparent)",
      },
      ".cm-deletedChunk": {
        backgroundColor: "var(--rust-soft)",
        color: "var(--foreground)",
      },
      "& .cm-deletedChunk .cm-deletedText, &.cm-merge-b .cm-deletedText": {
        background: "color-mix(in oklab, var(--rust) 24%, transparent)",
      },
      "&.cm-merge-b .cm-changedLineGutter": { background: "var(--primary)" },
      "& .cm-deletedLineGutter": { background: "var(--rust)" },
    },
    { dark },
  );
}

const staticExtensions = [
  json(),
  jsonTokenColors,
  lintGutter(),
  EditorView.contentAttributes.of({ "aria-label": "SLA JSON", spellcheck: "false" }),
];

// The merge view's own default; the change count has to use the same one to agree with it.
const DIFF_CONFIG = { scanLimit: 500 };

const toDoc = (s: string) => Text.of(s.split(/\r?\n/));

function mergeExtensions(original: string) {
  return unifiedMergeView({
    original,
    mergeControls: false,
    // Deleted lines would get the language's fallback highlighter, whose colors are light-only.
    syntaxHighlightDeletions: false,
    diffConfig: DIFF_CONFIG,
  });
}

function diffStatus(diff: DiffBase, changes: number, readOnly: boolean): string {
  const count = plural(changes, "change");
  let line: string;
  if (diff.edits) line = changes ? `Your edits: ${count} from ${diff.against}.` : `Your edits match ${diff.against}.`;
  else line = changes ? `${count} since ${diff.against}.` : `No changes since ${diff.against}.`;
  return readOnly ? line : `${line} Read-only while changes show.`;
}

export default function CodeView({
  text,
  items,
  status,
  resetLabel,
  canReset,
  readOnly,
  diff,
  showDiff,
  onShowDiffChange,
  onChange,
  onReset,
}: Props) {
  const dark = useIsDark();
  const switchId = useId();
  const [view, setView] = useState<EditorView | null>(null);
  const theme = useMemo(() => editorTheme(dark), [dark]);
  const original = showDiff && diff ? diff.original : null;
  const extensions = useMemo(
    () => (original === null ? staticExtensions : [...staticExtensions, mergeExtensions(original)]),
    [original],
  );
  const changes = useMemo(
    () => (original === null ? 0 : Chunk.build(toDoc(original), toDoc(text), DIFF_CONFIG).length),
    [original, text],
  );

  useEffect(() => {
    if (!view) return;
    view.dispatch(setDiagnostics(view.state, toDiagnostics(view.state.doc, items)));
  }, [view, items]);

  // A reconfigure keeps the merge view's original document from when it was switched on, so a
  // new base (a draft arriving, a reset) has to be handed over as an effect.
  useEffect(() => {
    if (!view || original === null || !getChunks(view.state)) return;
    const current = getOriginalDoc(view.state);
    const next = toDoc(original);
    if (current.eq(next)) return;
    view.dispatch({
      effects: updateOriginalDoc.of({
        doc: next,
        changes: ChangeSet.of({ from: 0, to: current.length, insert: next }, current.length),
      }),
    });
  }, [view, original]);

  function goToLine(line: number) {
    if (!view) return;
    const info = view.state.doc.line(Math.min(Math.max(line, 1), view.state.doc.lines));
    view.dispatch({
      selection: { anchor: info.from, head: info.to },
      effects: EditorView.scrollIntoView(info.from, { y: "center" }),
    });
    view.focus();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-80 flex-1">
        <div className="absolute inset-0">
          <CodeMirror
            value={text}
            height="100%"
            className="h-full"
            theme={theme}
            extensions={extensions}
            readOnly={readOnly || original !== null}
            placeholder="The SLA JSON appears here once the model has drafted one."
            basicSetup={{ foldGutter: false, autocompletion: false, highlightSelectionMatches: false }}
            onChange={onChange}
            onCreateEditor={setView}
          />
        </div>
      </div>
      <div className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-4 py-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {diff && original !== null ? diffStatus(diff, changes, readOnly) : status}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {original !== null && changes > 0 && (
            // The editor keeps its scroll position but not focus, so these work from the keyboard
            // without pulling focus into a read-only document.
            <div role="group" aria-label="Changes" className="flex items-center">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Previous change"
                disabled={!view}
                onClick={() => view && goToPreviousChunk(view)}
              >
                <ChevronUpIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Next change"
                disabled={!view}
                onClick={() => view && goToNextChunk(view)}
              >
                <ChevronDownIcon />
              </Button>
            </div>
          )}
          {diff && (
            <div className="flex items-center gap-2">
              <Switch id={switchId} size="sm" checked={showDiff} onCheckedChange={onShowDiffChange} />
              <Label htmlFor={switchId} className="font-normal">
                Show changes
              </Label>
            </div>
          )}
          {resetLabel && !readOnly && (
            <Button type="button" variant="outline" size="sm" disabled={!canReset} onClick={onReset}>
              {resetLabel}
            </Button>
          )}
        </div>
      </div>
      <ProblemsList items={items} onSelect={goToLine} />
    </div>
  );
}
