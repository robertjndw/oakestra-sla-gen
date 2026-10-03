import { formatMb, joinWords, plural } from "./format";
import type { ServiceEntry, Sla, SlaMicroservice } from "./types";

const FIELD_LABELS: Record<string, string> = {
  code: "image",
  virtualization: "runtime",
  port: "ports",
  vcpus: "vCPU",
  vgpus: "GPUs",
  memory: "memory",
  storage: "storage",
  environment: "environment",
  cmd: "command",
  constraints: "placement",
  addresses: "service IP",
};
const DIFF_FIELDS = Object.keys(FIELD_LABELS);

export const fieldLabel = (field: string): string => FIELD_LABELS[field] ?? field;

export interface PortMapping {
  host: string;
  container: string;
  proto: string;
}

export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface SlaDiff {
  added: string[];
  removed: string[];
  changed: Record<string, FieldChange[]>;
}

export interface EnvRef {
  label: string;
  value: string;
}

export interface ServiceLink {
  from: ServiceEntry;
  to: ServiceEntry;
  label: string;
}

export const serviceName = (s: ServiceEntry): string => s.ms.microservice_name || "unnamed";

export function shortImage(ref: unknown): string {
  return String(ref || "").replace(/^(index\.)?docker\.io\/(library\/)?/, "");
}

export function parsePorts(port: string | undefined): PortMapping[] {
  if (!port) return [];
  return String(port)
    .split(";")
    .map((mapping) => {
      let m = mapping;
      let proto = "";
      const slash = m.indexOf("/");
      if (slash >= 0) {
        proto = m.slice(slash + 1);
        m = m.slice(0, slash);
      }
      const parts = m.split(":");
      return { host: parts[0], container: parts[1] || parts[0], proto };
    });
}

export function portLabel(p: PortMapping): string {
  const s = p.host === p.container ? p.host : `${p.host} to ${p.container}`;
  return p.proto === "udp" ? s + " udp" : s;
}

export function describeResources(ms: SlaMicroservice): string {
  const parts = [plural(Number(ms.vcpus) || 0, "vCPU", "vCPU"), formatMb(Number(ms.memory) || 0) + " memory"];
  if (ms.vgpus) parts.push(plural(ms.vgpus, "GPU"));
  if (ms.storage) parts.push(formatMb(ms.storage) + " storage");
  return parts.join(", ");
}

export function describePlacement(ms: SlaMicroservice): string {
  return ((ms.constraints ?? []) as { node?: string; cluster?: string }[])
    .map((c) =>
      c.node ? "Pinned to node " + c.node : c.cluster ? "Pinned to cluster " + c.cluster : "Direct constraint",
    )
    .join(", ");
}

export function services(sla: Sla | null | undefined): ServiceEntry[] {
  const out: ServiceEntry[] = [];
  (sla?.applications ?? []).forEach((app, ai) => {
    (app?.microservices ?? []).forEach((ms, mi) => {
      out.push({ app, ms, ai, mi, key: (app.application_name || "") + "/" + (ms.microservice_name || mi) });
    });
  });
  return out;
}

export function diffSlas(before: Sla | null | undefined, after: Sla | null | undefined): SlaDiff {
  const a: Record<string, SlaMicroservice> = {};
  const b: Record<string, SlaMicroservice> = {};
  for (const s of services(before)) a[s.key] = s.ms;
  for (const s of services(after)) b[s.key] = s.ms;
  const result: SlaDiff = { added: [], removed: [], changed: {} };
  const norm = (v: unknown) => JSON.stringify(v === undefined ? null : v);
  for (const key of Object.keys(b)) {
    if (!(key in a)) {
      result.added.push(key);
      continue;
    }
    const fields = DIFF_FIELDS.filter((f) => norm(a[key][f]) !== norm(b[key][f]));
    if (fields.length) {
      result.changed[key] = fields.map((f) => ({ field: f, from: a[key][f], to: b[key][f] }));
    }
  }
  for (const key of Object.keys(a)) if (!(key in b)) result.removed.push(key);
  return result;
}

const nameOf = (key: string) => key.slice(key.indexOf("/") + 1);

export function describeField(c: FieldChange): string {
  const label = FIELD_LABELS[c.field];
  const numeric = typeof c.from === "number" && typeof c.to === "number";
  if ((c.field === "memory" || c.field === "storage") && numeric) {
    return `${label} ${formatMb(c.from as number)} to ${formatMb(c.to as number)}`;
  }
  if ((c.field === "vcpus" || c.field === "vgpus") && numeric) {
    return `${label} ${c.from} to ${c.to}`;
  }
  if (c.field === "port") {
    return c.to ? "ports now " + parsePorts(c.to as string).map(portLabel).join(", ") : "no longer exposed";
  }
  if (c.field === "code" && c.to) return "image now " + shortImage(c.to);
  return label + " changed";
}

export function describeChanges(diff: SlaDiff): string[] {
  const lines = [
    ...diff.added.map((k) => "Added " + nameOf(k)),
    ...diff.removed.map((k) => "Removed " + nameOf(k)),
    ...Object.entries(diff.changed).map(
      ([k, changes]) => nameOf(k) + ": " + changes.map(describeField).join(", "),
    ),
  ];
  return lines.length > 6 ? [...lines.slice(0, 5), `and ${lines.length - 5} more changes`] : lines;
}

export function firstDraftLine(sla: Sla): string {
  const names = services(sla).map((s) => s.ms.microservice_name ?? "");
  return plural(names.length, "service") + ": " + joinWords(names);
}

export function splitEnv(entry: string): { key: string; value: string } {
  const i = entry.indexOf("=");
  return i >= 0 ? { key: entry.slice(0, i), value: entry.slice(i + 1) } : { key: entry, value: "" };
}

/** Everything in a service's config that could hold another service's IP. */
export function refsFor(ms: SlaMicroservice): EnvRef[] {
  const refs = (ms.environment ?? []).map((e) => {
    const { key, value } = splitEnv(e);
    return { label: key, value };
  });
  for (const c of ms.cmd ?? []) refs.push({ label: "cmd", value: String(c) });
  return refs;
}

export function ipPattern(ip: string): RegExp {
  return new RegExp("(^|[^0-9.])" + ip.replace(/\./g, "\\.") + "($|[^0-9])");
}

export interface IpTarget {
  target: ServiceEntry;
  re: RegExp;
}

/** Services that own an IP, with a pattern that finds that IP inside another service's values. */
export function ipTargets(list: ServiceEntry[]): IpTarget[] {
  return list
    .filter((s) => s.ms.addresses?.rr_ip)
    .map((s) => ({ target: s, re: ipPattern(s.ms.addresses!.rr_ip!) }));
}

export function findLinks(list: ServiceEntry[]): ServiceLink[] {
  const targets = ipTargets(list);
  const links: ServiceLink[] = [];
  for (const s of list) {
    const refs = refsFor(s.ms);
    for (const { target, re } of targets) {
      if (target === s) continue;
      const hit = refs.find((r) => re.test(r.value));
      if (hit) links.push({ from: s, to: target, label: hit.label });
    }
  }
  return links;
}
