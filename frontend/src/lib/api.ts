import { API_PREFIX, DEFAULT_SETTINGS } from "./constants";
import type {
  GenerationFailureBody,
  Info,
  SessionResponse,
  Settings,
  Sla,
  ValidateResponse,
} from "./types";

export interface ApiResult<T> {
  /** 0 means the request never reached a server. */
  status: number;
  body: T;
}

/** Error-shaped body; FastAPI's own 422 sends a list for `detail`, so it is loose. */
export interface ErrorBody {
  detail?: string | { msg?: string; [key: string]: unknown }[];
  [key: string]: unknown;
}

export type SessionResult = ApiResult<
  Partial<SessionResponse & Omit<GenerationFailureBody, "detail">> & ErrorBody
>;

// Never rejects. A network failure comes back as status 0, so callers only switch on status.
async function api<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  const init: RequestInit = { method, headers: {} };
  if (body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(API_PREFIX + path, init);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Network error";
    return { status: 0, body: { detail } as T };
  }
  const data: unknown = await res.json().catch(() => null);
  if (data === null || typeof data !== "object") {
    // A non-JSON 502-504 comes from nginx itself because the API is down or still starting.
    // The API's own 502 (model server failed) always has a JSON body.
    if (res.status >= 502 && res.status <= 504) {
      return { status: 0, body: { detail: `The proxy answered ${res.status}` } as T };
    }
    return { status: res.status, body: { detail: res.statusText || `HTTP ${res.status}` } as T };
  }
  return { status: res.status, body: data as T };
}

const sessionPath = (id: string) => "/playground/sessions/" + encodeURIComponent(id);

export const fetchInfo = () => api<Partial<Info> & ErrorBody>("GET", "/playground/info");

export const startSession = (settings: Settings, description: string, compose?: string) => {
  const body: Record<string, unknown> = {
    method: settings.method,
    max_retries: settings.maxRetries,
    customer_id: settings.customerId.trim() || DEFAULT_SETTINGS.customerId,
    check_images: settings.checkImages,
    description,
  };
  if (compose) body.compose = compose;
  return api<SessionResult["body"]>("POST", "/playground/sessions", body);
};

export const answerSession = (id: string, text: string) =>
  api<SessionResult["body"]>("POST", sessionPath(id) + "/answer", { text });

export const deleteSession = (id: string) => api<ErrorBody>("DELETE", sessionPath(id));

export const validate = (sla: Sla) =>
  api<Partial<ValidateResponse> & ErrorBody>("POST", "/validate", sla);
