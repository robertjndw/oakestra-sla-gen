import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMb, joinWords, plural } from "@/lib/format";
import { parsePorts, portLabel, splitEnv } from "@/lib/sla";
import type { IpTarget, ServiceLink } from "@/lib/sla";
import type { ServiceEntry } from "@/lib/types";
import { focusService } from "./focus-service";
import { serviceId } from "./map-layout";
import type { ServiceMark } from "./marks";

interface Props {
  service: ServiceEntry;
  mark: ServiceMark;
  links: ServiceLink[];
  /** Services that own an IP, so environment values pointing at them get a "reaches" jump link. */
  targets: IpTarget[];
}

function Fact({
  label,
  changed,
  children,
}: {
  label: string;
  changed: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <dt
        className={changed ? "font-medium text-amber" : "text-muted-foreground"}
        title={changed ? "Changed since the previous draft" : undefined}
      >
        {label}
      </dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

const Code = ({ children }: { children: ReactNode }) => (
  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">{children}</code>
);

export function ServiceCard({ service: s, mark, links, targets }: Props) {
  const ms = s.ms;
  const has = (...fields: string[]) => fields.some((f) => mark.changed.includes(f));
  const ports = parsePorts(ms.port);
  const resources = [
    plural(Number(ms.vcpus) || 0, "vCPU", "vCPU"),
    formatMb(Number(ms.memory) || 0) + " memory",
  ];
  if (ms.vgpus) resources.push(plural(ms.vgpus, "GPU"));
  if (ms.storage) resources.push(formatMb(ms.storage) + " storage");
  const users = links.filter((l) => l.to === s).map((l) => l.from.ms.microservice_name ?? "unnamed");

  return (
    <Card
      id={serviceId(s)}
      className="scroll-mt-4 gap-3 py-4 data-[errors=true]:border-rust/60"
      data-errors={mark.errors.length > 0}
    >
      <CardHeader className="gap-1.5 px-4">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{ms.microservice_name || "unnamed"}</CardTitle>
          {ms.microservice_namespace && (
            <span className="text-xs text-muted-foreground">namespace {ms.microservice_namespace}</span>
          )}
          {mark.added && <Badge className="bg-amber-soft text-amber">New in this draft</Badge>}
          {mark.errors.length > 0 && (
            <Badge className="bg-rust-soft text-rust">{plural(mark.errors.length, "problem")}</Badge>
          )}
        </div>
        {mark.errors.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-rust">
            {mark.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
      </CardHeader>
      <CardContent className="px-4">
        <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
          <Fact label="Image" changed={has("code")}>
            <Code>{ms.code || "none"}</Code>
          </Fact>
          {ms.virtualization && ms.virtualization !== "container" && (
            <Fact label="Runtime" changed={has("virtualization")}>
              {ms.virtualization}
            </Fact>
          )}
          {ports.length > 0 ? (
            <Fact label="Ports" changed={has("port")}>
              <div className="flex flex-wrap gap-1.5">
                {ports.map((p, i) => (
                  <Badge key={i} variant="secondary" className="font-mono">
                    {portLabel(p)}
                  </Badge>
                ))}
              </div>
            </Fact>
          ) : (
            has("port") && (
              <Fact label="Ports" changed>
                Not exposed
              </Fact>
            )
          )}
          <Fact label="Resources" changed={has("vcpus", "vgpus", "memory", "storage")}>
            {resources.join(", ")}
          </Fact>
          {ms.addresses?.rr_ip && (
            <Fact label="Service IP" changed={has("addresses")}>
              <Code>{ms.addresses.rr_ip}</Code>{" "}
              <span className="text-xs text-muted-foreground">
                {users.length ? "used by " + joinWords(users) : "not used by other services"}
              </span>
            </Fact>
          )}
          {(ms.environment ?? []).length > 0 && (
            <Fact label="Environment" changed={has("environment")}>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-xs">
                {(ms.environment ?? []).map((entry, i) => {
                  const { key, value } = splitEnv(entry);
                  return (
                    <div key={i} className="contents">
                      <span className="text-muted-foreground">{key}</span>
                      <span className="break-all">
                        {value}
                        {targets
                          .filter((t) => t.target !== s && t.re.test(value))
                          .map((t) => (
                            <button
                              key={serviceId(t.target)}
                              type="button"
                              className="ml-2 rounded text-primary underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                              onClick={() => focusService(t.target)}
                            >
                              reaches {t.target.ms.microservice_name}
                            </button>
                          ))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Fact>
          )}
          {(ms.cmd ?? []).length > 0 && (
            <Fact label="Command" changed={has("cmd")}>
              <Code>{(ms.cmd ?? []).join(" ")}</Code>
            </Fact>
          )}
          {(ms.constraints ?? []).length > 0 && (
            <Fact label="Placement" changed={has("constraints")}>
              {(ms.constraints as { node?: string; cluster?: string }[])
                .map((c) =>
                  c.node
                    ? "Pinned to node " + c.node
                    : c.cluster
                      ? "Pinned to cluster " + c.cluster
                      : "Direct constraint",
                )
                .join(", ")}
            </Fact>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}
