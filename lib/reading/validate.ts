// Input validation for a reading attempt sent to /api/reading-attempt.
// Kept separate from the route so it can be unit-tested without a server.

import { isKnownItemId } from "./curriculum";

export const OUTCOMES = ["correct", "incorrect", "unscored"] as const;
export const PHASES = ["practice", "baseline", "checkpoint", "final"] as const;

export interface AttemptInput {
  childId: string;
  sessionId: string;
  itemId: string;
  outcome: (typeof OUTCOMES)[number];
  phase: (typeof PHASES)[number];
  latencyMs: number | null;
}

export type ParseResult = { ok: true; value: AttemptInput } | { ok: false; error: string };

const MAX_LATENCY_MS = 120_000;

export function parseAttempt(body: unknown): ParseResult {
  if (!body || typeof body !== "object") return { ok: false, error: "Bad request" };
  const b = body as Record<string, unknown>;

  if (typeof b.childId !== "string" || b.childId.length === 0 || b.childId.length > 64) return { ok: false, error: "Bad childId" };
  if (typeof b.sessionId !== "string" || b.sessionId.length === 0 || b.sessionId.length > 64) return { ok: false, error: "Bad sessionId" };
  if (typeof b.itemId !== "string" || !isKnownItemId(b.itemId)) return { ok: false, error: "Unknown item" };
  if (!(OUTCOMES as readonly unknown[]).includes(b.outcome)) return { ok: false, error: "Bad outcome" };

  const phase = b.phase === undefined ? "practice" : b.phase;
  if (!(PHASES as readonly unknown[]).includes(phase)) return { ok: false, error: "Bad phase" };

  const latency = typeof b.latencyMs === "number" && Number.isFinite(b.latencyMs)
    ? Math.round(b.latencyMs)
    : null;

  return {
    ok: true,
    value: {
      childId: b.childId,
      sessionId: b.sessionId,
      itemId: b.itemId,
      outcome: b.outcome as AttemptInput["outcome"],
      phase: phase as AttemptInput["phase"],
      latencyMs: latency !== null && latency >= 0 && latency <= MAX_LATENCY_MS ? latency : null,
    },
  };
}
