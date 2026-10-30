import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { serviceKey, type FactRow } from "@/lib/field-ref";
import { joinWords, plural } from "@/lib/format";
import { isSecretEnv, splitCmdSecrets } from "@/lib/secrets";
import { describePlacement, describeResources, parsePorts, portLabel, serviceName, splitEnv } from "@/lib/sla";
import type { IpTarget, ServiceLink } from "@/lib/sla";
import type { ServiceEntry } from "@/lib/types";
import { useFieldHighlight, useMountedService } from "./field-highlight";
import { focusService } from "./focus-service";
import { serviceId } from "./map-layout";
import type { ServiceMark } from "./marks";
import { CopyButton, Masked, RevealButton } from "./value-actions";

interface Props {
  service: ServiceEntry;
  mark: ServiceMark;
  links: ServiceLink[];
  /** Services that own an IP, so environment values pointing at them get a "reaches" jump link. */
  targets: IpTarget[];
}

function Fact({
  row,
  label,
  changed,
  highlighted,
  children,
}: {
  row: FactRow;
  label: string;
  changed: boolean;
  highlighted: boolean;
  children: ReactNode;
}) {
  return (
    // A subgrid row, so the highlight can cover label and value as one block. The ring is the
    // same color as the background and only pads the highlight out past the text.
    <div
      data-row={row}
      data-highlighted={highlighted}
      className="group/row col-span-2 grid grid-cols-subgrid rounded-sm transition-[background-color,box-shadow] data-[highlighted=true]:bg-accent data-[highlighted=true]:ring-4 data-[highlighted=true]:ring-accent motion-reduce:transition-none"
    >
      {changed ? (
        <dt>
          <Tooltip>
            {/* Focusable so the tooltip also opens from the keyboard. */}
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                className="inline-flex items-center gap-1.5 rounded-sm font-medium text-amber focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-amber-dot" />
                {label}
                <span className="sr-only">(changed)</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>Changed since the previous draft</TooltipContent>
          </Tooltip>
        </dt>
      ) : (
        <dt className="text-muted-foreground">{label}</dt>
      )}
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

const Code = ({ children }: { children: ReactNode }) => (
  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">{children}</code>
);

function EnvValue({ name, value }: { name: string; value: string }) {
  const secret = isSecretEnv(name, value);
  const [revealed, setRevealed] = useState(false);
  if (!secret) return <>{value}</>;
  return (
    <>
      {revealed ? value : <Masked />}
      <RevealButton revealed={revealed} what={`${name} value`} onToggle={() => setRevealed(!revealed)} />
    </>
  );
}

function CommandValue({ cmd }: { cmd: string[] }) {
  const args = splitCmdSecrets(cmd);
  const secret = args.some((a) => a.hidden);
  const [revealed, setRevealed] = useState(false);
  return (
    <>
      <Code>
        {args.map((a, i) => (
          <span key={i}>
            {i > 0 && " "}
            {a.shown}
            {a.hidden && (revealed ? a.hidden : <Masked />)}
          </span>
        ))}
      </Code>
      {secret && <RevealButton revealed={revealed} what="command" onToggle={() => setRevealed(!revealed)} />}
    </>
  );
}

export function ServiceCard({ service: s, mark, links, targets }: Props) {
  const ms = s.ms;
  const has = (...fields: string[]) => fields.some((f) => mark.changed.includes(f));
  const ports = parsePorts(ms.port);
  const users = links.filter((l) => l.to === s).map((l) => serviceName(l.from));
  const cmd = ms.cmd ?? [];

  useMountedService(ms.microservice_name);
  const highlight = useFieldHighlight(ms);
  const highlighted = highlight !== null;
  const on = (row: FactRow) => highlight === row;

  return (
    <Card
      id={serviceId(s)}
      data-service-name={serviceKey(ms.microservice_name)}
      data-highlighted={highlighted}
      className="scroll-mt-4 gap-0 py-0 transition-shadow data-[errors=true]:ring-rust/60 data-[highlighted=true]:ring-2 data-[highlighted=true]:ring-primary motion-reduce:transition-none"
      data-errors={mark.errors.length > 0}
    >
      <div className="flex flex-col gap-1.5 border-b bg-muted/40 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-sm font-semibold">{serviceName(s)}</CardTitle>
          {ms.microservice_namespace && (
            <span className="text-xs text-muted-foreground">namespace {ms.microservice_namespace}</span>
          )}
          {mark.added && <Badge variant="warning">New in this draft</Badge>}
          {mark.errors.length > 0 && (
            <Badge variant="danger">{plural(mark.errors.length, "problem")}</Badge>
          )}
        </div>
        {mark.errors.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-rust">
            {mark.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
      </div>
      <CardContent className="px-4 py-3.5">
        <dl className="grid grid-cols-[6.25rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
          <Fact row="code" label="Image" changed={has("code")} highlighted={on("code")}>
            <Code>{ms.code || "none"}</Code>
            {ms.code && <CopyButton value={ms.code} what="image" />}
          </Fact>
          {ms.virtualization && ms.virtualization !== "container" && (
            <Fact row="virtualization" label="Runtime" changed={has("virtualization")} highlighted={on("virtualization")}>
              {ms.virtualization}
            </Fact>
          )}
          {ports.length > 0 ? (
            <Fact row="port" label="Ports" changed={has("port")} highlighted={on("port")}>
              <div className="flex flex-wrap items-center gap-1.5">
                {ports.map((p, i) => (
                  <Badge key={i} variant="secondary" className="font-mono">
                    {portLabel(p)}
                  </Badge>
                ))}
                {/* The raw mapping, since that's what goes back into an SLA or compose file. */}
                <CopyButton value={ms.port ?? ""} what="ports" />
              </div>
            </Fact>
          ) : (
            has("port") && (
              <Fact row="port" label="Ports" changed highlighted={on("port")}>
                Not exposed
              </Fact>
            )
          )}
          <Fact
            row="resources"
            label="Resources"
            changed={has("vcpus", "vgpus", "memory", "storage")}
            highlighted={on("resources")}
          >
            {describeResources(ms)}
          </Fact>
          {ms.addresses?.rr_ip && (
            <Fact row="addresses" label="Service IP" changed={has("addresses")} highlighted={on("addresses")}>
              <Code>{ms.addresses.rr_ip}</Code>
              <CopyButton value={ms.addresses.rr_ip} what="service IP" />{" "}
              <span className="text-xs text-muted-foreground">
                {users.length ? "used by " + joinWords(users) : "not used by other services"}
              </span>
            </Fact>
          )}
          {(ms.environment ?? []).length > 0 && (
            <Fact row="environment" label="Environment" changed={has("environment")} highlighted={on("environment")}>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-xs">
                {(ms.environment ?? []).map((entry, i) => {
                  const { key, value } = splitEnv(entry);
                  return (
                    // Keyed by name as well, so a revealed value can't pass to another variable when the list changes.
                    <div key={key + i} className="group/env col-span-2 grid grid-cols-subgrid">
                      <span className="text-muted-foreground">{key}</span>
                      <span className="break-all">
                        {/* Keyed by value, so a revealed secret is masked again when a new draft changes it. */}
                        <EnvValue key={value} name={key} value={value} />
                        {targets
                          .filter((t) => t.target !== s && t.re.test(value))
                          .map((t) => (
                            <button
                              key={serviceId(t.target)}
                              type="button"
                              className="ml-2 rounded text-primary underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                              onClick={() => focusService(t.target)}
                            >
                              reaches {serviceName(t.target)}
                            </button>
                          ))}
                        <CopyButton value={value} what={`${key} value`} group="env" />
                      </span>
                    </div>
                  );
                })}
              </div>
            </Fact>
          )}
          {cmd.length > 0 && (
            <Fact row="cmd" label="Command" changed={has("cmd")} highlighted={on("cmd")}>
              <CommandValue key={cmd.join("\0")} cmd={cmd} />
              <CopyButton value={cmd.join(" ")} what="command" />
            </Fact>
          )}
          {(ms.constraints ?? []).length > 0 && (
            <Fact row="constraints" label="Placement" changed={has("constraints")} highlighted={on("constraints")}>
              {describePlacement(ms)}
            </Fact>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}
