import { createRequire, registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Hooks only work when React exists once. In production the shell shares its copy; in tests
// three installs meet: frontend/node_modules (../src and its libraries), the peer copy pnpm put
// here for react-router and Testing Library, and the dashboard's, behind the linked SDK and
// @oakestra/ui. Vite's dedupe only covers code Vite transforms; dependencies run in Node and
// resolve on their own, CommonJS ones included. So every react and react-dom import goes to
// frontend/'s copy here.
const frontendRequire = createRequire(path.resolve(import.meta.dirname, "../../package.json"));
const REACT = /^react(?:-dom)?(?:\/|$)/;
// require.resolve runs these hooks too; without the guard it would recurse forever.
let resolving = false;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (resolving || !REACT.test(specifier)) return nextResolve(specifier, context);
    resolving = true;
    try {
      return { url: pathToFileURL(frontendRequire.resolve(specifier)).href, shortCircuit: true };
    } finally {
      resolving = false;
    }
  },
});
