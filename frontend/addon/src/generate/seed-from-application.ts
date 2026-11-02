import type { Application, Service } from "../types";
import { serviceToSlaFields } from "./sla-fields";

/**
 * Upper bound for the seeded SLA. The playground refuses SLAs above 64k characters (its upload
 * limit), and the model needs room to add services on top.
 */
export const MAX_SEED_CHARS = 60_000;

/**
 * The application as an SLA document, for the playground to start from: the model sees what is
 * already deployed and adds services next to it.
 *
 * Huge applications fall back to the service names only. The model then can't copy their
 * settings, but it still knows which names are taken.
 */
export function seedFromApplication(application: Application, services: Service[], organization?: string | null): string {
  const doc = (microservices: object[]) =>
    JSON.stringify(
      {
        sla_version: "v2.0",
        ...(organization ? { customerID: organization } : {}),
        applications: [
          {
            application_name: application.application_name,
            application_namespace: application.application_namespace,
            ...(application.application_desc ? { application_desc: application.application_desc } : {}),
            microservices,
          },
        ],
      },
      null,
      2,
    );

  const full = doc(services.map(serviceToSlaFields));
  if (full.length <= MAX_SEED_CHARS) return full;
  return doc(
    services.map((service) => ({
      microservice_name: service.microservice_name,
      microservice_namespace: service.microservice_namespace,
    })),
  );
}
