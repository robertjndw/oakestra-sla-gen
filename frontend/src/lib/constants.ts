import type { Settings } from "./types";

/** Mirrors MAX_COMPOSE_CHARS in compose.py and MAX_SLA_CHARS in existing_sla.py; checked here so a
 * huge file fails fast. */
export const MAX_UPLOAD_CHARS = 64_000;

export const MODE_STORAGE_KEY = "oakestra-playground-mode";
export const SETTINGS_STORAGE_KEY = "oakestra-playground-settings";
/** sessionStorage, so a reload keeps the conversation but a second tab starts fresh. */
export const SESSION_STORAGE_KEY = "oakestra-playground-session";
export const COMPOSER_STORAGE_KEY = "oakestra-playground-composer";
export const HISTORY_STORAGE_KEY = "oakestra-playground-history";

/** Each entry is at most an upload-sized SLA, so this stays well inside the ~5 MB quota. */
export const MAX_HISTORY_ENTRIES = 20;
/** Hand edits are saved to the history once typing pauses, not on every keystroke. */
export const HISTORY_SAVE_DEBOUNCE_MS = 1000;

export const VALIDATE_DEBOUNCE_MS = 400;

export const API_PREFIX = "/api";

export const MIN_RETRIES = 1;
export const MAX_RETRIES = 10;

export const DEFAULT_SETTINGS: Settings = {
  maxRetries: 3,
  // Empty means "not chosen": the server keeps an uploaded SLA's own ID, otherwise uses Admin.
  customerId: "",
  checkImages: true,
};

export const EXAMPLE_PROMPTS: { text: string; note?: string }[] = [
  { text: "A single nginx web server on port 80 with 1 CPU and 512 MB of memory" },
  {
    text: "My Flask API ghcr.io/acme/orders:2.1 on port 8000, backed by a Postgres database with password ordersecret",
  },
  { text: "A Redis cache and a Python worker that pulls jobs from it, both pinned to the cluster edge1" },
  { text: "Deploy my app", note: "Too vague on purpose, so you can see the model ask questions first" },
];
