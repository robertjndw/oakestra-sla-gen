import { lazy, Suspense, useMemo } from "react";
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
  const caption = [
    links.length
      ? "Arrows point to the service whose IP another one uses, labelled with the variable that holds it."
      : list.length > 1
        ? "No connections: no service uses another service's IP."
        : "",
    exposed ? "Dashed lines are ports opened to the outside." : "",
  ]
    .filter(Boolean)
    .join(" ");
  const multiApp = apps.length > 1;

  return (
    <div className="space-y-4">
      {parseError && (
        <p className="rounded-lg bg-amber-soft px-3 py-2 text-sm text-foreground" role="status">
          The JSON in Code has a syntax error, so this shows the last version that parsed.
        </p>
      )}
      <div className="space-y-1">
        <p className="text-base font-medium">{summarize(sla, list)}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {problems.global.length > 0 && (
        <ul className="list-disc space-y-0.5 rounded-lg bg-rust-soft py-2 pr-3 pl-7 text-sm text-rust">
          {problems.global.map((g, i) => (
            <li key={i}>{g}</li>
          ))}
        </ul>
      )}
      {list.length > 0 && (
        <div className="space-y-2">
          <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />}>
            <ServiceMap list={list} links={links} marks={marks} />
          </Suspense>
          {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
        </div>
      )}
      <div className="space-y-3">
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
