import { json } from "@codemirror/lang-json";
import { lintGutter, setDiagnostics } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        lineHeight: "1.6",
      },
      ".cm-content": { caretColor: "var(--foreground)" },
      "&.cm-focused": { outline: "none" },
      ".cm-cursor": { borderLeftColor: "var(--foreground)" },
      ".cm-gutters": {
        backgroundColor: "var(--muted)",
        color: "var(--muted-foreground)",
        border: "none",
        borderRight: "1px solid var(--border)",
      },
      ".cm-activeLine": { backgroundColor: "color-mix(in oklab, var(--muted) 70%, transparent)" },
      ".cm-activeLineGutter": { backgroundColor: "var(--accent)", color: "var(--accent-foreground)" },
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

export default function CodeView({ text, items, status, resetLabel, canReset, onChange, onReset }: Props) {
  const dark = useIsDark();
  const [view, setView] = useState<EditorView | null>(null);
  const theme = useMemo(() => editorTheme(dark), [dark]);

  useEffect(() => {
    if (!view) return;
    view.dispatch(setDiagnostics(view.state, toDiagnostics(view.state.doc, items)));
  }, [view, items]);

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
            extensions={staticExtensions}
            placeholder="The SLA JSON appears here once the model has drafted one."
            basicSetup={{ foldGutter: false, autocompletion: false, highlightSelectionMatches: false }}
            onChange={onChange}
            onCreateEditor={setView}
          />
        </div>
      </div>
      <div className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-t px-4 py-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {status}
        </p>
        {resetLabel && (
          <Button type="button" variant="outline" size="sm" disabled={!canReset} onClick={onReset}>
            {resetLabel}
          </Button>
        )}
      </div>
      <ProblemsList items={items} onSelect={goToLine} />
    </div>
  );
}
