import type { Application, SlaMicroservice, SlaV2 } from "../types";

/**
 * The body for `POST /service/`, mirroring the shell's buildSla: the services go into the
 * existing application, named by its id. Whatever name or namespace the model gave the
 * application is ignored; a rename would need an application update, not new services.
 */
export function buildServiceSla(application: Application, services: readonly SlaMicroservice[], organization: string): SlaV2 {
  return {
    sla_version: "v2.0",
    customerID: organization,
    applications: [
      {
        applicationID: application._id,
        application_name: application.application_name,
        application_namespace: application.application_namespace,
        ...(application.application_desc ? { application_desc: application.application_desc } : {}),
        // The backend rejects a non-empty microserviceID on create.
        microservices: services.map(({ microserviceID: _ignored, ...rest }) => rest),
      },
    ],
  } as SlaV2;
}
