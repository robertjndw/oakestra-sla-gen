import { afterEach, describe, expect, it, vi } from "vitest";
import { answerSession, fetchTurnProgress, newTurnId, startSession, validate } from "./api";
import { DEFAULT_SETTINGS } from "./constants";

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
