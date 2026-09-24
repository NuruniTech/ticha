import { describe, it, expect, beforeEach, vi } from "vitest";

// Covers the two ways /api/gemini-key can cost or leak something:
//   1. the rate limiter letting anonymous demo traffic mint unlimited tokens
//   2. a missing GEMINI_API_KEY producing anything other than a flat 503
//
// The route's counting now lives in Postgres, so these tests stand in a fake
// check_rate_limit that mirrors the SQL in lib/schema.sql: same window reset,
// same "count > limit" comparison. That verifies the route's half of the
// contract — the limiter id, the limit it passes, and the response shape —
// not the SQL itself, which is exercised against a real Postgres in Supabase.

// ── Fake clock, so the window reset is tested without waiting 60s ────────────
let now = 1_700_000_000_000;
const advance = (ms: number) => { now += ms; };

// ── In-memory stand-in for public.check_rate_limit ───────────────────────────
const rows = new Map<string, { count: number; resetAt: number }>();
let rpcFails = false;

const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
  if (fn !== "check_rate_limit") throw new Error(`unexpected rpc: ${fn}`);
  if (rpcFails) return { data: null, error: { message: "connection refused" } };

  const id = args.p_id as string;
  const limit = args.p_limit as number;
  const windowMs = (args.p_window_seconds as number) * 1000;

  const row = rows.get(id);
  if (!row || row.resetAt <= now) {
    rows.set(id, { count: 1, resetAt: now + windowMs });
    return { data: 1 > limit, error: null };
  }
  row.count += 1;
  return { data: row.count > limit, error: null };
});

vi.mock("@/lib/apiAuth", () => ({ serviceClient: () => ({ rpc }) }));

// ── Anonymous caller: no session cookie, fixed IP ────────────────────────────
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
  headers: async () => ({
    get: (name: string) => (name === "x-forwarded-for" ? "203.0.113.7" : null),
  }),
}));

// Never hit the real Gemini API from a test.
const sdkCreate = vi.fn();
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    authTokens = { create: (...a: unknown[]) => sdkCreate(...a) };
  },
}));

const { GET } = await import("@/app/api/gemini-key/route");
const { resetTokenTransportForTests } = await import("@/lib/geminiToken");

// REST is tried first (see lib/geminiToken.ts); never hit the real API from a test.
const fetchMock = vi.fn();

beforeEach(() => {
  resetTokenTransportForTests();
  sdkCreate.mockReset();
  sdkCreate.mockResolvedValue({ name: "auth_tokens/fake-token" });
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ name: "auth_tokens/rest-token" }) });
  vi.stubGlobal("fetch", fetchMock);
  rows.clear();
  rpcFails = false;
  now = 1_700_000_000_000;
  process.env.GEMINI_API_KEY = "test-key";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("anonymous rate limit (8 per IP per minute)", () => {
  it("allows the full reconnect ladder, blocks one past the limit", async () => {
    // 8 = 1 initial connect + 5 reconnect attempts + headroom. If this ever
    // drops below 6 again, a flaky-network demo session dies mid-lesson.
    for (let i = 1; i <= 8; i++) {
      expect((await GET()).status, `request ${i}`).toBe(200);
    }

    const blocked = await GET();
    expect(blocked.status).toBe(429);
    // The 429 body shape is part of the contract VoiceSession reads.
    expect(await blocked.json()).toEqual({ error: "Too many requests" });

    // It is keyed by IP, at the demo limit — not the logged-in limit.
    expect(rpc).toHaveBeenCalledWith("check_rate_limit", {
      p_id: "ip:203.0.113.7",
      p_limit: 8,
      p_window_seconds: 60,
    });
  });

  it("allows the request again once the window has reset", async () => {
    for (let i = 0; i < 8; i++) await GET();
    expect((await GET()).status).toBe(429);

    advance(60_001);

    expect((await GET()).status).toBe(200);
  });

  it("fails closed for anonymous callers when the limiter errors", async () => {
    rpcFails = true;
    const res = await GET();
    expect(res.status).toBe(429);
    expect(console.error).toHaveBeenCalled();
  });
});

describe("missing GEMINI_API_KEY", () => {
  it("returns a bare 503 and leaks nothing", async () => {
    delete process.env.GEMINI_API_KEY;

    const res = await GET();
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body).toEqual({ error: "Service unavailable" });
    // No token, no key, no upstream error detail.
    expect(Object.keys(body)).toEqual(["error"]);
  });
});


describe("token minting", () => {
  it("uses the SDK (key in a header) first and never touches the URL path", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ token: "auth_tokens/fake-token" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to ?key= when the SDK rejects the key, then remembers", async () => {
    sdkCreate.mockRejectedValue(new Error("401 ACCESS_TOKEN_TYPE_UNSUPPORTED"));
    process.env.GEMINI_API_KEY = "AQ.test-key";

    const first = await GET();
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ token: "auth_tokens/rest-token" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/v1alpha/auth_tokens?key=AQ.test-key");

    sdkCreate.mockClear();
    expect((await GET()).status).toBe(200);
    expect(sdkCreate).not.toHaveBeenCalled(); // straight to REST now: no wasted call
  });

  it("returns a bare 503 and never logs the key when both paths fail", async () => {
    process.env.GEMINI_API_KEY = "AQ.secret-key-value";
    sdkCreate.mockRejectedValue(new Error("boom for AQ.secret-key-value"));
    fetchMock.mockRejectedValue(new Error("fetch failed for https://x/?key=AQ.secret-key-value"));

    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Service unavailable" });

    const logged = JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls);
    expect(logged).not.toContain("secret-key-value");
  });
});
