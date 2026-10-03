import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, ViewPlugin } from "@codemirror/view";
import type { DecorationSet, EditorView, ViewUpdate } from "@codemirror/view";

// The JSON language package ships no theme-aware highlight style we can reach, so tokens get
// the same syn-* classes (and colors) the rest of the app uses for code.
const TOKEN = /("(?:\\.|[^"\\\n])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])/g;

const mark = (cls: string) => Decoration.mark({ class: cls });
const KEY = mark("syn-key");
const STR = mark("syn-str");
const NUM = mark("syn-num");
const LIT = mark("syn-lit");
const PUNC = mark("syn-punc");

function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { doc } = view.state;
  let covered = -1;
  for (const { from, to } of view.visibleRanges) {
    // Whole lines, so a string is never cut in half at the edge of the viewport.
    const start = Math.max(doc.lineAt(from).from, covered + 1);
    const end = doc.lineAt(to).to;
    if (start > end) continue;
    const text = doc.sliceString(start, end);
    TOKEN.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TOKEN.exec(text))) {
      const at = start + m.index;
      if (m[1]) {
        builder.add(at, at + m[1].length, m[2] ? KEY : STR);
        if (m[2]) builder.add(at + m[1].length, at + m[0].length, PUNC);
      } else if (m[3]) {
        builder.add(at, at + m[0].length, NUM);
      } else if (m[4]) {
        builder.add(at, at + m[0].length, LIT);
      } else {
        builder.add(at, at + m[0].length, PUNC);
      }
    }
    covered = end;
  }
  return builder.finish();
}

export const jsonTokenColors = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) this.decorations = build(u.view);
    }
  },
  { decorations: (v) => v.decorations },
);
