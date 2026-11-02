import { describeError, useAddonPath, useCurrentUser, useOakestraApi } from "@oakestra/dashboard-sdk";
import { Alert, AlertDescription, AlertTitle, Button, Skeleton } from "@oakestra/ui";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import { Link } from "react-router";
import type { PlaygroundActionsProps } from "@/host/host-context";
import { ensureApiBase } from "../ensure-api-base";
import { DashboardHost } from "../host/DashboardHost";
import { PlaygroundFrame } from "../layout/PlaygroundFrame";
import type { Application, Service } from "../types";
import { AddServicesButton } from "./AddServicesButton";
import { FullPageLink } from "./FullPageLink";
import { GeneratorContext } from "./generator-context";
import { generatorKeys } from "./queries";
import { seedFromApplication } from "./seed-from-application";

ensureApiBase();

export type GeneratorLayout = "tab" | "page";

// The header above the playground needs to know whether a turn runs, but only the toolbar
// actions are told. Leaving the tab mid-turn loses the reply, so "Open full page" waits.
const TurnRunningContext = createContext<(running: boolean) => void>(() => {});

function GeneratorActions(props: PlaygroundActionsProps) {
  const setTurnRunning = useContext(TurnRunningContext);
  const { turnRunning } = props;
  useEffect(() => setTurnRunning(turnRunning), [setTurnRunning, turnRunning]);
  return <AddServicesButton {...props} />;
}

interface ApplicationGeneratorProps {
  applicationId: string;
  layout: GeneratorLayout;
}

/** The playground, seeded with an existing application, adding services to it. */
export default function ApplicationGenerator({ applicationId, layout }: ApplicationGeneratorProps) {
  const api = useOakestraApi();
  const application = useQuery({
    queryKey: generatorKeys.application(applicationId),
    queryFn: ({ signal }) => api.applications.get(applicationId, { signal }),
  });
  const services = useQuery({
    queryKey: generatorKeys.services(applicationId),
    queryFn: ({ signal }) => api.services.listForApplication(applicationId, { signal }),
  });

  // Only without data: a failed background refetch keeps the old data, and the shell toasts it.
  if ((application.isError && !application.data) || (services.isError && !services.data)) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load the application</AlertTitle>
        <AlertDescription>
          <p>{describeError(application.error ?? services.error)}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (application.isError) void application.refetch();
              if (services.isError) void services.refetch();
            }}
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (!application.data || !services.data) {
    return <Skeleton className="slagen:h-[560px] slagen:w-full" />;
  }

  return (
    <GeneratorContext value={{ application: application.data, services: services.data }}>
      <LoadedGenerator application={application.data} services={services.data} layout={layout} />
    </GeneratorContext>
  );
}

function LoadedGenerator({
  application,
  services,
  layout,
}: {
  application: Application;
  services: Service[];
  layout: GeneratorLayout;
}) {
  const user = useCurrentUser();
  const addonPath = useAddonPath();
  const [turnRunning, setTurnRunning] = useState(false);
  // Taken once: the playground only reads its seed on mount, and a refetch after adding
  // services must not rebuild the host (that would look like a different playground).
  const [seed] = useState(() => ({
    title: application.application_name,
    sla: seedFromApplication(application, services, user?.organization),
  }));

  return (
    <TurnRunningContext value={setTurnRunning}>
      <DashboardHost scope={`app-${application._id}`} Actions={GeneratorActions} seed={seed}>
        <div className="slagen:flex slagen:flex-col slagen:gap-3">
          <div className="slagen:flex slagen:flex-wrap slagen:items-center slagen:justify-between slagen:gap-2">
            <p className="slagen:text-sm slagen:text-muted-foreground">
              Describe the services to add to <strong className="slagen:text-foreground">{application.application_name}</strong>
              . The model starts from what the application already runs.
            </p>
            {layout === "tab" ? (
              <FullPageLink to={addonPath("applications", application._id)} turnRunning={turnRunning} />
            ) : (
              <Button asChild size="sm" variant="ghost">
                <Link to={`/applications/${encodeURIComponent(application._id)}`}>
                  <ArrowLeftIcon aria-hidden /> Back to the application
                </Link>
              </Button>
            )}
          </div>
          <PlaygroundFrame size={layout === "tab" ? "tab" : "fill"} />
        </div>
      </DashboardHost>
    </TurnRunningContext>
  );
}
