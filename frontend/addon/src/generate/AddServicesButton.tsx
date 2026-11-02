import { describeError, useCurrentUser, useNotify, useOakestraApi } from "@oakestra/dashboard-sdk";
import { ConfirmDialog } from "@oakestra/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PackagePlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { PlaygroundActionsProps } from "@/host/host-context";
import { ActionButton } from "../actions/ActionButton";
import { blockedReason, plural } from "../actions/action-state";
import { firstApplicationServices, toSlaV2 } from "../deploy/to-sla-v2";
import type { Application, SlaApplication, SlaMicroservice } from "../types";
import { buildServiceSla } from "./build-service-sla";
import { describeFailures } from "./describe-failures";
import { useGeneratorTarget } from "./generator-context";
import { planAdditions, type AdditionPlan } from "./plan-additions";
import { generatorKeys } from "./queries";

const names = (list: readonly string[]) => list.join(", ");

interface Confirmation {
  plan: AdditionPlan;
  slaApplications: SlaApplication[];
}

/** What adding does, and what of the SLA it leaves out. */
function ConfirmationText({ confirmation, application }: { confirmation: Confirmation; application: Application }) {
  const { plan, slaApplications } = confirmation;
  const [first] = slaApplications;
  const renamed =
    first !== undefined &&
    (first.application_name !== application.application_name ||
      first.application_namespace !== application.application_namespace);
  return (
    <>
      <span className="slagen:block">
        Creates {names(plan.toCreate.map((service) => service.microservice_name))} in{" "}
        <strong>{application.application_name}</strong>. Oakestra schedules them right away.
      </span>
      {plan.changed.length > 0 ? (
        <span className="slagen:mt-2 slagen:block">
          Not applied, because Oakestra can't update running services yet:{" "}
          {plan.changed.map((change) => `${change.name} (${change.fields.join(", ")})`).join("; ")}.
        </span>
      ) : null}
      {plan.removed.length > 0 ? (
        <span className="slagen:mt-2 slagen:block">
          Kept running, although the SLA leaves {plan.removed.length === 1 ? "it" : "them"} out: {names(plan.removed)}.
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
export function AddServicesButton({ sla, validation, turnRunning }: PlaygroundActionsProps) {
  const { application, services } = useGeneratorTarget();
  const api = useOakestraApi();
  const user = useCurrentUser();
  const notify = useNotify();
  const queryClient = useQueryClient();
  // What the dialog asks about, taken when it opens so a refetch can't change it under the user,
  // and kept after closing so the dialog doesn't go blank during its exit animation.
  const [confirming, setConfirming] = useState<Confirmation | null>(null);
  const [open, setOpen] = useState(false);
  const organization = user?.organization;

  const parsed = useMemo(
    () => (validation.status === "valid" ? toSlaV2(sla, organization) : null),
    [sla, validation.status, organization],
  );
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
    onSuccess: async (result) => {
      setOpen(false);
      notify.success(`Added ${plural(result.deployed_services.length, "service")} to ${application.application_name}`, {
        description:
          result.failed_services.length > 0 ? describeFailures(result.failed_services) : "Oakestra schedules them right away.",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: generatorKeys.services(application._id) }),
        // The backend appends the new ids to application.microservices.
        queryClient.invalidateQueries({ queryKey: generatorKeys.application(application._id) }),
      ]);
    },
  });

  const toCreate = plan?.toCreate ?? [];
  let reason = blockedReason({ status: validation.status, turnRunning, organization });
  if (!reason && parsed && !parsed.ok) reason = parsed.errors[0] ?? "The SLA can't be deployed.";
  if (!reason && plan && plan.duplicates.length > 0) {
    reason = `The SLA names more than one service ${names(plan.duplicates)}. Give each service its own name first.`;
  }
  if (!reason && toCreate.length === 0) reason = `Every service in the SLA already runs in ${application.application_name}.`;

  const description = confirming ? <ConfirmationText confirmation={confirming} application={application} /> : null;

  return (
    <>
      <ActionButton
        icon={PackagePlusIcon}
        disabledReason={reason}
        onClick={() => {
          if (!plan || !parsed?.ok) return;
          add.reset();
          setConfirming({ plan, slaApplications: parsed.sla.applications });
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
        title={`Add ${plural(confirming?.plan.toCreate.length ?? 0, "service")}?`}
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
          if (confirming) add.mutate(confirming.plan.toCreate);
        }}
      />
    </>
  );
}
