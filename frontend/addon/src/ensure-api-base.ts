import { setApiBase } from "@/lib/api";
import { apiBaseFor } from "./api-base";

let done = false;

/**
 * Points the shared playground's API client at this addon's proxy. Called by the lazily loaded
 * modules that render the playground, so the entry chunk stays free of it.
 */
export function ensureApiBase(): void {
  if (done) return;
  done = true;
  // Through a variable on purpose: Vite rewrites `new URL(<literal>, import.meta.url)` at build
  // time, and here we want the URL the chunk was actually loaded from.
  const moduleUrl = import.meta.url;
  setApiBase(apiBaseFor(moduleUrl, import.meta.env.DEV));
}
