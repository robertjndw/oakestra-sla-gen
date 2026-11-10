import { useCurrentUser, useNotify } from "@oakestra/dashboard-sdk";
import { useMemo, type ComponentType, type ReactNode } from "react";
import type { PlaygroundActionsProps, PlaygroundHost } from "@/host/host-context";
import { HostProvider } from "@/host/host-provider";
import { dashboardStorageKey, type PlaygroundScope } from "./storage-key";

interface DashboardHostProps {
  scope: PlaygroundScope;
  Actions?: ComponentType<PlaygroundActionsProps>;
  seed?: PlaygroundHost["seed"];
  children: ReactNode;
}

/**
 * The shared playground with the shell's toasts, the user's organization as the fixed customer,
 * and per-user storage keys so two accounts on one browser don't share history or drafts.
 */
export function DashboardHost({ scope, Actions, seed, children }: DashboardHostProps) {
  const notify = useNotify();
  const user = useCurrentUser();
  const username = user?.username ?? "anonymous";
  const organization = user?.organization ?? null;

  // HostProvider merges on identity, so this has to stay stable across renders.
  const host = useMemo<Partial<PlaygroundHost>>(
    () => ({
      showBranding: false,
      notify,
      fixedCustomerId: organization,
      storageKey: dashboardStorageKey(organization, username, scope),
      Actions,
      seed,
    }),
    [notify, organization, username, scope, Actions, seed],
  );

  // Keyed by user: the playground reads its storage only on mount, so if the user arrives after
  // the first render, it has to start over from their keys instead of writing the anonymous
  // state into them.
  return (
    <HostProvider key={`${organization ?? ""}/${username}`} host={host}>
      {children}
    </HostProvider>
  );
}
