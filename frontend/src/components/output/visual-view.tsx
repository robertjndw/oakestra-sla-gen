import { OctagonAlertIcon, TriangleAlertIcon } from "lucide-react";
import { lazy, Suspense, useMemo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { findLinks, ipTargets, services } from "@/lib/sla";
import type { Sla } from "@/lib/types";
import { buildMarks } from "./marks";
import { problemsByService } from "./problems";
import type { ParseError } from "@/hooks/use-validation";
import { ServiceCard } from "./service-card";
import { summarize } from "./summary";

// React Flow is the heaviest part of the Visual view and not needed to read the cards.
const ServiceMap = lazy(() => import("./service-map").then((m) => ({ default: m.ServiceMap })));

interface Props {
  sla: Sla;
  previous: Sla | null;
  errors: string[];
  parseError: ParseError | null;
}

export function VisualView({ sla, previous, errors, parseError }: Props) {
  const list = useMemo(() => services(sla), [sla]);
  const links = useMemo(() => findLinks(list), [list]);
  const problems = useMemo(() => problemsByService(errors, parseError), [errors, parseError]);
  const marks = useMemo(() => buildMarks(list, sla, previous, problems), [list, sla, previous, problems]);
  const targets = useMemo(() => ipTargets(list), [list]);

  const apps = sla.applications ?? [];
  const description = apps.length === 1 ? apps[0].application_desc : "";
  const exposed = list.some((s) => s.ms.port);
  const multiApp = apps.length > 1;

  return (
    <div className="space-y-4">
      {parseError && (
        <Alert variant="warning" role="status">
          <TriangleAlertIcon />
          <AlertDescription>
            The JSON in Code has a syntax error, so this shows the last version that parsed.
          </AlertDescription>
        </Alert>
      )}
      <div className="space-y-1">
        <p className="text-[15px] font-semibold">{summarize(sla, list)}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {problems.global.length > 0 && (
        <Alert variant="danger" role="status">
          <OctagonAlertIcon />
          <AlertDescription>
            <ul className="list-disc space-y-0.5 pl-4">
              {problems.global.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {list.length > 0 && (
        <div className="space-y-2">
          <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />}>
            <ServiceMap list={list} links={links} marks={marks} />
          </Suspense>
          <MapLegend links={links.length > 0} exposed={exposed} several={list.length > 1} />
        </div>
      )}
      <div className="space-y-4">
        {list.map((s, i) => (
          <div key={s.key + i} className="space-y-3">
            {multiApp && (i === 0 || list[i - 1].app !== s.app) && (
              <p className="pt-2 text-sm">
                <strong>{s.app.application_name || "Application"}</strong>
                {s.app.application_desc && (
                  <span className="text-muted-foreground">{"  " + s.app.application_desc}</span>
                )}
              </p>
            )}
            <ServiceCard service={s} mark={marks[s.key]} links={links} targets={targets} />
          </div>
        ))}
      </div>
    </div>
  );
}

function LegendLine({ dashed }: { dashed?: boolean }) {
  return (
    <svg width="28" height="8" viewBox="0 0 28 8" aria-hidden className="shrink-0">
      <line
        x1="0"
        y1="4"
        x2="22"
        y2="4"
        stroke={dashed ? "var(--ring)" : "var(--primary)"}
        strokeWidth="1.3"
        strokeDasharray={dashed ? "4 3" : undefined}
      />
      <path d="M22 1 L28 4 L22 7 Z" fill={dashed ? "var(--ring)" : "var(--primary)"} />
    </svg>
  );
}

function MapLegend({ links, exposed, several }: { links: boolean; exposed: boolean; several: boolean }) {
  if (!links && !exposed && !several) return null;
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
      {links && (
        <span className="inline-flex items-center gap-2">
          <LegendLine />
          Uses the service&apos;s IP, labelled with the variable that holds it
        </span>
      )}
      {!links && several && <span>No service uses another service&apos;s IP</span>}
      {exposed && (
        <span className="inline-flex items-center gap-2">
          <LegendLine dashed />
          Port open to the outside
        </span>
      )}
    </div>
  );
}
