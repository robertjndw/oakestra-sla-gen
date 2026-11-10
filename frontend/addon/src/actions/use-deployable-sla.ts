import { useCurrentUser } from "@oakestra/dashboard-sdk";
import { useMemo } from "react";
import type { PlaygroundActionsProps } from "@/host/host-context";
import { toSlaV2 } from "../deploy/to-sla-v2";
import { blockedReason } from "./action-state";

/**
 * The SLA as the Oakestra API takes it, and why an action can't use it yet. Each action adds its
 * own checks after `reason` comes back null.
 */
export function useDeployableSla({ sla, validation, turnRunning }: PlaygroundActionsProps) {
  const organization = useCurrentUser()?.organization;
  const result = useMemo(
    () => (validation.status === "valid" ? toSlaV2(sla, organization) : null),
    [sla, validation.status, organization],
  );
  let reason = blockedReason({ status: validation.status, turnRunning, organization });
  if (!reason && result && !result.ok) reason = result.errors[0] ?? "The SLA can't be deployed.";
  return { organization, result, reason };
}
