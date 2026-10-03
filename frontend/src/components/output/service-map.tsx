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
import { useMemo } from "react";
import { Canvas } from "@/components/ai-elements/canvas";
import { Controls } from "@/components/ai-elements/controls";
import { Edge } from "@/components/ai-elements/edge";
import { Node, NodeContent } from "@/components/ai-elements/node";
import { plural } from "@/lib/format";
import { parsePorts, shortImage } from "@/lib/sla";
import type { ServiceLink } from "@/lib/sla";
import type { ServiceEntry } from "@/lib/types";
import { focusService } from "./focus-service";
import { computeMapLayout, NODE_H, NODE_W, OUTSIDE_H, OUTSIDE_W, serviceId } from "./map-layout";
import type { ServiceMark } from "./marks";
import "./output.css";
import { useIsDark } from "./use-is-dark";

interface ServiceNodeData extends Record<string, unknown> {
  entry: ServiceEntry;
  name: string;
  image: string;
  flag: { text: string; tone: "bad" | "warn" } | null;
}

type ServiceFlowNode = FlowNode<ServiceNodeData, "service">;
type OutsideFlowNode = FlowNode<Record<string, never>, "outside">;

function ServiceNode({ data }: NodeProps<ServiceFlowNode>) {
  const tone = data.flag?.tone;
  return (
    <Node
      handles={{ target: true, source: true }}
      className={tone === "bad" ? "border-rust" : tone === "warn" ? "border-amber-dot" : ""}
      style={{ width: NODE_W, height: NODE_H }}
    >
      <NodeContent className="h-full p-0">
        <button
          type="button"
          aria-label={"Show " + data.name}
          onClick={() => focusService(data.entry)}
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
      </NodeContent>
    </Node>
  );
}

function OutsideNode() {
  return (
    <Node
      handles={{ target: false, source: true }}
      className="items-center justify-center rounded-full bg-muted"
      style={{ width: OUTSIDE_W, height: OUTSIDE_H }}
    >
      <span className="flex h-full items-center justify-center text-xs font-medium text-muted-foreground">
        Outside
      </span>
    </Node>
  );
}

function EdgeLabel({ x, y, text, port }: { x: number; y: number; text: string; port?: boolean }) {
  if (!text) return null;
  return (
    <EdgeLabelRenderer>
      <div
        className={`pointer-events-none absolute rounded bg-card/90 px-1 font-mono text-[10px] ${port ? "text-primary" : "text-muted-foreground"}`}
        style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
      >
        {text}
      </div>
    </EdgeLabelRenderer>
  );
}

function LinkEdge(props: EdgeProps) {
  const [, x, y] = getBezierPath({ ...props, sourcePosition: Position.Right, targetPosition: Position.Left });
  return (
    <>
      <Edge.Animated {...props} />
      <EdgeLabel x={x} y={y} text={String(props.label ?? "")} />
    </>
  );
}

function PortEdge(props: EdgeProps) {
  const [path, x, y] = getSimpleBezierPath({
    ...props,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  });
  return (
    <>
      <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} style={props.style} />
      <EdgeLabel x={x} y={y} text={String(props.label ?? "")} port />
    </>
  );
}

const nodeTypes = { service: ServiceNode, outside: OutsideNode };
const edgeTypes = { link: LinkEdge, port: PortEdge };

interface Props {
  list: ServiceEntry[];
  links: ServiceLink[];
  marks: Record<string, ServiceMark>;
}

export function ServiceMap({ list, links, marks }: Props) {
  const dark = useIsDark();
  const layout = useMemo(() => computeMapLayout(list, links), [list, links]);

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
        draggable: false,
        connectable: false,
        selectable: false,
        data: {
          entry: s,
          name: s.ms.microservice_name || "unnamed",
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
        draggable: false,
        connectable: false,
        selectable: false,
        data: {},
      });
    }
    return out;
  }, [list, marks, layout]);

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
  const height = Math.min(340, Math.max(260, layout.height + 56));

  return (
    <div
      className="service-map overflow-hidden rounded-lg border"
      style={{ height }}
      role="group"
      aria-label={`Service map: ${plural(list.length, "service")}, ${plural(links.length, "connection")}`}
    >
      <Canvas
        key={structure}
        nodes={nodes}
        edges={edges}
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
        fitViewOptions={{ padding: 0.12, maxZoom: 1.1 }}
      >
        <Controls showInteractive={false} />
      </Canvas>
    </div>
  );
}
