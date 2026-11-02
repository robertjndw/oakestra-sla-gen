import { createContext, useContext, type ComponentType } from "react";
import type { ValidationStatus } from "@/hooks/use-validation";
import {
  COMPOSER_STORAGE_KEY,
  HISTORY_STORAGE_KEY,
  MODE_STORAGE_KEY,
  SESSION_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  SPLIT_LAYOUT_ID,
} from "@/lib/constants";

export interface NotifyOptions {
  description?: string;
}

/** Short-lived messages, e.g. "Copied the SLA JSON". The standalone app shows them as toasts. */
export interface Notifier {
  success(message: string, options?: NotifyOptions): void;
  error(message: string, options?: NotifyOptions): void;
  info(message: string, options?: NotifyOptions): void;
}

/**
 * What a host's toolbar actions get to see. Everything describes the editor's working copy: the
 * text Accept accepts and Copy/Download hand out, hand edits included. An older draft the user is
 * only viewing is never passed: it is read-only and can't be accepted.
 */
export interface PlaygroundActionsProps {
  /** Working copy as JSON text. Empty until there is a draft or a reopened SLA. */
  sla: string;
  /** Name for the SLA, as its history entry shows it. */
  title: string;
  /**
   * Live validation of `sla`. "valid" means it parsed and the server found no problems; while the
   * text was just edited it is "checking". `errors` is empty unless status is "invalid".
   */
  validation: { status: ValidationStatus; errors: string[] };
  /** The user accepted the current draft and hasn't asked to keep refining. */
  accepted: boolean;
  /** The model is working on a turn. Its draft may replace `sla` when it lands. */
  turnRunning: boolean;
}

export interface PlaygroundHost {
  kind: "standalone" | "dashboard";
  notify: Notifier;
  /** Maps a logical name to the localStorage/sessionStorage key (or element id) used for it. */
  storageKey(name: StorageName): string;
  /** When set, the customer ID setting is hidden and every new session is sent with this one. */
  fixedCustomerId: string | null;
  /** The Oakestra logo and "Oakestra / SLA Playground" title in the top bar. */
  showBranding: boolean;
  /** Extra toolbar buttons from the host, e.g. Deploy. Rendered after New session. */
  Actions?: ComponentType<PlaygroundActionsProps>;
  /**
   * An SLA to open on mount, as if picked from the history. Ignored when a reload brought back a
   * conversation or an edited SLA, so it never overwrites work.
   */
  seed?: { title: string; sla: string } | null;
}

// "split" names the resizable split; the panels library stores its layout under
// "react-resizable-panels:<id>".
export type StorageName = "mode" | "settings" | "session" | "composer" | "history" | "split" | (string & {});

const STANDALONE_KEYS: Record<string, string> = {
  mode: MODE_STORAGE_KEY,
  settings: SETTINGS_STORAGE_KEY,
  session: SESSION_STORAGE_KEY,
  composer: COMPOSER_STORAGE_KEY,
  history: HISTORY_STORAGE_KEY,
  split: SPLIT_LAYOUT_ID,
};

/** The keys the standalone app has always used, so existing browsers keep their data. */
export const standaloneStorageKey = (name: StorageName): string =>
  STANDALONE_KEYS[name] ?? `oakestra-playground-${name}`;

const noop = () => {};

export const DEFAULT_HOST: PlaygroundHost = {
  kind: "standalone",
  // Silent rather than throwing, so components render without a provider (tests, previews).
  notify: { success: noop, error: noop, info: noop },
  storageKey: standaloneStorageKey,
  fixedCustomerId: null,
  showBranding: true,
};

export const HostContext = createContext<PlaygroundHost>(DEFAULT_HOST);

export function useHost(): PlaygroundHost {
  return useContext(HostContext);
}
