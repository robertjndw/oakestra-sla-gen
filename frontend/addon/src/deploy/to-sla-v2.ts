import type { SlaMicroservice, SlaV2 } from "../types";

/** The backend's rule for application and service names and namespaces. */
const SLA_NAME = /^[a-zA-Z0-9]{1,32}$/;

export type ToSlaResult = { ok: true; sla: SlaV2 } | { ok: false; errors: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function checkName(errors: string[], what: string, value: unknown) {
  if (typeof value !== "string" || !SLA_NAME.test(value)) {
    errors.push(`${what} ${JSON.stringify(value ?? "")} must be 1 to 32 letters or digits.`);
  }
}

/**
 * Turns the playground's SLA text into the body the dashboard's API client sends to
 * `POST /application/`.
 *
 * The playground has already validated the document against the SLA schema, so this only
 * checks what the backend rejects on top of it: names it can't use as ids, and ids it would
 * treat as references. `customerID` always becomes the user's organization, whatever the model
 * or an uploaded file put there, because the backend files the application under it.
 */
export function toSlaV2(text: string, organization: string | null | undefined): ToSlaResult {
  if (!organization) return { ok: false, errors: ["Your session has no organization to deploy to."] };

  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["The SLA is not valid JSON."] };
  }
  if (!isRecord(doc)) return { ok: false, errors: ["The SLA must be a JSON object."] };

  const applications = doc.applications;
  if (!Array.isArray(applications) || applications.length === 0) {
    return { ok: false, errors: ["The SLA contains no application."] };
  }

  const errors: string[] = [];
  const cleaned = applications.map((application: unknown, a) => {
    if (!isRecord(application)) {
      errors.push(`Application ${a + 1} is not an object.`);
      return application;
    }
    const label = typeof application.application_name === "string" ? application.application_name : `${a + 1}`;
    checkName(errors, `Application name`, application.application_name);
    checkName(errors, `Namespace of application ${label}`, application.application_namespace);

    const microservices = Array.isArray(application.microservices) ? application.microservices : [];
    if (!Array.isArray(application.microservices)) {
      errors.push(`Application ${label} has no microservices list.`);
    }

    // The backend assigns both ids. A filled-in one would make it look up an existing
    // application or service instead of creating it, and even an empty string is refused.
    const { applicationID: _app, ...rest } = application;
    return {
      ...rest,
      microservices: microservices.map((service: unknown, s) => {
        if (!isRecord(service)) {
          errors.push(`Service ${s + 1} of application ${label} is not an object.`);
          return service;
        }
        const name = typeof service.microservice_name === "string" ? service.microservice_name : `${s + 1}`;
        checkName(errors, `Service name`, service.microservice_name);
        checkName(errors, `Namespace of service ${name}`, service.microservice_namespace);
        const { microserviceID: _ms, ...fields } = service;
        return fields;
      }),
    };
  });

  // The backend creates the applications one after another and keeps those it already created
  // when a later one fails, so a second one with the same name would leave a half deployed SLA.
  const seen = new Set<string>();
  for (const application of applications) {
    if (!isRecord(application)) continue;
    const key = `${String(application.application_namespace)}/${String(application.application_name)}`;
    if (seen.has(key)) errors.push(`The SLA has more than one application ${key}.`);
    seen.add(key);
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    sla: { ...doc, sla_version: "v2.0", customerID: organization, applications: cleaned } as SlaV2,
  };
}

/**
 * Why the backend would fail to create these services, beyond what the SLA schema checks. It
 * reads `arch` of every unikernel without a fallback, and fails the whole request (after creating
 * the services before it) when it's missing. The generator never writes `arch`.
 */
export function creationErrors(services: readonly SlaMicroservice[]): string[] {
  return services
    .filter((service) => {
      const { virtualization, arch } = service as Record<string, unknown>;
      return virtualization === "unikernel" && !(Array.isArray(arch) && arch.length > 0);
    })
    .map(
      (service) =>
        `Service ${service.microservice_name} is a unikernel, which needs an arch list such as ["amd64"]. Add it in the Code view.`,
    );
}

/** The microservices of the first application, for callers that only ever deal with one. */
export function firstApplicationServices(sla: SlaV2): SlaMicroservice[] {
  return sla.applications[0]?.microservices ?? [];
}
