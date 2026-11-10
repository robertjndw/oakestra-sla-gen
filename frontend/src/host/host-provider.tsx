import { useMemo, type ReactNode } from "react";
import { DEFAULT_HOST, HostContext, type PlaygroundHost } from "./host-context";

/** Anything left out falls back to the standalone behaviour. */
export function HostProvider({ host, children }: { host: Partial<PlaygroundHost>; children: ReactNode }) {
  // Merged once per host object; a host built inline on every render would rebuild it each time,
  // so hosts should keep theirs stable.
  const value = useMemo(() => {
    const given = Object.entries(host).filter(([, v]) => v !== undefined);
    return { ...DEFAULT_HOST, ...Object.fromEntries(given) } as PlaygroundHost;
  }, [host]);
  return <HostContext.Provider value={value}>{children}</HostContext.Provider>;
}
