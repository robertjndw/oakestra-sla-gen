import { afterEach, describe, expect, it, vi } from "vitest";
import { answerSession, startSession, validate } from "./api";
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
    await startSession({ ...DEFAULT_SETTINGS, customerId: "  " }, "desc", "services: {}");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/playground/sessions");
    expect(JSON.parse(init.body)).toEqual({
      method: "prompt",
      max_retries: 3,
      customer_id: "Admin",
      check_images: true,
      description: "desc",
      compose: "services: {}",
    });
  });

  it("encodes the session id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await answerSession("a/b", "x");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/playground/sessions/a%2Fb/answer");
  });
});
