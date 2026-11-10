// Puts our Tailwind prefix on every class name in src/, or with --check, lists the ones without it.
//
//   node scripts/prefix-classes.mts           rewrite src/ in place
//   node scripts/prefix-classes.mts --check   exit 1 if anything still needs the prefix
//
// The dashboard addon build rejects any class selector without the prefix, and Tailwind only
// generates prefixed classes, so a class that slipped through just silently has no styles. This
// finds them by asking Tailwind itself whether a word compiles to CSS, which is the only check that
// keeps up with custom utilities, variants and arbitrary values.
//
// A string is rewritten only when every word in it is a class. Anything else that contains a class
// is listed for review, because rewriting half a string is how a role="group" or an aria-label
// gets mangled. Strings in places that never hold classes (other JSX attributes, comparisons,
// types, imports, cva's defaultVariants) are not looked at at all.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { __unstable__loadDesignSystem } from "@tailwindcss/node";
import ts from "typescript";

const PREFIX = "slagen";
const root = path.resolve(import.meta.dirname, "..");
const srcDir = path.join(root, "src");
const check = process.argv.includes("--check");

// Classification has to happen against the unprefixed design system: with prefix(slagen) Tailwind
// rejects "flex" and only accepts "slagen:flex". So the design system is built from the same
// imports and @theme blocks as index.css, minus the prefix and the @apply rules that rely on it.
function designSystemCss(): string {
  const index = readFileSync(path.join(srcDir, "index.css"), "utf8");
  const parts = [
    `@import "tailwindcss";`,
    `@import "tw-animate-css";`,
    `@import "./src/styles/shadcn-tailwind.css";`,
    `@import "./src/styles/shared.css";`,
    ...(index.match(/@custom-variant[^;{]*(?:;|\{)/g) ?? []).filter((v) => v.endsWith(";")),
    ...extractBlocks(index, "@theme"),
  ];
  return parts.join("\n");
}

function extractBlocks(css: string, atRule: string): string[] {
  const blocks: string[] = [];
  let from = 0;
  for (;;) {
    const start = css.indexOf(atRule, from);
    if (start === -1) return blocks;
    let depth = 0;
    let i = css.indexOf("{", start);
    for (; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}" && --depth === 0) break;
    }
    blocks.push(css.slice(start, i + 1));
    from = i + 1;
  }
}

const designSystem = await __unstable__loadDesignSystem(designSystemCss(), { base: root });

// Markers Tailwind's variants refer to but that produce no CSS of their own.
const MARKER = /^(?:group|peer)(?:\/[\w-]+)?$|^@container(?:\/[\w-]+)?$/;
const isPrefixed = (token: string) => token.startsWith(`${PREFIX}:`);

const classCache = new Map<string, boolean>();
function isUnprefixedClass(token: string): boolean {
  let known = classCache.get(token);
  if (known === undefined) {
    known = MARKER.test(token) || designSystem.candidatesToCss([token])[0] != null;
    classCache.set(token, known);
  }
  return known;
}

// Plain words like "hidden", "outline" or "group" are classes, but outside a className they are
// far more likely to be a CSS value, a variant name or an ARIA role.
const BARE_WORD = /^[a-z@]+$/;

// "class": the string is known to end up in a class attribute. "maybe": it might. "skip": it never.
type Context = "class" | "maybe" | "skip";

const CLASS_NAME = /^(?:class|className|classNames?)$|ClassName$/;
const CLASS_VARIABLE = /class/i;
const CLASS_FUNCTIONS = new Set(["cn", "cva", "clsx", "cx", "twMerge", "twJoin"]);
const SKIPPED_KEYS = new Set(["style", "defaultVariants"]);
// DOM and storage calls whose string arguments are selectors, attribute names, keys or CSS values.
const SKIPPED_CALLS = new Set([
  "animate",
  "querySelector",
  "querySelectorAll",
  "closest",
  "matches",
  "getAttribute",
  "setAttribute",
  "removeAttribute",
  "hasAttribute",
  "addEventListener",
  "removeEventListener",
  "createElement",
  "matchMedia",
  "getItem",
  "setItem",
  "removeItem",
  "getPropertyValue",
  "setProperty",
]);

// A class selector inside an arbitrary variant, such as shadcn's [.border-b]:pb-2 or
// [&>.sr-only]:w-auto. The class it names is prefixed now, so it never matches, and the addon
// build rejects the unprefixed selector. Write it as [[class~='slagen:border-b']] instead.
const CLASS_IN_VARIANT = /\[(?:[^\]]*[[&>~+_,(])?\.[a-zA-Z_-]/;
const EQUALITY = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

interface Edit {
  start: number;
  end: number;
  text: string;
}

interface Finding {
  file: string;
  line: number;
  kind: "unprefixed" | "mixed" | "bare word" | "glued to ${}" | "class selector";
  context: Context;
  text: string;
}

const findings: Finding[] = [];

function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
    return name.text;
  }
  return undefined;
}

function calleeName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return undefined;
}

// cva's compoundVariants pick variants by name ({ variant: "outline", class: "..." }); only the
// class entry holds classes.
function inCompoundVariants(node: ts.PropertyAssignment): boolean {
  const array = node.parent.parent;
  return (
    ts.isArrayLiteralExpression(array) &&
    ts.isPropertyAssignment(array.parent) &&
    propertyName(array.parent.name) === "compoundVariants"
  );
}

const isStringLike = (node: ts.Node) =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node);

/** A run of literal text inside quotes or backticks, as written in the source. */
interface Chunk {
  start: number;
  end: number;
  // Whether a ${} sits directly before or after the chunk, which glues its edge word to it.
  gluedLeft: boolean;
  gluedRight: boolean;
}

function processFile(file: string): Edit[] {
  const text = readFileSync(file, "utf8");
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const edits: Edit[] = [];
  const rel = path.relative(root, file);

  function report(node: ts.Node, kindOf: Finding["kind"], what: string) {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    findings.push({ file: rel, line, kind: kindOf, context: currentContext, text: what });
  }

  let currentContext: Context = "maybe";

  function handle(node: ts.Node, chunks: Chunk[], context: Context) {
    currentContext = context;
    const pieces = chunks.map((chunk) => {
      const raw = text.slice(chunk.start, chunk.end);
      const parts = raw.split(/(\s+)/);
      const words = parts.map((part, i) => {
        if (part === "" || /^\s+$/.test(part)) return null;
        const glued = (i === 0 && chunk.gluedLeft) || (i === parts.length - 1 && chunk.gluedRight);
        return { part, glued };
      });
      return { chunk, parts, words };
    });

    const words = pieces.flatMap((p) => p.words.filter((w) => w !== null));
    const whole = words.filter((w) => !w.glued).map((w) => w.part);
    const glued = words.filter((w) => w.glued).map((w) => w.part);
    const unprefixed = whole.filter((w) => !isPrefixed(w) && isUnprefixedClass(w));
    const allClasses = whole.every((w) => isPrefixed(w) || isUnprefixedClass(w));
    const source = node.getText(sf);

    for (const word of whole) {
      if (CLASS_IN_VARIANT.test(word)) report(node, "class selector", word);
    }

    if (glued.length > 0 && (context === "class" || unprefixed.length > 0)) {
      report(node, "glued to ${}", source);
    }
    if (unprefixed.length === 0) return;
    if (!allClasses) {
      report(node, "mixed", source);
      return;
    }
    if (context === "maybe" && words.length === 1 && BARE_WORD.test(whole[0] ?? "")) {
      report(node, "bare word", source);
      return;
    }
    if (check) {
      report(node, "unprefixed", unprefixed.join(" "));
      return;
    }
    for (const { chunk, parts, words: chunkWords } of pieces) {
      const next = parts
        .map((part, i) => {
          const word = chunkWords[i];
          if (!word || word.glued || isPrefixed(part) || !isUnprefixedClass(part)) return part;
          return `${PREFIX}:${part}`;
        })
        .join("");
      if (next !== text.slice(chunk.start, chunk.end)) edits.push({ start: chunk.start, end: chunk.end, text: next });
    }
  }

  function visitString(node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral, context: Context) {
    const start = node.getStart(sf) + 1;
    handle(node, [{ start, end: node.end - 1, gluedLeft: false, gluedRight: false }], context);
  }

  function visitTemplate(node: ts.TemplateExpression, context: Context) {
    const chunks: Chunk[] = [
      { start: node.head.getStart(sf) + 1, end: node.head.end - 2, gluedLeft: false, gluedRight: true },
    ];
    for (const span of node.templateSpans) {
      const tail = ts.isTemplateTail(span.literal);
      chunks.push({
        start: span.literal.getStart(sf) + 1,
        end: span.literal.end - (tail ? 1 : 2),
        gluedLeft: true,
        gluedRight: !tail,
      });
    }
    // An empty chunk between two ${} glues nothing; neither does whitespace at a chunk's edge,
    // which split() turns into a leading or trailing whitespace part.
    handle(node, chunks, context);
  }

  function visit(node: ts.Node, context: Context): void {
    if (
      ts.isTypeNode(node) ||
      ts.isImportDeclaration(node) ||
      ts.isExportDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node)
    ) {
      return;
    }
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sf);
      if (node.initializer) visit(node.initializer, CLASS_NAME.test(name) ? "class" : "skip");
      return;
    }
    if (ts.isPropertyAssignment(node)) {
      const key = propertyName(node.name);
      let next = context;
      if (key !== undefined && CLASS_NAME.test(key)) next = "class";
      else if (key !== undefined && SKIPPED_KEYS.has(key)) next = "skip";
      else if (inCompoundVariants(node)) next = "skip";
      visit(node.initializer, next);
      return;
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && CLASS_VARIABLE.test(node.name.text)) {
      if (node.initializer) visit(node.initializer, "class");
      return;
    }
    if (ts.isBinaryExpression(node) && EQUALITY.has(node.operatorToken.kind)) {
      for (const side of [node.left, node.right]) if (!isStringLike(side)) visit(side, context);
      return;
    }
    if (ts.isCaseClause(node)) {
      for (const statement of node.statements) visit(statement, context);
      return;
    }
    if (ts.isElementAccessExpression(node)) {
      visit(node.expression, context);
      if (!isStringLike(node.argumentExpression)) visit(node.argumentExpression, context);
      return;
    }
    if (ts.isCallExpression(node)) {
      const callee = calleeName(node.expression);
      if (callee !== undefined && CLASS_FUNCTIONS.has(callee)) {
        visit(node.expression, context);
        for (const arg of node.arguments) visit(arg, "class");
        return;
      }
      if (callee !== undefined && SKIPPED_CALLS.has(callee)) {
        visit(node.expression, context);
        for (const arg of node.arguments) visit(arg, "skip");
        return;
      }
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (context !== "skip") visitString(node, context);
      return;
    }
    if (ts.isTemplateExpression(node)) {
      if (context !== "skip") visitTemplate(node, context);
      for (const span of node.templateSpans) visit(span.expression, context);
      return;
    }
    ts.forEachChild(node, (child) => visit(child, context));
  }

  visit(sf, "maybe");

  if (edits.length > 0) {
    let out = text;
    for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
      out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
    }
    writeFileSync(file, out);
  }
  return edits;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "test" ? [] : sourceFiles(full);
    if (!/\.tsx?$/.test(entry.name) || /\.test\.|\.d\.ts$/.test(entry.name)) return [];
    return [full];
  });
}

let changedFiles = 0;
let changedStrings = 0;
for (const file of sourceFiles(srcDir).sort()) {
  const edits = processFile(file);
  if (edits.length > 0) {
    changedFiles++;
    changedStrings += edits.length;
  }
}

const byKind = (kind: Finding["kind"]) => findings.filter((f) => f.kind === kind);
const print = (title: string, list: Finding[]) => {
  if (list.length === 0) return;
  console.log(`\n${title}`);
  for (const f of list) console.log(`  ${f.file}:${f.line}  ${f.text.replace(/\s+/g, " ")}`);
};

if (check) {
  // A mixed string only fails the check inside a className; elsewhere it is usually prose.
  const missing = byKind("unprefixed");
  const mixed = byKind("mixed").filter((f) => f.context === "class");
  const selectors = byKind("class selector");
  print(`Classes without the "${PREFIX}:" prefix:`, missing);
  print("Strings in a className that mix unprefixed classes with other words:", mixed);
  print("Class selectors inside arbitrary variants (use [class~='slagen:...']):", selectors);
  if (missing.length > 0 || mixed.length > 0 || selectors.length > 0) {
    console.log(`\nRun "node scripts/prefix-classes.mts" to prefix them.`);
    process.exit(1);
  }
  console.log(`All classes in src/ carry the "${PREFIX}:" prefix.`);
} else {
  console.log(`Prefixed ${changedStrings} string chunks in ${changedFiles} files.`);
  print("Review: strings that mix classes with other words, left alone:", byKind("mixed"));
  print("Review: single words that are classes outside a className, left alone:", byKind("bare word"));
  print("Review: words glued to a ${} that could not be classified:", byKind("glued to ${}"));
  print("Fix by hand: class selectors inside arbitrary variants:", byKind("class selector"));
}
