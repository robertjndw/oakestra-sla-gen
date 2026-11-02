import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  getBezierPath,
  getSimpleBezierPath,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
} from "@xyflow/react";
import type { Edge as FlowEdge, EdgeProps, Node as FlowNode, NodeProps } from "@xyflow/react";
import { createContext, useContext, useMemo, useState, type ComponentProps } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { plural } from "@/lib/format";
import { parsePorts, serviceName, shortImage } from "@/lib/sla";
import type { ServiceLink } from "@/lib/sla";
import type { ServiceEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { focusService } from "./focus-service";
import { computeMapLayout, NODE_H, NODE_W, OUTSIDE_H, OUTSIDE_W, serviceId } from "./map-layout";
import type { ServiceMark } from "./marks";
import { OutsidePreview, ServicePreview } from "./service-preview";
import { useIsDark } from "@/hooks/use-is-dark";
import { injectXyflowStyles } from "./xyflow-styles";

injectXyflowStyles();

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
// Nodes, edges and edge labels fade together when the map dims around the active node.
const FADES = "slagen:transition-opacity slagen:duration-150 slagen:ease-[ease-out] slagen:motion-reduce:transition-none";
const DIMMED = "slagen:opacity-30";

interface ActiveNodeState {
  setFocused: (id: string | null) => void;
  lit: Set<string> | null;
}
const ActiveNodeContext = createContext<ActiveNodeState>({ setFocused: () => {}, lit: null });

function useActiveNode(id: string) {
  const { setFocused, lit } = useContext(ActiveNodeContext);
  return {
    handlers: { onFocus: () => setFocused(id), onBlur: () => setFocused(null) },
    dimClass: lit && !lit.has(id) ? DIMMED : "",
  };
}

function MapNode({
  handles,
  className,
  children,
  ...props
}: ComponentProps<typeof Card> & { handles: { target: boolean; source: boolean } }) {
  return (
    <Card className={cn("slagen:relative slagen:gap-0 slagen:rounded-md slagen:p-0", className)} {...props}>
      {/* Edges need handles to attach to, but nothing on this map can be connected by hand. */}
      {handles.target && <Handle position={Position.Left} type="target" className="slagen:pointer-events-none slagen:opacity-0" />}
      {handles.source && <Handle position={Position.Right} type="source" className="slagen:pointer-events-none slagen:opacity-0" />}
      {children}
    </Card>
  );
}

function ServiceNode({ id, data }: NodeProps<ServiceFlowNode>) {
  const tone = data.flag?.tone;
  const { handlers, dimClass } = useActiveNode(id);
  return (
    <MapNode
      handles={{ target: true, source: true }}
      className={`${FADES} ${dimClass} ${tone === "bad" ? "slagen:border-rust" : tone === "warn" ? "slagen:border-amber-dot" : ""}`}
      style={{ width: NODE_W, height: NODE_H }}
    >
      <CardContent className="slagen:h-full slagen:p-0">
        <HoverCard openDelay={250} closeDelay={100}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              aria-label={"Show " + data.name}
              onClick={() => focusService(data.entry)}
              {...handlers}
              className="slagen:flex slagen:h-full slagen:w-full slagen:flex-col slagen:justify-center slagen:gap-0.5 slagen:rounded-md slagen:px-3 slagen:text-left slagen:focus-visible:ring-2 slagen:focus-visible:ring-ring slagen:focus-visible:outline-none"
            >
              <span className="slagen:flex slagen:items-baseline slagen:justify-between slagen:gap-2">
                <span className="slagen:truncate slagen:text-[13px] slagen:font-semibold">{data.name}</span>
                {data.flag && (
                  <span
                    className={`slagen:shrink-0 slagen:text-[10.5px] slagen:font-semibold ${data.flag.tone === "bad" ? "slagen:text-rust" : "slagen:text-amber"}`}
                  >
                    {data.flag.text}
                  </span>
                )}
              </span>
              <span className="slagen:truncate slagen:font-mono slagen:text-[11px] slagen:text-muted-foreground">{data.image}</span>
            </button>
          </HoverCardTrigger>
          <HoverCardContent side="bottom" align="center" collisionPadding={16} className="slagen:w-72">
            <ServicePreview service={data.entry} mark={data.mark} links={data.links} />
          </HoverCardContent>
        </HoverCard>
      </CardContent>
    </MapNode>
  );
}

function OutsideNode({ id, data }: NodeProps<OutsideFlowNode>) {
  const { handlers, dimClass } = useActiveNode(id);
  return (
    <MapNode
      handles={{ target: false, source: true }}
      className={`${FADES} ${dimClass} slagen:items-center slagen:justify-center slagen:border slagen:border-dashed slagen:border-muted-foreground/40 slagen:bg-transparent slagen:ring-0`}
      style={{ width: OUTSIDE_W, height: OUTSIDE_H }}
    >
      <HoverCard openDelay={250} closeDelay={100}>
        <HoverCardTrigger asChild>
          <span
            // Focusable so keyboard users get the same port summary as a hover.
            tabIndex={0}
            {...handlers}
            className="slagen:flex slagen:h-full slagen:items-center slagen:justify-center slagen:rounded-md slagen:text-xs slagen:font-medium slagen:text-muted-foreground slagen:focus-visible:ring-2 slagen:focus-visible:ring-ring slagen:focus-visible:outline-none"
          >
            Outside
          </span>
        </HoverCardTrigger>
        <HoverCardContent side="bottom" align="center" collisionPadding={16} className="slagen:w-64">
          <OutsidePreview exposed={data.exposed} />
        </HoverCardContent>
      </HoverCard>
    </MapNode>
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
        className={`${FADES} slagen:pointer-events-none slagen:absolute slagen:rounded slagen:bg-card/90 slagen:px-1 slagen:font-mono slagen:text-[10px] ${port ? "slagen:text-primary" : "slagen:text-muted-foreground"} ${dimmed ? DIMMED : ""}`}
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

const FIT_PAD = { top: 8, bottom: 44, side: 12 };

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
      className: FADES,
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
        className: FADES,
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
                  className: `${FADES} ${DIMMED}`,
                  data: { ...e.data, dimmed: true },
                },
          )
        : edges,
    [edges, lit],
  );

  // The controls are a horizontal strip in the bottom-left corner, so fitView keeps a band free
  // below the nodes for them instead of the box needing slack all around. layout.height already
  // contains the layout's own padding.
  const height = Math.min(340, Math.max(150, layout.height + FIT_PAD.top + FIT_PAD.bottom));

  return (
    <div
      // React Flow's attribution has no className prop and the addon build rejects selectors on
      // its react-flow__ class, so data-message, which only the attribution carries, is the hook.
      className="slagen:overflow-hidden slagen:rounded-lg slagen:border slagen:[&_[data-message]]:bg-transparent slagen:[&_[data-message]]:opacity-60"
      style={{ height }}
      role="group"
      aria-label={`Service map: ${plural(list.length, "service")}, ${plural(links.length, "connection")}`}
    >
      <ActiveNodeContext value={activeNode}>
        <ReactFlow
          fitView
          panOnDrag={false}
          zoomOnDoubleClick={false}
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
          panOnScroll={false}
          zoomOnScroll={false}
          // Let the wheel keep scrolling the pane; zoom stays on the controls and pinch.
          preventScrolling={false}
          minZoom={0.3}
          fitViewOptions={{
            padding: {
              top: `${FIT_PAD.top}px`,
              bottom: `${FIT_PAD.bottom}px`,
              left: `${FIT_PAD.side}px`,
              right: `${FIT_PAD.side}px`,
            },
            maxZoom: 1,
          }}
        >
          {/* The default dot grid is texture that doesn't tell anyone anything. */}
          <Background bgColor="var(--sidebar)" color="transparent" />
          <Controls
            showInteractive={false}
            orientation="horizontal"
            className="slagen:gap-px slagen:overflow-hidden slagen:rounded-md slagen:border slagen:bg-card slagen:p-0.5 slagen:shadow-none! slagen:[&>button]:rounded-md slagen:[&>button]:border-none! slagen:[&>button]:bg-transparent! slagen:[&>button]:hover:bg-secondary!"
          />
        </ReactFlow>
      </ActiveNodeContext>
    </div>
  );
}
