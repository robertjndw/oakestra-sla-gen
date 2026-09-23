import { $, el, svg } from "./dom.js";
import { formatMb, joinWords, plural } from "./format.js";
import { splitProblem } from "./json-paths.js";
import { diffSlas, findLinks, ipPattern, parsePorts, portLabel, refsFor, services, shortImage } from "./sla.js";

const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function problemsByService(problems, parseError) {
  const by = {}, global = [];
  if (parseError) return { by, global };
  for (const p of problems) {
    const m = /^applications\[(\d+)\]\.microservices\[(\d+)\]/.exec(p);
    const parts = splitProblem(p);
    if (m) {
      const k = m[1] + "/" + m[2];
      const where = parts.path.length > m[0].length ? ` (${parts.path.slice(m[0].length + 1)})` : "";
      (by[k] ||= []).push(parts.message + where);
    } else {
      global.push(p);
    }
  }
  return { by, global };
}

// `previous` is only used for the new/changed markers.
export function renderVisual({ sla, previous, problems, parseError }) {
  const list = services(sla);
  const diff = previous ? diffSlas(previous, sla) : { added: [], removed: [], changed: {} };
  const errs = problemsByService(problems, parseError);
  $("stale-note").hidden = !parseError;

  const apps = sla.applications || [];
  let cpu = 0, mem = 0;
  const ports = [];
  for (const s of list) {
    cpu += Number(s.ms.vcpus) || 0;
    mem += Number(s.ms.memory) || 0;
    for (const p of parsePorts(s.ms.port)) if (!ports.includes(p.host)) ports.push(p.host);
  }
  const where = apps.length === 1 ? " in " + (apps[0].application_name || "the application")
    : " across " + plural(apps.length, "application");
  let sentence = plural(list.length, "service") + where + ", using " + plural(cpu, "vCPU", "vCPU") +
    " and " + formatMb(mem) + " of memory. ";
  sentence += ports.length
    ? "Reachable from outside on " + (ports.length === 1 ? "port " : "ports ") + joinWords(ports) + "."
    : "Not reachable from outside.";
  if (!list.length) sentence = "This SLA has no services yet.";
  $("summary").textContent = sentence;
  const desc = apps.length === 1 ? apps[0].application_desc : "";
  $("summary-desc").hidden = !desc;
  $("summary-desc").textContent = desc || "";

  const globalList = $("global-errors");
  globalList.replaceChildren(...errs.global.map((g) => el("li", null, g)));
  globalList.hidden = !errs.global.length;

  const marks = {};
  for (const s of list) {
    marks[s.key] = {
      added: previous && diff.added.includes(s.key),
      changed: (diff.changed[s.key] || []).map((c) => c.field),
      errors: errs.by[s.ai + "/" + s.mi] || [],
    };
  }
  renderMap(list, marks);
  renderServices(list, marks, apps.length > 1);
}

function renderMap(list, marks) {
  const mapEl = $("map");
  mapEl.replaceChildren();
  if (!list.length) { $("map-caption").textContent = ""; mapEl.hidden = true; return; }
  mapEl.hidden = false;

  const links = findLinks(list);
  const exposed = list.filter((s) => parsePorts(s.ms.port).length);
  const W = 184, H = 58, GAP_X = 104, GAP_Y = 22, PAD = 24, OUT_W = 92;

  // Column = longest chain of callers above a service, so entry points sit on the left
  // and whatever they depend on fans out to the right.
  const preds = new Map(), depth = new Map();
  for (const s of list) preds.set(s, []);
  for (const l of links) preds.get(l.to).push(l.from);
  function depthOf(s, seen) {
    if (depth.has(s)) return depth.get(s);
    if (seen.includes(s)) return 0;
    let d = 0;
    for (const p of preds.get(s)) d = Math.max(d, depthOf(p, [...seen, s]) + 1);
    depth.set(s, d);
    return d;
  }
  let columns = [];
  for (const s of list) (columns[depthOf(s, [])] ||= []).push(s);
  columns = columns.filter(Boolean);
  const tallest = Math.max(...columns.map((c) => c.length));
  const height = PAD * 2 + tallest * H + (tallest - 1) * GAP_Y;
  const x0 = PAD + (exposed.length ? OUT_W + GAP_X : 0);
  const pos = new Map();
  columns.forEach((col, ci) => {
    const colH = col.length * H + (col.length - 1) * GAP_Y;
    const top = (height - colH) / 2;
    col.forEach((s, ri) => pos.set(s, { x: x0 + ci * (W + GAP_X), y: top + ri * (H + GAP_Y) }));
  });
  const width = x0 + columns.length * W + (columns.length - 1) * GAP_X + PAD;

  const root = svg("svg", { width, height, viewBox: `0 0 ${width} ${height}`, role: "img" });
  root.setAttribute("aria-label", `Service map: ${list.length} services, ${links.length} connections`);
  const defs = svg("defs");
  for (const [id, cls] of [["arrow", "map-arrow"], ["arrow-port", "map-arrow map-arrow-port"]]) {
    const marker = svg("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" });
    marker.appendChild(svg("path", { d: "M0 1 L9 5 L0 9 z", class: cls }));
    defs.appendChild(marker);
  }
  root.appendChild(defs);

  const OUTSIDE = { outside: true };
  const edges = links.map((l) => ({ from: l.from, to: l.to, label: l.label }));
  for (const s of exposed) {
    edges.push({ from: OUTSIDE, to: s, port: true, label: parsePorts(s.ms.port).map((pp) => pp.host).join(", ") });
  }
  const centerY = (node) => node === OUTSIDE ? height / 2 : pos.get(node).y + H / 2;
  // Edges sharing a node would all meet at its midpoint. Spread their ends out, sorted by
  // where the other end is, so they don't cross.
  function spread(side, other) {
    const groups = new Map();
    for (const e of edges) {
      if (!groups.has(e[side])) groups.set(e[side], []);
      groups.get(e[side]).push(e);
    }
    groups.forEach((group, node) => {
      group.sort((a, b) => centerY(a[other]) - centerY(b[other]));
      const span = node === OUTSIDE ? 16 : H - 20;
      group.forEach((e, i) => {
        e[side + "Y"] = centerY(node) + (group.length === 1 ? 0 : span * (i / (group.length - 1) - 0.5));
      });
    });
  }
  spread("from", "to");
  spread("to", "from");

  function curve(x1, y1, x2, y2, cls, marker, label, labelCls) {
    const dx = Math.max(40, Math.abs(x2 - x1) / 2);
    const c1x = x1 + dx, c2x = x2 - dx;
    root.appendChild(svg("path", {
      d: `M${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2 - 2} ${y2}`,
      class: cls, "marker-end": `url(#${marker})`,
    }));
    if (label) {
      const mx = (x1 + 3 * c1x + 3 * c2x + x2) / 8, my = (y1 + y2) / 2 - 6;
      root.appendChild(svg("text", { x: mx, y: my, "text-anchor": "middle", class: "map-label " + (labelCls || "") }, label));
    }
  }

  if (exposed.length) {
    const oy = height / 2 - 18;
    const out = svg("g", { class: "map-outside" });
    out.appendChild(svg("rect", { x: PAD, y: oy, width: OUT_W, height: 36, rx: 18 }));
    out.appendChild(svg("text", { x: PAD + OUT_W / 2, y: oy + 22, "text-anchor": "middle" }, "Outside"));
    root.appendChild(out);
  }
  for (const e of edges) {
    const x1 = e.from === OUTSIDE ? PAD + OUT_W : pos.get(e.from).x + W;
    const x2 = pos.get(e.to).x;
    if (e.port) curve(x1, e.fromY, x2, e.toY, "map-edge map-edge-port", "arrow-port", e.label, "map-label-port");
    else curve(x1, e.fromY, x2, e.toY, "map-edge", "arrow", e.label);
  }

  for (const s of list) {
    const p = pos.get(s), mk = marks[s.key];
    const cls = "map-node" + (mk.errors.length ? " has-errors" : (mk.added || mk.changed.length) ? " is-changed" : "");
    const g = svg("g", { class: cls, tabindex: 0, role: "button" });
    g.setAttribute("aria-label", "Show " + s.ms.microservice_name);
    g.appendChild(svg("rect", { x: p.x, y: p.y, width: W, height: H, rx: 8 }));
    g.appendChild(svg("text", { x: p.x + 14, y: p.y + 24, class: "map-name" }, s.ms.microservice_name || "unnamed"));
    let img = shortImage(s.ms.code);
    if (img.length > 24) img = img.slice(0, 23) + "…";
    g.appendChild(svg("text", { x: p.x + 14, y: p.y + 43, class: "map-image" }, img));
    const flag = mk.errors.length ? ["map-flag map-flag-error", plural(mk.errors.length, "problem")]
      : mk.added ? ["map-flag map-flag-changed", "new"]
      : mk.changed.length ? ["map-flag map-flag-changed", "changed"] : null;
    if (flag) g.appendChild(svg("text", { x: p.x + W - 12, y: p.y + 24, "text-anchor": "end", class: flag[0] }, flag[1]));
    g.addEventListener("click", () => focusService(s));
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); focusService(s); }
    });
    root.appendChild(g);
  }
  mapEl.appendChild(root);

  const caption = [];
  if (links.length) caption.push("Arrows point to the service whose IP another one uses, labelled with the variable that holds it.");
  else if (list.length > 1) caption.push("No connections found: no service references another's service IP.");
  if (exposed.length) caption.push("Dashed lines are ports opened to the outside.");
  $("map-caption").textContent = caption.join(" ");
}

function focusService(s) {
  const target = $(`svc-${s.ai}-${s.mi}`);
  if (!target) return;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  // Reading offsetWidth forces a reflow, which is what makes re-adding the class restart
  // the animation.
  target.classList.remove("flash");
  void target.offsetWidth;
  target.classList.add("flash");
}

function renderServices(list, marks, multiApp) {
  const root = $("services");
  root.replaceChildren();
  const byIp = {};
  for (const s of list) if (s.ms.addresses?.rr_ip) byIp[s.ms.addresses.rr_ip] = s;
  let lastApp = null;
  for (const s of list) {
    if (multiApp && s.app !== lastApp) {
      const ah = el("p", "app-head");
      ah.appendChild(el("strong", null, s.app.application_name || "Application"));
      if (s.app.application_desc) ah.appendChild(document.createTextNode("  " + s.app.application_desc));
      root.appendChild(ah);
      lastApp = s.app;
    }
    const ms = s.ms, mk = marks[s.key];
    const sec = el("section", "svc");
    sec.id = `svc-${s.ai}-${s.mi}`;
    const head = el("div", "svc-head");
    head.appendChild(el("h3", null, ms.microservice_name || "unnamed"));
    if (ms.microservice_namespace) head.appendChild(el("span", "svc-ns", "namespace " + ms.microservice_namespace));
    if (mk.added) head.appendChild(el("span", "tag tag-new", "New in this draft"));
    if (mk.errors.length) head.appendChild(el("span", "tag tag-error", plural(mk.errors.length, "problem")));
    sec.appendChild(head);
    if (mk.errors.length) {
      const eu = el("ul", "svc-errors");
      for (const e of mk.errors) eu.appendChild(el("li", null, e));
      sec.appendChild(eu);
    }

    const dl = el("dl", "facts");
    const fact = (label, fields, content) => {
      const changed = fields.some((f) => mk.changed.includes(f));
      const dt = el("dt", changed ? "changed" : null, label);
      if (changed) dt.title = "Changed since the previous draft";
      const dd = el("dd");
      if (typeof content === "string") dd.textContent = content; else dd.appendChild(content);
      dl.append(dt, dd);
    };

    fact("Image", ["code"], el("code", null, ms.code || "none"));
    if (ms.virtualization && ms.virtualization !== "container") fact("Runtime", ["virtualization"], ms.virtualization);
    const pp = parsePorts(ms.port);
    if (pp.length) {
      const chips = el("div", "chips");
      for (const p of pp) chips.appendChild(el("span", "chip", portLabel(p)));
      fact("Ports", ["port"], chips);
    } else if (mk.changed.includes("port")) {
      fact("Ports", ["port"], "Not exposed");
    }
    const res = [plural(Number(ms.vcpus) || 0, "vCPU", "vCPU"), formatMb(Number(ms.memory) || 0) + " memory"];
    if (ms.vgpus) res.push(plural(ms.vgpus, "GPU"));
    if (ms.storage) res.push(formatMb(ms.storage) + " storage");
    fact("Resources", ["vcpus", "vgpus", "memory", "storage"], res.join(", "));
    if (ms.addresses?.rr_ip) {
      const ipBox = el("span");
      ipBox.appendChild(el("code", null, ms.addresses.rr_ip));
      const re = ipPattern(ms.addresses.rr_ip);
      const users = list
        .filter((o) => o !== s && refsFor(o.ms).some((r) => re.test(r.value)))
        .map((o) => o.ms.microservice_name);
      ipBox.appendChild(el("span", "env-ref", users.length ? "used by " + joinWords(users) : "not used by other services"));
      fact("Service IP", ["addresses"], ipBox);
    }
    if ((ms.environment || []).length) {
      const env = el("div", "env");
      for (const e of ms.environment) {
        const i = e.indexOf("=");
        const key = i >= 0 ? e.slice(0, i) : e, val = i >= 0 ? e.slice(i + 1) : "";
        env.appendChild(el("span", "env-key", key));
        const v = el("span", "env-val", val);
        for (const [ip, target] of Object.entries(byIp)) {
          if (target === s || !ipPattern(ip).test(val)) continue;
          const ref = el("button", "env-ref", "reaches " + target.ms.microservice_name);
          ref.type = "button";
          ref.addEventListener("click", () => focusService(target));
          v.appendChild(ref);
        }
        env.appendChild(v);
      }
      fact("Environment", ["environment"], env);
    }
    if ((ms.cmd || []).length) fact("Command", ["cmd"], el("code", null, ms.cmd.join(" ")));
    if ((ms.constraints || []).length) {
      fact("Placement", ["constraints"], ms.constraints.map((c) =>
        c.node ? "Pinned to node " + c.node : c.cluster ? "Pinned to cluster " + c.cluster : "Direct constraint",
      ).join(", "));
    }
    sec.appendChild(dl);
    root.appendChild(sec);
  }
}
