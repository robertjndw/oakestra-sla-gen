import type { SlaMicroservice, Service } from "../types";
import { comparableFields, serviceToSlaFields, slaEntryFields, stableJson, SLA_SERVICE_FIELDS } from "./sla-fields";

export interface ChangedService {
  name: string;
  /** Schema fields whose value differs from the deployed service. */
  fields: string[];
}

export interface RenamedService {
  /** The name in the SLA. */
  name: string;
  /** The deployed service it looks like. */
  deployed: string;
}

export interface AdditionPlan {
  /** In the SLA but not deployed yet: these get created. */
  toCreate: SlaMicroservice[];
  /** Deployed under the same name but different in the SLA. Not applied: the backend can't update services. */
  changed: ChangedService[];
  /** Deployed but missing from the SLA. Left alone: adding services never deletes any. */
  removed: string[];
  /**
   * New names for deployed services, most likely because the generator allows only 10 characters
   * where Oakestra allows 32. Not created: Oakestra would run the service twice.
   */
  renamed: RenamedService[];
  /**
   * Names the SLA uses for more than one service. Nothing can be added while there are any:
   * names are the only identity we match on, so it's unclear which of them is meant.
   */
  duplicates: string[];
}

/**
 * The same image behind the same service IP (or both without one). Two services like that would
 * fight over the IP, or are the same service twice.
 */
function sameWorkload(a: SlaMicroservice, b: Service): boolean {
  const generated = comparableFields(slaEntryFields(a as Record<string, unknown>));
  const deployed = comparableFields(serviceToSlaFields(b));
  return generated.code === deployed.code && generated.addresses === deployed.addresses;
}

/**
 * Compares a generated SLA with what the application already runs. Services are matched by
 * name, the only identity the model and the backend share (the SLA's microserviceID is dropped
 * before deploying), and a new name that looks like a deployed service missing from the SLA is
 * taken as a rename of it.
 */
export function planAdditions(generated: readonly SlaMicroservice[], existing: readonly Service[]): AdditionPlan {
  const deployed = new Map(existing.map((service) => [service.microservice_name, service]));
  const plan: AdditionPlan = { toCreate: [], changed: [], removed: [], renamed: [], duplicates: [] };

  const seen = new Set<string>();
  for (const { microservice_name: name } of generated) {
    if (seen.has(name) && !plan.duplicates.includes(name)) plan.duplicates.push(name);
    seen.add(name);
  }
  if (plan.duplicates.length > 0) return plan;

  const unmatched = existing.filter((service) => !seen.has(service.microservice_name));
  for (const service of generated) {
    const current = deployed.get(service.microservice_name);
    if (!current) {
      const original = unmatched.find((candidate) => sameWorkload(service, candidate));
      if (original) {
        unmatched.splice(unmatched.indexOf(original), 1);
        plan.renamed.push({ name: service.microservice_name, deployed: original.microservice_name });
      } else {
        plan.toCreate.push(service);
      }
      continue;
    }
    const before = comparableFields(serviceToSlaFields(current));
    const after = comparableFields(slaEntryFields(service as Record<string, unknown>));
    const fields = SLA_SERVICE_FIELDS.filter((field) => stableJson(before[field]) !== stableJson(after[field]));
    if (fields.length > 0) plan.changed.push({ name: service.microservice_name, fields });
  }

  plan.removed = unmatched.map((service) => service.microservice_name);
  return plan;
}
