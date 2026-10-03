import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { joinWords, plural } from "@/lib/format";
import { describePlacement, describeResources, fieldLabel, parsePorts, portLabel } from "@/lib/sla";
import type { ServiceLink } from "@/lib/sla";
import type { ServiceEntry } from "@/lib/types";
import type { ServiceMark } from "./marks";

interface Props {
  service: ServiceEntry;
  mark: ServiceMark;
  links: ServiceLink[];
}

// Enough to tell what is wrong at a glance; the card below the map has the full list.
const MAX_ERRORS = 2;

const nameOf = (s: ServiceEntry) => s.ms.microservice_name || "unnamed";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

/** Compact summary of a service for the map's hover card. */
export function ServicePreview({ service: s, mark, links }: Props) {
  const ms = s.ms;
  const ports = parsePorts(ms.port);
  const calls = links.filter((l) => l.from === s).map((l) => nameOf(l.to));
  const calledBy = links.filter((l) => l.to === s).map((l) => nameOf(l.from));
  const env = ms.environment ?? [];
  const placement = describePlacement(ms);

  return (
    <div className="space-y-3">
      <div className="space-y-0.5">
        <p className="font-semibold break-words">{nameOf(s)}</p>
        {ms.microservice_namespace && (
          <p className="text-xs text-muted-foreground">namespace {ms.microservice_namespace}</p>
        )}
      </div>

      {mark.errors.length > 0 && (
        // Alert defaults to role="alert", which would be announced every time the card opens.
        <Alert variant="danger" role="group" className="gap-1 rounded-md px-2.5 py-2 text-xs">
          <AlertTitle className="font-semibold">{plural(mark.errors.length, "problem")}</AlertTitle>
          <AlertDescription className="text-xs">
            <ul className="list-disc space-y-0.5 pl-4">
              {mark.errors.slice(0, MAX_ERRORS).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            {mark.errors.length > MAX_ERRORS && <p>and {mark.errors.length - MAX_ERRORS} more</p>}
          </AlertDescription>
        </Alert>
      )}
      {mark.added ? (
        <Badge variant="warning">New in this draft</Badge>
      ) : (
        mark.changed.length > 0 && (
          <Badge variant="warning" className="h-auto justify-start text-left whitespace-normal">
            Changed: {joinWords(mark.changed.map(fieldLabel))}
          </Badge>
        )
      )}

      <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
        <Row label="Image">
          <code className="font-mono break-all">{ms.code || "none"}</code>
        </Row>
        {ms.virtualization && ms.virtualization !== "container" && (
          <Row label="Runtime">{ms.virtualization}</Row>
        )}
        <Row label="Resources">{describeResources(ms)}</Row>
        {ports.length > 0 && <Row label="Ports">{ports.map(portLabel).join(", ")}</Row>}
        {ms.addresses?.rr_ip && (
          <Row label="Service IP">
            <code className="font-mono">{ms.addresses.rr_ip}</code>
          </Row>
        )}
        {calls.length > 0 && <Row label="Calls">{joinWords(calls)}</Row>}
        {calledBy.length > 0 && <Row label="Called by">{joinWords(calledBy)}</Row>}
        {env.length > 0 && <Row label="Environment">{plural(env.length, "variable")}</Row>}
        {placement && <Row label="Placement">{placement}</Row>}
      </dl>

      <p className="border-t pt-2 text-xs text-muted-foreground">Click for the full configuration</p>
    </div>
  );
}

/** Ports open to the outside, per service. */
export function OutsidePreview({ exposed }: { exposed: ServiceEntry[] }) {
  return (
    <div className="space-y-2">
      <p className="font-semibold">Open to the outside</p>
      <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
        {exposed.map((s, i) => (
          <Row key={i} label={nameOf(s)}>
            <span className="font-mono">{parsePorts(s.ms.port).map(portLabel).join(", ")}</span>
          </Row>
        ))}
      </dl>
    </div>
  );
}
