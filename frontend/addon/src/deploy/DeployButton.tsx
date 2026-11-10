import { describeError, platformQueryKeys, useNotify, useOakestraApi } from "@oakestra/dashboard-sdk";
import { ConfirmDialog } from "@oakestra/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RocketIcon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import type { PlaygroundActionsProps } from "@/host/host-context";
import { plural } from "@/lib/format";
import { ActionButton } from "../actions/ActionButton";
import { hasStatus } from "../actions/action-state";
import { useDeployableSla } from "../actions/use-deployable-sla";
import type { SlaV2 } from "../types";
import { creationErrors } from "./to-sla-v2";

const serviceCount = (sla: SlaV2) => sla.applications.reduce((sum, app) => sum + app.microservices.length, 0);

/** Deploys the playground's SLA as a new application of the user's organization. */
export function DeployButton(props: PlaygroundActionsProps) {
  const api = useOakestraApi();
  const notify = useNotify();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // What the dialog asks about, taken when it opens so it can't change under the user's eyes, and
  // kept after closing so the dialog doesn't go blank during its exit animation.
  const [confirming, setConfirming] = useState<SlaV2 | null>(null);
  const [open, setOpen] = useState(false);
  const { result, reason: blocked } = useDeployableSla(props);

  const deploy = useMutation({
    mutationFn: async (body: SlaV2) => {
      const all = await api.applications.create(body);
      // The backend answers with every application of the user. Like the shell, find the new one
      // by name: names are unique per user, ids aren't in the request.
      const first = body.applications[0];
      return all.find(
        (app) =>
          app.application_name === first?.application_name && app.application_namespace === first?.application_namespace,
      );
    },
    // The dialog shows the reason itself.
    meta: { silent: true },
    onSuccess: async (created, body) => {
      setOpen(false);
      // Not awaited: the shell's application lists refetch in the background while we navigate.
      void queryClient.invalidateQueries({ queryKey: platformQueryKeys.applications() });
      notify.success(`Deployed ${body.applications[0]?.application_name ?? "the application"}`, {
        // Creating an application only registers its services; nothing runs until its instances
        // are deployed, which the application page offers next.
        description: `${plural(serviceCount(body), "service")} created. Deploy their instances from the application page.`,
      });
      if (created) await navigate(`/applications/${encodeURIComponent(created._id)}`);
    },
  });

  let reason = blocked;
  if (!reason && result?.ok) reason = creationErrors(result.sla.applications.flatMap((app) => app.microservices))[0] ?? null;

  const application = confirming?.applications[0];
  const others = (confirming?.applications.length ?? 1) - 1;
  const description =
    confirming && application ? (
      <>
        <span className="slagen:block">
          Creates <strong>{application.application_name}</strong> in namespace{" "}
          <strong>{application.application_namespace}</strong> with {plural(serviceCount(confirming), "service")}
          {others > 0 ? `, plus ${plural(others, "more application")}` : ""}. Their instances start once you deploy
          them from the application page.
        </span>
        {deploy.isError ? (
          <span role="alert" className="slagen:mt-3 slagen:block slagen:text-destructive">
            {/* The backend's own 409 message says the same in a sentence without a full stop. */}
            {hasStatus(deploy.error, 409)
              ? "An application with this name and namespace already exists. Rename it in the SLA, or open the existing application and use its Generate service tab."
              : describeError(deploy.error)}
          </span>
        ) : null}
      </>
    ) : null;

  return (
    <>
      <ActionButton
        icon={RocketIcon}
        disabledReason={reason}
        onClick={() => {
          if (!result?.ok) return;
          deploy.reset();
          setConfirming(result.sla);
          setOpen(true);
        }}
      >
        Deploy
      </ActionButton>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Deploy to Oakestra?"
        description={description}
        confirmLabel="Deploy"
        pending={deploy.isPending}
        onConfirm={() => {
          if (confirming) deploy.mutate(confirming);
        }}
      />
    </>
  );
}
