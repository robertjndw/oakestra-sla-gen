import type { Settings } from "./types";

/** Mirrors MAX_COMPOSE_CHARS in compose.py; checked here so a huge file fails fast. */
export const MAX_COMPOSE_CHARS = 64_000;

export const MODE_STORAGE_KEY = "oakestra-playground-mode";

export const VALIDATE_DEBOUNCE_MS = 400;

export const API_PREFIX = "/api";

export const MIN_RETRIES = 1;
export const MAX_RETRIES = 10;

export const DEFAULT_SETTINGS: Settings = {
  method: "prompt",
  maxRetries: 3,
  customerId: "Admin",
  checkImages: true,
};

export const OUTPUT_METHODS = ["prompt", "json_schema", "function_calling"] as const;

export const EXAMPLE_PROMPTS: { text: string; note?: string }[] = [
  { text: "A single nginx web server on port 80 with 1 CPU and 512 MB of memory" },
  {
    text: "My Flask API ghcr.io/acme/orders:2.1 on port 8000, backed by a Postgres database with password ordersecret",
  },
  { text: "A Redis cache and a Python worker that pulls jobs from it, both pinned to the cluster edge1" },
  { text: "Deploy my app", note: "Too vague on purpose, so you can see the model ask questions first" },
];
