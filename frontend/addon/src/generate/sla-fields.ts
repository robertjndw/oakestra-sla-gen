import type { Service } from "../types";

/**
 * The fields a service has in an SLA (the backend's v2 schema), in the order the playground shows
 * them. A service as the API returns it carries much more: ids, status, instances, scheduler
 * bookkeeping. None of that belongs in an SLA the model refines or the user deploys.
 */
export const SLA_SERVICE_FIELDS = [
  "microservice_name",
  "microservice_namespace",
  "virtualization",
  "arch",
  "code",
  "memory",
  "vcpus",
  "vgpus",
  "vtpus",
  "bandwidth_in",
  "bandwidth_out",
  "storage",
  "port",
  "cmd",
  "environment",
  "args",
  "one_shot",
  "privileged",
  "added_files",
  "sla_violation_strategy",
  "target_node",
  "constraints",
  "connectivity",
  "addresses",
  "volumes",
] as const;

export type SlaServiceField = (typeof SLA_SERVICE_FIELDS)[number];
export type SlaServiceFields = Partial<Record<SlaServiceField, unknown>>;

const ADDRESS_FIELDS = ["rr_ip", "rr_ip_v6", "closest_ip", "closest_ip_v6"] as const;

/** Absent, null, "" and [] all mean "not set", as an SLA would just leave them out. */
function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.values(value).every(isEmpty);
  return false;
}

function compact(fields: Record<string, unknown>): SlaServiceFields {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => !isEmpty(value))) as SlaServiceFields;
}

/** The SLA view of a deployed service: only schema fields, nothing the backend added. */
export function serviceToSlaFields(service: Service): SlaServiceFields {
  // The model is a loose object: fields it doesn't declare (arch, one_shot, ...) still come
  // through, just untyped.
  const raw = service as Record<string, unknown>;
  const addresses = (raw.addresses ?? {}) as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const field of SLA_SERVICE_FIELDS) picked[field] = raw[field];

  // Older backends only filled `image`, and some still report the round-robin IP at the top.
  picked.code = service.code ?? service.image;
  picked.addresses = compact(
    Object.fromEntries(ADDRESS_FIELDS.map((key) => [key, addresses[key] ?? (key === "rr_ip" ? service.RR_ip : undefined)])),
  );
  if (picked.port !== undefined && picked.port !== null) picked.port = String(picked.port);
  return compact(picked);
}

/** Same as serviceToSlaFields, for a service that already is an SLA entry (from the model). */
export function slaEntryFields(service: Record<string, unknown>): SlaServiceFields {
  const picked: Record<string, unknown> = {};
  for (const field of SLA_SERVICE_FIELDS) picked[field] = service[field];
  if (picked.port !== undefined && picked.port !== null) picked.port = String(picked.port);
  return compact(picked);
}

/** JSON with sorted keys, so two objects with the same content compare equal as strings. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}
