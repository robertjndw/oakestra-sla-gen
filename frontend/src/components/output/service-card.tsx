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
      className="slagen:group/row slagen:col-span-2 slagen:grid slagen:grid-cols-subgrid slagen:rounded-sm slagen:transition-[background-color,box-shadow] slagen:data-[highlighted=true]:bg-accent slagen:data-[highlighted=true]:ring-4 slagen:data-[highlighted=true]:ring-accent slagen:motion-reduce:transition-none"
    >
      {changed ? (
        <dt>
          <Tooltip>
            {/* Focusable so the tooltip also opens from the keyboard. */}
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                className="slagen:inline-flex slagen:items-center slagen:gap-1.5 slagen:rounded-sm slagen:font-medium slagen:text-amber slagen:focus-visible:ring-2 slagen:focus-visible:ring-ring slagen:focus-visible:outline-none"
              >
                <span aria-hidden className="slagen:size-1.5 slagen:shrink-0 slagen:rounded-full slagen:bg-amber-dot" />
                {label}
                <span className="slagen:sr-only">(changed)</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>Changed since the previous draft</TooltipContent>
          </Tooltip>
        </dt>
      ) : (
        <dt className="slagen:text-muted-foreground">{label}</dt>
      )}
      <dd className="slagen:min-w-0 slagen:break-words">{children}</dd>
    </div>
  );
}

const Code = ({ children }: { children: ReactNode }) => (
  <code className="slagen:rounded slagen:bg-muted slagen:px-1.5 slagen:py-0.5 slagen:font-mono slagen:text-xs slagen:break-all">{children}</code>
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
      className="slagen:scroll-mt-4 slagen:gap-0 slagen:py-0 slagen:transition-shadow slagen:data-[errors=true]:ring-rust/60 slagen:data-[highlighted=true]:ring-2 slagen:data-[highlighted=true]:ring-primary slagen:motion-reduce:transition-none"
      data-errors={mark.errors.length > 0}
    >
      <div className="slagen:flex slagen:flex-col slagen:gap-1.5 slagen:border-b slagen:bg-muted/40 slagen:px-4 slagen:py-2.5">
        <div className="slagen:flex slagen:flex-wrap slagen:items-center slagen:gap-2">
          <CardTitle className="slagen:text-sm slagen:font-semibold">{serviceName(s)}</CardTitle>
          {ms.microservice_namespace && (
            <span className="slagen:text-xs slagen:text-muted-foreground">namespace {ms.microservice_namespace}</span>
          )}
          {mark.added && <Badge variant="warning">New in this draft</Badge>}
          {mark.errors.length > 0 && (
            <Badge variant="danger">{plural(mark.errors.length, "problem")}</Badge>
          )}
        </div>
        {mark.errors.length > 0 && (
          <ul className="slagen:list-disc slagen:space-y-0.5 slagen:pl-5 slagen:text-sm slagen:text-rust">
            {mark.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
      </div>
      <CardContent className="slagen:px-4 slagen:py-3.5">
        <dl className="slagen:grid slagen:grid-cols-[6.25rem_minmax(0,1fr)] slagen:gap-x-3 slagen:gap-y-2 slagen:text-sm">
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
              <div className="slagen:flex slagen:flex-wrap slagen:items-center slagen:gap-1.5">
                {ports.map((p, i) => (
                  <Badge key={i} variant="secondary" className="slagen:font-mono">
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
              <span className="slagen:text-xs slagen:text-muted-foreground">
                {users.length ? "used by " + joinWords(users) : "not used by other services"}
              </span>
            </Fact>
          )}
          {(ms.environment ?? []).length > 0 && (
            <Fact row="environment" label="Environment" changed={has("environment")} highlighted={on("environment")}>
              <div className="slagen:grid slagen:grid-cols-[auto_minmax(0,1fr)] slagen:gap-x-3 slagen:gap-y-1 slagen:font-mono slagen:text-xs">
                {(ms.environment ?? []).map((entry, i) => {
                  const { key, value } = splitEnv(entry);
                  return (
                    // Keyed by name as well, so a revealed value can't pass to another variable when the list changes.
                    <div key={key + i} className="slagen:group/env slagen:col-span-2 slagen:grid slagen:grid-cols-subgrid">
                      <span className="slagen:text-muted-foreground">{key}</span>
                      <span className="slagen:break-all">
                        {/* Keyed by value, so a revealed secret is masked again when a new draft changes it. */}
                        <EnvValue key={value} name={key} value={value} />
                        {targets
                          .filter((t) => t.target !== s && t.re.test(value))
                          .map((t) => (
                            <button
                              key={serviceId(t.target)}
                              type="button"
                              className="slagen:ml-2 slagen:rounded slagen:text-primary slagen:underline-offset-2 slagen:hover:underline slagen:focus-visible:ring-2 slagen:focus-visible:ring-ring slagen:focus-visible:outline-none"
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
