import { formatMb, joinWords, plural } from "./format.js";

export const FIELD_LABELS = {
  code: "image", virtualization: "runtime", port: "ports", vcpus: "vCPU", vgpus: "GPUs",
  memory: "memory", storage: "storage", environment: "environment", cmd: "command",
  constraints: "placement", addresses: "service IP",
};
const DIFF_FIELDS = Object.keys(FIELD_LABELS);

export function shortImage(ref) {
  return String(ref || "").replace(/^(index\.)?docker\.io\/(library\/)?/, "");
}

export function parsePorts(port) {
  if (!port) return [];
  return String(port).split(";").map((mapping) => {
    let m = mapping;
    let proto = "";
    const slash = m.indexOf("/");
    if (slash >= 0) { proto = m.slice(slash + 1); m = m.slice(0, slash); }
    const parts = m.split(":");
    return { host: parts[0], container: parts[1] || parts[0], proto };
  });
}

export function portLabel(p) {
  const s = p.host === p.container ? p.host : `${p.host} to ${p.container}`;
  return p.proto === "udp" ? s + " udp" : s;
}

export function services(sla) {
  const out = [];
  (sla?.applications || []).forEach((app, ai) => {
    (app?.microservices || []).forEach((ms, mi) => {
      out.push({ app, ms, ai, mi, key: (app.application_name || "") + "/" + (ms.microservice_name || mi) });
    });
  });
  return out;
}

export function diffSlas(before, after) {
  const a = {}, b = {};
  for (const s of services(before)) a[s.key] = s.ms;
  for (const s of services(after)) b[s.key] = s.ms;
  const result = { added: [], removed: [], changed: {} };
  const norm = (v) => JSON.stringify(v === undefined ? null : v);
  for (const key of Object.keys(b)) {
    if (!(key in a)) { result.added.push(key); continue; }
    const fields = DIFF_FIELDS.filter((f) => norm(a[key][f]) !== norm(b[key][f]));
    if (fields.length) result.changed[key] = fields.map((f) => ({ field: f, from: a[key][f], to: b[key][f] }));
  }
  for (const key of Object.keys(a)) if (!(key in b)) result.removed.push(key);
  return result;
}

const nameOf = (key) => key.slice(key.indexOf("/") + 1);

function describeField(c) {
  const label = FIELD_LABELS[c.field];
  const numeric = typeof c.from === "number" && typeof c.to === "number";
  if ((c.field === "memory" || c.field === "storage") && numeric) {
    return `${label} ${formatMb(c.from)} to ${formatMb(c.to)}`;
  }
  if ((c.field === "vcpus" || c.field === "vgpus") && numeric) {
    return `${label} ${c.from} to ${c.to}`;
  }
  if (c.field === "port") {
    return c.to ? "ports now " + parsePorts(c.to).map(portLabel).join(", ") : "no longer exposed";
  }
  if (c.field === "code" && c.to) return "image now " + shortImage(c.to);
  return label + " changed";
}

export function describeChanges(diff) {
  const lines = [
    ...diff.added.map((k) => "Added " + nameOf(k)),
    ...diff.removed.map((k) => "Removed " + nameOf(k)),
    ...Object.entries(diff.changed).map(([k, changes]) => nameOf(k) + ": " + changes.map(describeField).join(", ")),
  ];
  return lines.length > 6 ? [...lines.slice(0, 5), `and ${lines.length - 5} more changes`] : lines;
}

export function firstDraftLine(sla) {
  const names = services(sla).map((s) => s.ms.microservice_name);
  return plural(names.length, "service") + ": " + joinWords(names);
}

// Everything in a service's config that could hold another service's IP.
export function refsFor(ms) {
  const refs = (ms.environment || []).map((e) => {
    const i = e.indexOf("=");
    return { label: i >= 0 ? e.slice(0, i) : e, value: i >= 0 ? e.slice(i + 1) : "" };
  });
  for (const c of ms.cmd || []) refs.push({ label: "cmd", value: String(c) });
  return refs;
}

export function ipPattern(ip) {
  return new RegExp("(^|[^0-9.])" + ip.replace(/\./g, "\\.") + "($|[^0-9])");
}

export function findLinks(list) {
  const targets = list.filter((s) => s.ms.addresses?.rr_ip);
  const links = [];
  for (const s of list) {
    const refs = refsFor(s.ms);
    for (const t of targets) {
      if (t === s) continue;
      const re = ipPattern(t.ms.addresses.rr_ip);
      const hit = refs.find((r) => re.test(r.value));
      if (hit) links.push({ from: s, to: t, label: hit.label });
    }
  }
  return links;
}
