import { ADDON_ID } from "virtual:oakestra-addon";
import type { StorageName } from "@/host/host-context";

/** Where a playground is shown. Each scope keeps its own conversation. */
export type PlaygroundScope = "page" | `app-${string}`;

/** Names whose state belongs to one playground rather than to the user. */
const SCOPED: ReadonlySet<StorageName> = new Set(["session", "composer"]);

export function dashboardStorageKey(username: string, scope: PlaygroundScope) {
  return (name: StorageName): string => {
    // Used as a DOM id by the resizable panels, so it gets no dots or user-chosen characters.
    if (name === "split") return `${ADDON_ID}-split`;
    const key = `oakestra.addon.${ADDON_ID}.${username}.${name}`;
    return SCOPED.has(name) ? `${key}.${scope}` : key;
  };
}
