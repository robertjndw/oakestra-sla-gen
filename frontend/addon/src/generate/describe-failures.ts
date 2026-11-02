import type { ServiceCreateResult } from "../types";

/** Same wording as the shell's describeFailures. */
export function describeFailures(failed: ServiceCreateResult["failed_services"]): string {
  const reasons = failed.map((entry) => {
    const name = entry.service_name ? `${entry.service_name}: ` : "";
    return `${name}${entry.message ?? "the backend gave no reason"}`;
  });
  return `Could not create ${failed.length === 1 ? "the service" : "the services"}. ${reasons.join("; ")}`;
}
