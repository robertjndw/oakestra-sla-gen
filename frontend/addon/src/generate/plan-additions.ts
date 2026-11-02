import type { SlaMicroservice, Service } from "../types";
import { serviceToSlaFields, slaEntryFields, stableJson, SLA_SERVICE_FIELDS } from "./sla-fields";

export interface ChangedService {
  name: string;
  /** Schema fields whose value differs from the deployed service. */
  fields: string[];
}

export interface AdditionPlan {
  /** In the SLA but not deployed yet: these get created. */
  toCreate: SlaMicroservice[];
  /** Deployed under the same name but different in the SLA. Not applied: the backend can't update services. */
  changed: ChangedService[];
  /** Deployed but missing from the SLA. Left alone: adding services never deletes any. */
  removed: string[];
  /**
   * Names the SLA uses for more than one service. Nothing can be added while there are any:
   * names are the only identity we match on, so it's unclear which of them is meant.
   */
  duplicates: string[];
}

/**
 * Compares a generated SLA with what the application already runs. Services are matched by
 * name, the only identity the model and the backend share (the SLA's microserviceID is dropped
 * before deploying).
 */
export function planAdditions(generated: readonly SlaMicroservice[], existing: readonly Service[]): AdditionPlan {
  const deployed = new Map(existing.map((service) => [service.microservice_name, service]));
  const plan: AdditionPlan = { toCreate: [], changed: [], removed: [], duplicates: [] };

  const seen = new Set<string>();
  for (const { microservice_name: name } of generated) {
    if (seen.has(name) && !plan.duplicates.includes(name)) plan.duplicates.push(name);
    seen.add(name);
  }
  if (plan.duplicates.length > 0) return plan;

  for (const service of generated) {
    const current = deployed.get(service.microservice_name);
    if (!current) {
      plan.toCreate.push(service);
      continue;
    }
    const before = serviceToSlaFields(current);
    const after = slaEntryFields(service as Record<string, unknown>);
    const fields = SLA_SERVICE_FIELDS.filter((field) => stableJson(before[field]) !== stableJson(after[field]));
    if (fields.length > 0) plan.changed.push({ name: service.microservice_name, fields });
  }

  const inSla = new Set(generated.map((service) => service.microservice_name));
  plan.removed = existing.map((service) => service.microservice_name).filter((name) => !inSla.has(name));
  return plan;
}
