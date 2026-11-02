import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  answerSession,
  fetchTurnProgress,
  newTurnId,
  runTurn,
  setApiBase,
  startSession,
  validate,
  type SessionResult,
} from "./api";
import { API_PREFIX, DEFAULT_SETTINGS, TURN_POLL_GIVE_UP_MS, TURN_POLL_INTERVAL_MS } from "./constants";

afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  it("reports a network failure as status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await validate({})).toEqual({ status: 0, body: { detail: "Failed to fetch" } });
  });

  it("survives a non-JSON error page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>500</html>", { status: 500, statusText: "Server Error" })),
    );
    expect(await answerSession("id", "hi")).toEqual({ status: 500, body: { detail: "Server Error" } });
  });

  it("treats a proxy gateway error as an unreachable API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>502</html>", { status: 502, statusText: "Bad Gateway" })),
    );
    expect((await answerSession("id", "hi")).status).toBe(0);
  });

  it("sends snake_case settings under the /api prefix", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ session_id: "s" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await startSession({ ...DEFAULT_SETTINGS, customerId: "  " }, "desc", {
      name: "compose.yaml",
      text: "services: {}",
      kind: "compose",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/playground/sessions");
    expect(JSON.parse(init.body)).toEqual({
      max_retries: 3,
      check_images: true,
      description: "desc",
      compose: "services: {}",
    });
  });

  it("sends an uploaded SLA under the sla key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ session_id: "s" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await startSession(DEFAULT_SETTINGS, "", { name: "sla.json", text: "{}", kind: "sla" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.sla).toBe("{}");
    expect(body).not.toHaveProperty("compose");
    // Left out so the server can keep the uploaded SLA's own customerID.
    expect(body).not.toHaveProperty("customer_id");
  });

  it("sends a customer id only when one is set", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ session_id: "s" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await startSession({ ...DEFAULT_SETTINGS, customerId: " acme " }, "desc");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).customer_id).toBe("acme");
  });

  it("sends a turn id only when one is given", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response("{}", { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    await startSession(DEFAULT_SETTINGS, "desc", null, "turn-1234");
    await answerSession("s", "x", "turn-5678");
    await answerSession("s", "x");
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));
    expect(bodies[0].turn_id).toBe("turn-1234");
    expect(bodies[1]).toEqual({ text: "x", turn_id: "turn-5678" });
    expect(bodies[2]).toEqual({ text: "x" });
  });

  it("polls a turn's progress with a GET", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ attempts: [{ attempt: 1, errors: ["e"] }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchTurnProgress("t/1");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/playground/turns/t%2F1");
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
    expect(res).toEqual({ status: 200, body: { attempts: [{ attempt: 1, errors: ["e"] }] } });
  });

  it("makes turn ids the server accepts, without crypto.randomUUID", () => {
    // randomUUID is missing outside secure contexts, e.g. the addon's plain http.
    vi.stubGlobal("crypto", { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
    const a = newTurnId();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(newTurnId()).not.toBe(a);
  });

  it("encodes the session id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await answerSession("a/b", "x");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/playground/sessions/a%2Fb/answer");
  });
});

describe("setApiBase", () => {
  afterEach(() => setApiBase(API_PREFIX));

  it("sends requests under the new base", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    setApiBase("/addons/sla/api/");
    await validate({});
    expect(fetchMock.mock.calls[0][0]).toBe("/addons/sla/api/validate");
  });
});

describe("runTurn", () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const draft = { session_id: "s1", sla: {}, questions: [], attempts: [{ attempt: 1, errors: [] }] };
  const attempts = [{ attempt: 1, errors: ["bad port"] }];

  let postReply: () => Promise<Response>;
  /** Progress replies in order; the last one repeats. */
  let pollReplies: (() => Promise<Response>)[];
  let fetchMock: ReturnType<typeof vi.fn>;
  const polls = () => fetchMock.mock.calls.filter(([, init]) => init.method === "GET");

  beforeEach(() => {
    vi.useFakeTimers();
    postReply = () => Promise.resolve(json({ session_id: "s1", turn_id: "t1" }, 202));
    pollReplies = [() => Promise.resolve(json({ attempts: [] }))];
    fetchMock = vi.fn((_url: string, init: RequestInit) => {
      if (init.method === "POST") return postReply();
      const next = pollReplies.length > 1 ? pollReplies.shift()! : pollReplies[0];
      return next();
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.useRealTimers());

  /** Starts a turn and lets fake time run until it settles. */
  async function settle(p: Promise<SessionResult>, maxMs = TURN_POLL_GIVE_UP_MS * 2): Promise<SessionResult> {
    let out: SessionResult | undefined;
    void p.then((r) => (out = r));
    for (let t = 0; out === undefined && t <= maxMs; t += TURN_POLL_INTERVAL_MS) {
      await vi.advanceTimersByTimeAsync(TURN_POLL_INTERVAL_MS);
    }
    if (out === undefined) throw new Error("runTurn never settled");
    return out;
  }

  it("asks for an async turn and sends the turn id in the body", async () => {
    postReply = () => Promise.resolve(json(draft));
    await settle(runTurn({ kind: "answer", sessionId: "a/b", text: "x" }, { turnId: "t1" }));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/playground/sessions/a%2Fb/answer");
    expect(init.headers).toMatchObject({ prefer: "respond-async", "content-type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({ text: "x", turn_id: "t1" });
  });

  it("polls a 202 turn until it is done and returns its result as the response", async () => {
    pollReplies = [
      () => Promise.resolve(json({ attempts: [], done: false })),
      () => Promise.resolve(json({ attempts, done: false })),
      () => Promise.resolve(json({ attempts, done: true, status: 200, result: draft })),
    ];
    const onAttempts = vi.fn();
    const res = await settle(
      runTurn({ kind: "start", settings: DEFAULT_SETTINGS, description: "nginx" }, { turnId: "t1", onAttempts }),
    );
    expect(res).toEqual({ status: 200, body: draft });
    expect(polls().map(([url]) => url)).toEqual(Array(3).fill("/api/playground/turns/t1"));
    expect(onAttempts).toHaveBeenCalledWith(attempts);
  });

  it("returns a failed turn's status and body like the blocking call would", async () => {
    const failed = { detail: "no valid SLA", errors: ["e"], last_candidate: null, attempts, session_id: "s1" };
    pollReplies = [() => Promise.resolve(json({ attempts, done: true, status: 422, result: failed }))];
    const res = await settle(runTurn({ kind: "answer", sessionId: "s1", text: "x" }));
    expect(res).toEqual({ status: 422, body: failed });
  });

  it("passes a blocking server's answer straight through, without waiting for a poll", async () => {
    postReply = () => Promise.resolve(json(draft));
    const p = runTurn({ kind: "answer", sessionId: "s1", text: "x" });
    let out: SessionResult | undefined;
    void p.then((r) => (out = r));
    await vi.advanceTimersByTimeAsync(0);
    expect(out).toEqual({ status: 200, body: draft });
    expect(polls()).toHaveLength(0);
  });

  it("passes an error from before the turn started straight through", async () => {
    postReply = () => Promise.resolve(json({ detail: "busy" }, 409));
    expect(await settle(runTurn({ kind: "answer", sessionId: "s1", text: "x" }))).toEqual({
      status: 409,
      body: { detail: "busy" },
    });
  });

  it("reports progress while a blocking request is still open", async () => {
    let answerPost!: (r: Response) => void;
    postReply = () => new Promise((resolve) => (answerPost = resolve));
    pollReplies = [() => Promise.resolve(json({ detail: "unknown turn" }, 404)), () => Promise.resolve(json({ attempts }))];
    const onAttempts = vi.fn();
    const p = runTurn({ kind: "answer", sessionId: "s1", text: "x" }, { onAttempts });
    await vi.advanceTimersByTimeAsync(TURN_POLL_INTERVAL_MS * 2);
    expect(onAttempts).toHaveBeenCalledWith(attempts);
    answerPost(json(draft));
    expect(await p).toEqual({ status: 200, body: draft });
  });

  it("gives up with status 0 when the turn is lost after the 202", async () => {
    pollReplies = [() => Promise.resolve(json({ detail: "unknown turn" }, 404))];
    const res = await settle(runTurn({ kind: "answer", sessionId: "s1", text: "x" }));
    expect(res.status).toBe(0);
    expect(res.body.detail).toMatch(/Lost track of the turn/);
    expect(polls()).toHaveLength(1);
  });

  it("rides out network errors and proxy errors while polling", async () => {
    pollReplies = [
      () => Promise.reject(new TypeError("Failed to fetch")),
      () => Promise.resolve(new Response("<html>502</html>", { status: 502 })),
      () => Promise.resolve(new Response("<html>500</html>", { status: 500, statusText: "Server Error" })),
      () => Promise.resolve(json({ attempts, done: true, status: 200, result: draft })),
    ];
    expect(await settle(runTurn({ kind: "answer", sessionId: "s1", text: "x" }))).toEqual({ status: 200, body: draft });
  });

  it("stops after about a minute of failing polls", async () => {
    pollReplies = [() => Promise.reject(new TypeError("Failed to fetch"))];
    const res = await settle(runTurn({ kind: "answer", sessionId: "s1", text: "x" }));
    expect(res.status).toBe(0);
    expect(res.body.detail).toMatch(/Lost contact with the server/);
    const n = polls().length;
    expect(n).toBeGreaterThanOrEqual(TURN_POLL_GIVE_UP_MS / TURN_POLL_INTERVAL_MS);
    expect(n).toBeLessThanOrEqual(TURN_POLL_GIVE_UP_MS / TURN_POLL_INTERVAL_MS + 2);
  });

  it("stops polling once the caller abandons the turn", async () => {
    let stopped = false;
    const p = runTurn({ kind: "answer", sessionId: "s1", text: "x" }, { stopped: () => stopped });
    await vi.advanceTimersByTimeAsync(TURN_POLL_INTERVAL_MS * 2);
    stopped = true;
    const res = await settle(p);
    const n = polls().length;
    await vi.advanceTimersByTimeAsync(TURN_POLL_INTERVAL_MS * 3);
    expect(polls()).toHaveLength(n);
    expect(res.status).toBe(0);
  });
});
