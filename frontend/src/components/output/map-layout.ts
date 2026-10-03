import { parsePorts } from "@/lib/sla";
import type { ServiceLink } from "@/lib/sla";
import type { ServiceEntry } from "@/lib/types";

export const NODE_W = 184;
export const NODE_H = 64;
export const OUTSIDE_W = 92;
export const OUTSIDE_H = 36;
const GAP_X = 96;
const GAP_Y = 24;
const PAD = 16;

export const serviceId = (s: Pick<ServiceEntry, "ai" | "mi">) => `svc-${s.ai}-${s.mi}`;

export interface MapLayout {
  positions: Record<string, { x: number; y: number }>;
  /** Present when at least one service opens a port. */
  outside: { x: number; y: number } | null;
  /** Ids of services that open ports, in list order. */
  exposed: string[];
  width: number;
  height: number;
}

/**
 * Column = longest chain of callers above a service, so entry points sit on the left and
 * whatever they depend on fans out to the right. Positions are deterministic so the map does
 * not jump around while the user types.
 */
export function computeMapLayout(list: ServiceEntry[], links: ServiceLink[]): MapLayout {
  const exposed = list.filter((s) => parsePorts(s.ms.port).length).map(serviceId);
  const preds = new Map<ServiceEntry, ServiceEntry[]>();
  for (const s of list) preds.set(s, []);
  for (const l of links) preds.get(l.to)?.push(l.from);

  const depth = new Map<ServiceEntry, number>();
  const depthOf = (s: ServiceEntry, seen: ServiceEntry[]): number => {
    const known = depth.get(s);
    if (known !== undefined) return known;
    // A cycle would recurse forever; cut it where it closes.
    if (seen.includes(s)) return 0;
    let d = 0;
    for (const p of preds.get(s) ?? []) d = Math.max(d, depthOf(p, [...seen, s]) + 1);
    depth.set(s, d);
    return d;
  };

  const columns: ServiceEntry[][] = [];
  for (const s of list) (columns[depthOf(s, [])] ??= []).push(s);
  const dense = columns.filter(Boolean);
  if (!dense.length) return { positions: {}, outside: null, exposed, width: 0, height: 0 };

  const tallest = Math.max(...dense.map((c) => c.length));
  const height = PAD * 2 + tallest * NODE_H + (tallest - 1) * GAP_Y;
  const hasOutside = exposed.length > 0;
  const x0 = PAD + (hasOutside ? OUTSIDE_W + GAP_X : 0);
  const positions: MapLayout["positions"] = {};
  dense.forEach((col, ci) => {
    const colH = col.length * NODE_H + (col.length - 1) * GAP_Y;
    const top = (height - colH) / 2;
    col.forEach((s, ri) => {
      positions[serviceId(s)] = { x: x0 + ci * (NODE_W + GAP_X), y: top + ri * (NODE_H + GAP_Y) };
    });
  });
  const width = x0 + dense.length * NODE_W + (dense.length - 1) * GAP_X + PAD;
  return {
    positions,
    outside: hasOutside ? { x: PAD, y: (height - OUTSIDE_H) / 2 } : null,
    exposed,
    width,
    height,
  };
}
