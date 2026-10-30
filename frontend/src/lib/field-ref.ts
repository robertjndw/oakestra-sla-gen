import { fieldLabel } from "./sla";
import type { SlaMicroservice } from "./types";

/** The rows of a service card a question can point at, named after their first SLA key. */
export type FactRow = "code" | "virtualization" | "port" | "resources" | "addresses" | "environment" | "cmd" | "constraints";

const ROW_FOR_KEY: Record<string, FactRow> = {
  code: "code",
  virtualization: "virtualization",
  port: "port",
  vcpus: "resources",
  vgpus: "resources",
  memory: "resources",
  storage: "resources",
  addresses: "addresses",
  environment: "environment",
  cmd: "cmd",
  constraints: "constraints",
};

// Near misses a small model is likely to write instead of the real key.
const KEY_ALIASES: Record<string, string> = {
  image: "code",
  ports: "port",
  vcpu: "vcpus",
  cpu: "vcpus",
  vgpu: "vgpus",
  gpu: "vgpus",
  env: "environment",
  command: "cmd",
  constraint: "constraints",
  address: "addresses",
  rr_ip: "addresses",
};

export interface FieldRef {
  /** microservice_name as the model wrote it. */
  service: string;
  /** The SLA key, or null when the question is about the whole service or the key is unknown. */
  key: string | null;
  row: FactRow | null;
}

/**
 * Reads a question's `field`, "<microservice_name>.<key>" or just "<microservice_name>".
 * Anything that can't be a reference comes back as null, so the question isn't linked.
 */
export function parseFieldRef(raw: unknown): FieldRef | null {
  if (typeof raw !== "string") return null;
  const [service, rawKey = ""] = raw.trim().split(".");
  // Oakestra's name rule; "flask memory" is a topic, not a reference.
  if (!/^[A-Za-z0-9]{1,32}$/.test(service)) return null;
  const lower = rawKey.trim().toLowerCase();
  // hasOwn, because the model's text must not resolve to "constructor" and friends.
  const key = Object.hasOwn(KEY_ALIASES, lower) ? KEY_ALIASES[lower] : Object.hasOwn(ROW_FOR_KEY, lower) ? lower : null;
  // An unknown key still names the service, which is worth pointing at on its own.
  return { service, key, row: key ? ROW_FOR_KEY[key] : null };
}

/** How service names are matched between questions and cards: the model doesn't keep the case. */
export const serviceKey = (name: string | undefined): string => (name ?? "").toLowerCase();

export function refersTo(ref: FieldRef, ms: SlaMicroservice): boolean {
  return serviceKey(ref.service) === serviceKey(ms.microservice_name);
}

/** "flask memory" or "flask", for labels like "Show flask memory". */
export function describeFieldRef(ref: FieldRef): string {
  return ref.key ? `${ref.service} ${fieldLabel(ref.key)}` : ref.service;
}
