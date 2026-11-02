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

// The system-manager stores the runtime it picked, not the SLA value: a service created as
// "container" reads back as "docker". The generator's validator only accepts the SLA values.
const CONTAINER_RUNTIMES = new Set(["docker", "runc"]);

const PORT_MAPPING = /^(\d+)(?::(\d+))?(?:\/(tcp|udp))?$/;

/**
 * Oakestra reads a bare port ("80") as the same port on host and container. The generator only
 * accepts the host:container form, so seeds get it spelled out.
 */
function expandPorts(port: string): string {
  return port
    .split(";")
    .map((mapping) => {
      const match = PORT_MAPPING.exec(mapping.trim());
      if (!match || match[2] !== undefined) return mapping;
      return `${match[1]}:${match[1]}${match[3] ? `/${match[3]}` : ""}`;
    })
    .join(";");
}

/** One spelling per meaning: tcp made explicit, mappings in a fixed order. */
function canonicalPorts(port: unknown): string | undefined {
  if (typeof port !== "string" || port === "") return undefined;
  return port
    .split(";")
    .map((mapping) => {
      const match = PORT_MAPPING.exec(mapping.trim());
      return match ? `${match[1]}:${match[2] ?? match[1]}/${match[3] ?? "tcp"}` : mapping.trim();
    })
    .sort()
    .join(";");
}

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
  if (typeof picked.virtualization === "string" && CONTAINER_RUNTIMES.has(picked.virtualization)) {
    picked.virtualization = "container";
  }
  if (picked.port !== undefined && picked.port !== null) picked.port = expandPorts(String(picked.port));
  return compact(picked);
}

/** Same as serviceToSlaFields, for a service that already is an SLA entry (from the model). */
export function slaEntryFields(service: Record<string, unknown>): SlaServiceFields {
  const picked: Record<string, unknown> = {};
  for (const field of SLA_SERVICE_FIELDS) picked[field] = service[field];
  if (picked.port !== undefined && picked.port !== null) picked.port = String(picked.port);
  return compact(picked);
}

/**
 * The fields the generator can write (Microservice in src/oakestra_sla_gen/models.py). Its output
 * never has the others, so a deployed service would always look changed in them, although
 * nothing about it was asked to change.
 */
const GENERATED_FIELDS: ReadonlySet<SlaServiceField> = new Set([
  "virtualization",
  "code",
  "memory",
  "vcpus",
  "vgpus",
  "storage",
  "port",
  "cmd",
  "environment",
  "constraints",
  "addresses",
]);

/**
 * The generator's defaults. It can't write 0 for vcpus or memory, and the backend (or its mock)
 * fills in 0 for whatever an SLA left out, so 0 and missing both mean "the default".
 */
const RESOURCE_DEFAULTS: Partial<Record<SlaServiceField, number>> = { vcpus: 1, vgpus: 0, memory: 100, storage: 0 };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * What a generated SLA can say about a service, reduced so that two spellings of the same thing
 * compare equal. Only for comparing: the result is not a valid SLA entry.
 */
export function comparableFields(fields: SlaServiceFields): SlaServiceFields {
  const out: Record<string, unknown> = {};
  for (const field of SLA_SERVICE_FIELDS) {
    if (GENERATED_FIELDS.has(field)) out[field] = fields[field];
  }
  for (const [field, fallback] of Object.entries(RESOURCE_DEFAULTS)) {
    if (out[field] === undefined || out[field] === null || out[field] === 0) out[field] = fallback;
  }
  out.port = canonicalPorts(out.port);
  // The generator only knows the round-robin service IP.
  out.addresses = isRecord(out.addresses) ? out.addresses.rr_ip : undefined;
  // And only direct constraints; the scheduler ignores the other kinds anyway.
  out.constraints = Array.isArray(out.constraints)
    ? out.constraints
        .filter((constraint) => isRecord(constraint) && constraint.type === "direct")
        .map((constraint) => compact({ node: constraint.node, cluster: constraint.cluster }))
    : undefined;
  return compact(out);
}

/** JSON with sorted keys, so two objects with the same content compare equal as strings. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}
