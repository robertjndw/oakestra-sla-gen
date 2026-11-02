import { describeError, useCurrentUser, useNotify, useOakestraApi } from "@oakestra/dashboard-sdk";
import { ConfirmDialog } from "@oakestra/ui";
import { useMutation } from "@tanstack/react-query";
import { RocketIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type { PlaygroundActionsProps } from "@/host/host-context";
import { ActionButton } from "../actions/ActionButton";
import { blockedReason, hasStatus, plural } from "../actions/action-state";
import type { SlaV2 } from "../types";
import { toSlaV2 } from "./to-sla-v2";

const serviceCount = (sla: SlaV2) => sla.applications.reduce((sum, app) => sum + app.microservices.length, 0);

/** Deploys the playground's SLA as a new application of the user's organization. */
export function DeployButton({ sla, validation, turnRunning }: PlaygroundActionsProps) {
  const api = useOakestraApi();
  const user = useCurrentUser();
  const notify = useNotify();
  const navigate = useNavigate();
  // What the dialog asks about, taken when it opens so it can't change under the user's eyes, and
  // kept after closing so the dialog doesn't go blank during its exit animation.
  const [confirming, setConfirming] = useState<SlaV2 | null>(null);
  const [open, setOpen] = useState(false);
  const organization = user?.organization;

  const result = useMemo(
    () => (validation.status === "valid" ? toSlaV2(sla, organization) : null),
    [sla, validation.status, organization],
  );

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
      notify.success(`Deployed ${body.applications[0]?.application_name ?? "the application"}`, {
        description: `${plural(serviceCount(body), "service")} handed to the scheduler.`,
      });
      if (created) await navigate(`/applications/${encodeURIComponent(created._id)}`);
    },
  });

  let reason = blockedReason({ status: validation.status, turnRunning, organization });
  if (!reason && result && !result.ok) reason = result.errors[0] ?? "The SLA can't be deployed.";

  const application = confirming?.applications[0];
  const others = (confirming?.applications.length ?? 1) - 1;
  const description =
    confirming && application ? (
      <>
        <span className="slagen:block">
          Creates <strong>{application.application_name}</strong> in namespace{" "}
          <strong>{application.application_namespace}</strong> with {plural(serviceCount(confirming), "service")}
          {others > 0 ? `, plus ${plural(others, "more application")}` : ""}. Oakestra schedules the services
          right away.
        </span>
        {deploy.isError ? (
          <span role="alert" className="slagen:mt-3 slagen:block slagen:text-destructive">
            {describeError(deploy.error)}
            {hasStatus(deploy.error, 409)
              ? " An application with this name may already exist. Rename it in the SLA, or open the existing application and use its Generate service tab."
              : null}
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
