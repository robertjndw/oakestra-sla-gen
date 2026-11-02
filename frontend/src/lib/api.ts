import { API_PREFIX, TURN_POLL_GIVE_UP_MS, TURN_POLL_INTERVAL_MS } from "./constants";
import type {
  Attempt,
  GenerationFailureBody,
  Info,
  InputFile,
  SessionResponse,
  Settings,
  Sla,
  TurnProgress,
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

let apiBase = API_PREFIX;

/**
 * Where the API is mounted. The standalone app sits behind nginx at /api; a host that serves the
 * playground from somewhere else (the dashboard addon) points it at its own proxy path.
 */
export function setApiBase(base: string): void {
  apiBase = base.replace(/\/+$/, "");
}

// Never rejects. A network failure comes back as status 0, so callers only switch on status.
async function api<T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { ...extraHeaders };
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(apiBase + path, init);
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

/**
 * Id under which the server reports a turn's progress while its request is open. Anyone holding
 * it can read the turn's errors, so it has to be random. Not crypto.randomUUID: that only exists
 * in secure contexts, and the Oakestra addon serves the playground over plain http.
 */
export function newTurnId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function startBody(settings: Settings, description: string, file?: InputFile | null, turnId?: string) {
  const body: Record<string, unknown> = {
    max_retries: settings.maxRetries,
    check_images: settings.checkImages,
    description,
    turn_id: turnId,
  };
  // The API takes the file under its kind: `compose` or `sla`.
  if (file) body[file.kind] = file.text;
  const customerId = settings.customerId.trim();
  if (customerId) body.customer_id = customerId;
  return body;
}

export const startSession = (
  settings: Settings,
  description: string,
  file?: InputFile | null,
  turnId?: string,
  headers?: Record<string, string>,
) =>
  api<SessionResult["body"]>("POST", "/playground/sessions", startBody(settings, description, file, turnId), headers);

export const answerSession = (id: string, text: string, turnId?: string, headers?: Record<string, string>) =>
  api<SessionResult["body"]>("POST", sessionPath(id) + "/answer", { text, turn_id: turnId }, headers);

/**
 * A blocking turn's progress is 404 until its request reaches the server and again once it has
 * finished. An async turn's stays readable after it finished, with `done` and the result.
 */
export const fetchTurnProgress = (turnId: string) =>
  api<Partial<TurnProgress> & ErrorBody>("GET", "/playground/turns/" + encodeURIComponent(turnId));

export const deleteSession = (id: string) => api<ErrorBody>("DELETE", sessionPath(id));

export const validate = (sla: Sla) =>
  api<Partial<ValidateResponse> & ErrorBody>("POST", "/validate", sla);

export type TurnRequest =
  | { kind: "start"; settings: Settings; description: string; file?: InputFile | null }
  | { kind: "answer"; sessionId: string; text: string };

export interface TurnOptions {
  /** Defaults to a fresh one. Sent in the body so progress can be polled even from a blocking server. */
  turnId?: string;
  /** Attempts the server has finished so far, reported as polls see them. */
  onAttempts?: (attempts: Attempt[]) => void;
  /**
   * Checked between polls. Once true, runTurn stops polling and resolves with status 0; the
   * server may still finish the turn, but nobody is waiting for it anymore.
   */
  stopped?: () => boolean;
}

const ASYNC_HEADERS = { prefer: "respond-async" };

function postTurn(req: TurnRequest, turnId: string): Promise<SessionResult> {
  if (req.kind === "start") return startSession(req.settings, req.description, req.file, turnId, ASYNC_HEADERS);
  return answerSession(req.sessionId, req.text, turnId, ASYNC_HEADERS);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const failure = (detail: string): SessionResult => ({ status: 0, body: { detail } });

/**
 * Runs one turn (first message or follow-up) and resolves with what the blocking endpoint would
 * have answered, so callers don't care which mode the server picked.
 *
 * The POST asks for `Prefer: respond-async`. A server that honours it answers 202 right away and
 * the outcome is polled from the turn; one that doesn't (or a 4xx raised before the turn starts)
 * answers synchronously and that answer is passed through. Progress is polled in both cases, about
 * once a second with at most one poll in flight. Never rejects.
 */
export async function runTurn(req: TurnRequest, opts: TurnOptions = {}): Promise<SessionResult> {
  const { turnId = newTurnId(), onAttempts, stopped = () => false } = opts;
  // Typed through the cast so the checks below don't narrow it to the initial null: the
  // assignment happens in the callback.
  let posted = null as SessionResult | null;
  const posting = postTurn(req, turnId).then((res) => {
    posted = res;
  });
  // Until the POST has answered, its answer has to cut any wait short: from a blocking server it
  // is the result, and nobody should sit out a poll interval for it. Null means it cut in.
  const orPosted = <T>(p: Promise<T>): Promise<T | null> =>
    posted ? p : Promise.race([p, posting.then(() => null)]);
  const accepted = () => (posted?.status === 202 ? posted : null);
  const abandoned = () => failure("The turn was abandoned");

  let poll: ReturnType<typeof fetchTurnProgress> | null = null;
  // A poll sent before the 202 may have beaten the POST to the server, so its 404 proves nothing.
  let pollSentAfter202 = false;
  let failingSince: number | null = null;
  for (;;) {
    if (!poll) {
      await orPosted(sleep(TURN_POLL_INTERVAL_MS));
      if (stopped()) return abandoned();
      if (posted && !accepted()) return posted;
      const id = accepted()?.body.turn_id;
      poll = fetchTurnProgress(typeof id === "string" && id ? id : turnId);
      pollSentAfter202 = accepted() !== null;
    }
    const res = await orPosted(poll);
    if (stopped()) return abandoned();
    if (posted && !accepted()) return posted;
    // The POST answered 202 while this poll was out; it is still the poll to wait for.
    if (res === null) continue;
    poll = null;

    const { status, body } = res;
    if (status === 200) {
      failingSince = null;
      if (Array.isArray(body.attempts)) onAttempts?.(body.attempts);
      if (accepted() && body.done === true) {
        const result = typeof body.result === "object" && body.result !== null ? body.result : {};
        return { status: typeof body.status === "number" ? body.status : 0, body: result as SessionResult["body"] };
      }
      continue;
    }
    // Before the 202, failed polls mean nothing: the turn may not have reached the server yet,
    // and the POST decides how it ends.
    if (!pollSentAfter202) continue;
    if (status === 404) {
      return failure(
        "Lost track of the turn. The server no longer knows it, most likely because it restarted. Send the message again.",
      );
    }
    if (status === 0 || status >= 500) {
      failingSince ??= Date.now();
      if (Date.now() - failingSince < TURN_POLL_GIVE_UP_MS) continue;
      const detail = typeof body.detail === "string" ? body.detail : `status ${status}`;
      return failure(`Lost contact with the server while waiting for the turn (${detail}).`);
    }
    return { status, body: { detail: body.detail } };
  }
}
