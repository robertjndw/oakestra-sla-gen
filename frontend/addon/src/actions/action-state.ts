import type { ValidationStatus } from "@/hooks/use-validation";

/** Why an action that needs a valid, settled SLA can't run yet, or null when it can. */
export function blockedReason(options: {
  status: ValidationStatus;
  turnRunning: boolean;
  organization: string | null | undefined;
}): string | null {
  if (!options.organization) return "Your session has no organization to deploy to.";
  if (options.turnRunning) return "Wait until the model has finished its turn.";
  switch (options.status) {
    case "idle":
      return "Describe what to deploy first, or open an SLA.";
    case "checking":
      return "Checking the SLA...";
    case "invalid":
    case "parse-error":
      return "Fix the problems in the SLA first.";
    case "valid":
      return null;
  }
}

export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** True for the API client's errors with an HTTP status, without importing its class. */
export function hasStatus(error: unknown, status: number): boolean {
  return typeof error === "object" && error !== null && (error as { status?: unknown }).status === status;
}
