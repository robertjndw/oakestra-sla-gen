import { describeError, platformQueryKeys, useNotify, useOakestraApi } from "@oakestra/dashboard-sdk";
import { ConfirmDialog } from "@oakestra/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PackagePlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { PlaygroundActionsProps } from "@/host/host-context";
import { joinWords, plural } from "@/lib/format";
import { ActionButton } from "../actions/ActionButton";
import { useDeployableSla } from "../actions/use-deployable-sla";
import { creationErrors, firstApplicationServices } from "../deploy/to-sla-v2";
import type { Application, SlaMicroservice, SlaV2 } from "../types";
import { buildServiceSla } from "./build-service-sla";
import { describeFailures } from "./describe-failures";
import { useGeneratorTarget } from "./generator-context";
import { planAdditions, type AdditionPlan } from "./plan-additions";

/** What adding does, and what of the SLA it leaves out. */
function ConfirmationText({ sla, plan, application }: { sla: SlaV2; plan: AdditionPlan; application: Application }) {
  const slaApplications = sla.applications;
  const [first] = slaApplications;
  const renamed =
    first !== undefined &&
    (first.application_name !== application.application_name ||
      first.application_namespace !== application.application_namespace);
  return (
    <>
      {plan.toCreate.length > 0 ? (
        <span className="slagen:block">
          Creates {joinWords(plan.toCreate.map((service) => service.microservice_name))} in{" "}
          <strong>{application.application_name}</strong>. Deploy their instances from the Services tab afterwards.
        </span>
      ) : (
        <span className="slagen:block">
          Every service in the SLA runs in <strong>{application.application_name}</strong> now.
        </span>
      )}
      {plan.changed.length > 0 ? (
        <span className="slagen:mt-2 slagen:block">
          Not applied, because Oakestra can't update running services yet:{" "}
          {plan.changed.map((change) => `${change.name} (${change.fields.join(", ")})`).join("; ")}.
        </span>
      ) : null}
      {plan.renamed.length > 0 ? (
        <span className="slagen:mt-2 slagen:block">
          Not created, because they look like a deployed service under a new name (same image and service IP):{" "}
          {plan.renamed.map((rename) => `${rename.name} (${rename.deployed})`).join(", ")}.
        </span>
      ) : null}
      {plan.removed.length > 0 ? (
        <span className="slagen:mt-2 slagen:block">
          Kept running, although the SLA leaves {plan.removed.length === 1 ? "it" : "them"} out: {joinWords(plan.removed)}.
        </span>
      ) : null}
      {renamed ? (
        <span className="slagen:mt-2 slagen:block">
          The SLA names the application {first.application_name}; the services go into {application.application_name}{" "}
          anyway.
        </span>
      ) : null}
      {slaApplications.length > 1 ? (
        <span className="slagen:mt-2 slagen:block">Only the services of the first application in the SLA are used.</span>
      ) : null}
    </>
  );
}

/** Adds the services the playground's SLA has and the application doesn't run yet. */
export function AddServicesButton(props: PlaygroundActionsProps) {
  const { application, services } = useGeneratorTarget();
  const api = useOakestraApi();
  const notify = useNotify();
  const queryClient = useQueryClient();
  // The SLA the dialog asks about, taken when it opens so a new draft can't change it under the
  // user, and kept after closing so the dialog doesn't go blank during its exit animation. The
  // plan is made from it on every render, so a refetch of the services updates it.
  const [confirming, setConfirming] = useState<SlaV2 | null>(null);
  const [open, setOpen] = useState(false);
  const { organization, result: parsed, reason: blocked } = useDeployableSla(props);
  const plan = useMemo(
    () => (parsed?.ok ? planAdditions(firstApplicationServices(parsed.sla), services) : null),
    [parsed, services],
  );

  const add = useMutation({
    mutationFn: async (toCreate: SlaMicroservice[]) => {
      const result = await api.services.create(buildServiceSla(application, toCreate, organization ?? ""));
      // The backend answers 200 even when it refused every service; the reasons are in
      // failed_services.
      if (result.failed_services.length > 0 && result.deployed_services.length === 0) {
        throw new Error(describeFailures(result.failed_services));
      }
      return result;
    },
    meta: { silent: true },
    onSuccess: (result) => {
      setOpen(false);
      notify.success(`Added ${plural(result.deployed_services.length, "service")} to ${application.application_name}`, {
        description:
          result.failed_services.length > 0
            ? describeFailures(result.failed_services)
            : "Deploy their instances from the Services tab.",
      });
    },
    // On failure too: the backend creates services one by one and keeps the ones before a
    // failing one. The refetch shrinks the open dialog's plan, so a retry doesn't create them twice.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: platformQueryKeys.servicesByApplication(application._id) }),
        // The backend appends the new ids to application.microservices, which the lists show too.
        queryClient.invalidateQueries({ queryKey: platformQueryKeys.applications() }),
      ]),
  });

  const toCreate = plan?.toCreate ?? [];
  let reason = blocked;
  if (!reason && plan && plan.duplicates.length > 0) {
    reason = `The SLA names more than one service ${joinWords(plan.duplicates)}. Give each service its own name first.`;
  }
  if (!reason && toCreate.length === 0) reason = `Every service in the SLA already runs in ${application.application_name}.`;
  if (!reason) reason = creationErrors(toCreate)[0] ?? null;

  const confirmingPlan = useMemo(
    () => (confirming ? planAdditions(firstApplicationServices(confirming), services) : null),
    [confirming, services],
  );
  const description =
    confirming && confirmingPlan ? (
      <ConfirmationText sla={confirming} plan={confirmingPlan} application={application} />
    ) : null;

  return (
    <>
      <ActionButton
        icon={PackagePlusIcon}
        disabledReason={reason}
        onClick={() => {
          if (!plan || !parsed?.ok) return;
          add.reset();
          setConfirming(parsed.sla);
          setOpen(true);
        }}
      >
        {toCreate.length > 0
          ? `Add ${plural(toCreate.length, "service")} to ${application.application_name}`
          : `Add services to ${application.application_name}`}
      </ActionButton>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Add ${plural(confirmingPlan?.toCreate.length ?? 0, "service")}?`}
        description={
          description && (
            <>
              {description}
              {add.isError ? (
                <span role="alert" className="slagen:mt-3 slagen:block slagen:text-destructive">
                  {describeError(add.error)}
                </span>
              ) : null}
            </>
          )
        }
        confirmLabel="Add services"
        pending={add.isPending}
        onConfirm={() => {
          if (!confirmingPlan) return;
          // A failed attempt may have created all of them after all.
          if (confirmingPlan.toCreate.length === 0) setOpen(false);
          else add.mutate(confirmingPlan.toCreate);
        }}
      />
    </>
  );
}
