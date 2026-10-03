/** Loose JSON shape of an Oakestra SLA; the server validates it, the UI only reads from it. */
export interface SlaMicroservice {
  microservice_name?: string;
  microservice_namespace?: string;
  virtualization?: string;
  code?: string;
  port?: string;
  vcpus?: number;
  vgpus?: number;
  memory?: number;
  storage?: number;
  environment?: string[];
  cmd?: string[];
  constraints?: unknown[];
  addresses?: { rr_ip?: string; rr_ip_v6?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface SlaApplication {
  application_name?: string;
  application_namespace?: string;
  application_desc?: string;
  microservices?: SlaMicroservice[];
  [key: string]: unknown;
}

export interface Sla {
  sla_version?: string;
  customerID?: string;
  applications?: SlaApplication[];
  [key: string]: unknown;
}

export interface Clarification {
  topic: string;
  question: string;
  assumption: string | null;
}

export interface Attempt {
  attempt: number;
  errors: string[];
}

export interface SessionResponse {
  session_id: string;
  sla: Sla | null;
  questions: Clarification[];
  attempts: Attempt[];
}

/** Body of a 422 from the session endpoints when the model never produced a valid SLA. */
export interface GenerationFailureBody {
  detail: string;
  errors: string[];
  last_candidate: Sla | null;
  attempts: Attempt[];
  session_id: string;
}

export type OutputMethod = "prompt" | "json_schema" | "function_calling";

export interface Settings {
  method: OutputMethod;
  maxRetries: number;
  customerId: string;
  checkImages: boolean;
}

export interface ValidateResponse {
  valid: boolean;
  errors: string[];
}

export interface Info {
  model: string | null;
}

/** A service flattened out of the SLA, with a stable key for diffing. */
export interface ServiceEntry {
  app: SlaApplication;
  ms: SlaMicroservice;
  ai: number;
  mi: number;
  key: string;
}

/** What an uploaded file is: a compose file to translate, or an SLA to start from. */
export type InputFileKind = "compose" | "sla";

export interface InputFile {
  name: string;
  text: string;
  kind: InputFileKind;
}
