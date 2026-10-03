import "@xyflow/react/dist/style.css";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSimpleBezierPath,
  MarkerType,
  Position,
} from "@xyflow/react";
import type { Edge as FlowEdge, EdgeProps, Node as FlowNode, NodeProps } from "@xyflow/react";
import { createContext, useContext, useMemo, useState } from "react";
import { Canvas } from "@/components/ai-elements/canvas";
import { Controls } from "@/components/ai-elements/controls";
import { Node, NodeContent } from "@/components/ai-elements/node";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { plural } from "@/lib/format";
import { parsePorts, serviceName, shortImage } from "@/lib/sla";
import type { ServiceLink } from "@/lib/sla";
import type { ServiceEntry } from "@/lib/types";
import { focusService } from "./focus-service";
import { computeMapLayout, NODE_H, NODE_W, OUTSIDE_H, OUTSIDE_W, serviceId } from "./map-layout";
import type { ServiceMark } from "./marks";
import "./output.css";
import { OutsidePreview, ServicePreview } from "./service-preview";
import { useIsDark } from "@/hooks/use-is-dark";

interface ServiceNodeData extends Record<string, unknown> {
  entry: ServiceEntry;
  mark: ServiceMark;
  links: ServiceLink[];
  name: string;
  image: string;
  flag: { text: string; tone: "bad" | "warn" } | null;
}

interface OutsideNodeData extends Record<string, unknown> {
  exposed: ServiceEntry[];
}

type ServiceFlowNode = FlowNode<ServiceNodeData, "service">;
type OutsideFlowNode = FlowNode<OutsideNodeData, "outside">;

// Hover is handled on the canvas. Focus has to be handled inside the nodes, and React Flow
// renders those from the static nodeTypes map, so they get the setter through context.
// Dimming goes through context too: handing React Flow a copied node object makes it drop
// the node's measurements, which hides the node and unmounts its edges until it re-measures.
interface ActiveNodeState {
  setFocused: (id: string | null) => void;
  lit: Set<string> | null;
}
const ActiveNodeContext = createContext<ActiveNodeState>({ setFocused: () => {}, lit: null });

function useActiveNode(id: string) {
  const { setFocused, lit } = useContext(ActiveNodeContext);
  return {
    handlers: { onFocus: () => setFocused(id), onBlur: () => setFocused(null) },
    dimClass: lit && !lit.has(id) ? "is-dimmed" : "",
  };
}

function ServiceNode({ id, data }: NodeProps<ServiceFlowNode>) {
  const tone = data.flag?.tone;
  const { handlers, dimClass } = useActiveNode(id);
  return (
    <Node
      handles={{ target: true, source: true }}
      className={`service-map-node ${dimClass} ${tone === "bad" ? "border-rust" : tone === "warn" ? "border-amber-dot" : ""}`}
      style={{ width: NODE_W, height: NODE_H }}
    >
      <NodeContent className="h-full p-0">
        <HoverCard openDelay={250} closeDelay={100}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              aria-label={"Show " + data.name}
              onClick={() => focusService(data.entry)}
              {...handlers}
              className="flex h-full w-full flex-col justify-center gap-0.5 rounded-md px-3 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-semibold">{data.name}</span>
                {data.flag && (
                  <span
                    className={`shrink-0 text-[10.5px] font-semibold ${data.flag.tone === "bad" ? "text-rust" : "text-amber"}`}
                  >
                    {data.flag.text}
                  </span>
                )}
              </span>
              <span className="truncate font-mono text-[11px] text-muted-foreground">{data.image}</span>
            </button>
          </HoverCardTrigger>
          <HoverCardContent side="bottom" align="center" collisionPadding={16} className="w-72">
            <ServicePreview service={data.entry} mark={data.mark} links={data.links} />
          </HoverCardContent>
        </HoverCard>
      </NodeContent>
    </Node>
  );
}

function OutsideNode({ id, data }: NodeProps<OutsideFlowNode>) {
  const { handlers, dimClass } = useActiveNode(id);
  return (
    <Node
      handles={{ target: false, source: true }}
      className={`service-map-node ${dimClass} items-center justify-center rounded-full bg-muted`}
      style={{ width: OUTSIDE_W, height: OUTSIDE_H }}
    >
      <HoverCard openDelay={250} closeDelay={100}>
        <HoverCardTrigger asChild>
          <span
            // Focusable so keyboard users get the same port summary as a hover.
            tabIndex={0}
            {...handlers}
            className="flex h-full items-center justify-center rounded-full text-xs font-medium text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Outside
          </span>
        </HoverCardTrigger>
        <HoverCardContent side="bottom" align="center" collisionPadding={16} className="w-64">
          <OutsidePreview exposed={data.exposed} />
        </HoverCardContent>
      </HoverCard>
    </Node>
  );
}

function EdgeLabel({
  x,
  y,
  text,
  port,
  dimmed,
}: {
  x: number;
  y: number;
  text: string;
  port?: boolean;
  dimmed?: boolean;
}) {
  if (!text) return null;
  return (
    <EdgeLabelRenderer>
      <div
        className={`service-map-label pointer-events-none absolute rounded bg-card/90 px-1 font-mono text-[10px] ${port ? "text-primary" : "text-muted-foreground"} ${dimmed ? "is-dimmed" : ""}`}
        style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
      >
        {text}
      </div>
    </EdgeLabelRenderer>
  );
}

function ServiceEdge(props: EdgeProps) {
  const port = props.type === "port";
  // Not Edge.Animated: its dot loops forever and ignores prefers-reduced-motion.
  const [path, x, y] = (port ? getSimpleBezierPath : getBezierPath)({
    ...props,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  });
  return (
    <>
      <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} style={props.style} />
      <EdgeLabel x={x} y={y} text={String(props.label ?? "")} port={port} dimmed={!!props.data?.dimmed} />
    </>
  );
}

const nodeTypes = { service: ServiceNode, outside: OutsideNode };
const edgeTypes = { link: ServiceEdge, port: ServiceEdge };

interface Props {
  list: ServiceEntry[];
  links: ServiceLink[];
  marks: Record<string, ServiceMark>;
}

export function ServiceMap({ list, links, marks }: Props) {
  const dark = useIsDark();
  const layout = useMemo(() => computeMapLayout(list, links), [list, links]);
  // Kept apart so a mouse leaving some node does not clear a keyboard user's focused node.
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  const nodes = useMemo(() => {
    const out: (ServiceFlowNode | OutsideFlowNode)[] = list.map((s) => {
      const mk = marks[s.key];
      const flag: ServiceNodeData["flag"] = mk.errors.length
        ? { text: plural(mk.errors.length, "problem"), tone: "bad" }
        : mk.added
          ? { text: "new", tone: "warn" }
          : mk.changed.length
            ? { text: "changed", tone: "warn" }
            : null;
      return {
        id: serviceId(s),
        type: "service",
        position: layout.positions[serviceId(s)],
        data: {
          entry: s,
          mark: mk,
          links,
          name: serviceName(s),
          image: shortImage(s.ms.code),
          flag,
        },
      } satisfies ServiceFlowNode;
    });
    if (layout.outside) {
      out.push({
        id: "outside",
        type: "outside",
        position: layout.outside,
        data: {
          exposed: list.filter((s) => layout.exposed.includes(serviceId(s))),
        },
      });
    }
    return out;
  }, [list, links, marks, layout]);

  const edges = useMemo(() => {
    const arrow = { type: MarkerType.ArrowClosed, color: "var(--primary)" } as const;
    const out: FlowEdge[] = links.map((l, i) => ({
      id: `link-${i}`,
      type: "link",
      source: serviceId(l.from),
      target: serviceId(l.to),
      label: l.label,
      markerEnd: arrow,
      style: { stroke: "var(--primary)", strokeWidth: 1.3 },
    }));
    for (const s of list) {
      if (!layout.exposed.includes(serviceId(s))) continue;
      out.push({
        id: `port-${serviceId(s)}`,
        type: "port",
        source: "outside",
        target: serviceId(s),
        label: parsePorts(s.ms.port)
          .map((p) => p.host)
          .join(", "),
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--ring)" },
        style: { stroke: "var(--ring)", strokeWidth: 1.3, strokeDasharray: "5 5" },
      });
    }
    return out;
  }, [list, links, layout]);

  // fitView only runs on mount, so a changed structure remounts the canvas to refit.
  const structure = `${Object.entries(layout.positions)
    .map(([id, p]) => `${id}@${p.x},${p.y}`)
    .join("|")}#${edges.map((e) => `${e.source}>${e.target}`).join("|")}`;

  // The remount throws away the hovered or focused element without a mouseleave or blur,
  // which would leave the map dimmed around a node nobody is pointing at any more.
  const [shownStructure, setShownStructure] = useState(structure);
  if (shownStructure !== structure) {
    setShownStructure(structure);
    setHovered(null);
    setFocused(null);
  }
  const active = hovered ?? focused;

  // While a node is hovered or focused, everything not directly connected to it fades back.
  const lit = useMemo(() => {
    if (!active) return null;
    const touching = edges.filter((e) => e.source === active || e.target === active);
    return {
      nodes: new Set([active, ...touching.flatMap((e) => [e.source, e.target])]),
      edges: new Set(touching.map((e) => e.id)),
    };
  }, [active, edges]);
  const activeNode = useMemo(() => ({ setFocused, lit: lit?.nodes ?? null }), [lit]);
  const shownEdges = useMemo(
    () =>
      lit
        ? edges.map((e) =>
            lit.edges.has(e.id)
              ? e
              : {
                  ...e,
                  className: "is-dimmed",
                  data: { ...e.data, dimmed: true },
                },
          )
        : edges,
    [edges, lit],
  );

  const height = Math.min(340, Math.max(260, layout.height + 56));

  return (
    <div
      className="service-map overflow-hidden rounded-lg border"
      style={{ height }}
      role="group"
      aria-label={`Service map: ${plural(list.length, "service")}, ${plural(links.length, "connection")}`}
    >
      <ActiveNodeContext value={activeNode}>
        <Canvas
          key={structure}
          nodes={nodes}
          edges={shownEdges}
          // React Flow only enables pointer events on nodes that are selectable, draggable or
          // have mouse handlers. Without these the pane gets every hover and click.
          onNodeMouseEnter={(_, n) => setHovered(n.id)}
          onNodeMouseLeave={() => setHovered(null)}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          colorMode={dark ? "dark" : "light"}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          // Canvas turns this on, but nothing here is selectable, so dragging would only draw an empty box.
          selectionOnDrag={false}
          panOnScroll={false}
          zoomOnScroll={false}
          // Let the wheel keep scrolling the pane; zoom stays on the controls and pinch.
          preventScrolling={false}
          minZoom={0.3}
          fitViewOptions={{ padding: 0.12, maxZoom: 1.1 }}
        >
          <Controls showInteractive={false} />
        </Canvas>
      </ActiveNodeContext>
    </div>
  );
}
