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

// ── Server-side phase resolution ─────────────────────────────────────────────
// The client may ASK for a phase, but the server decides. A parent must not be
// able to relabel practice attempts as "baseline" or "final" and skew the
// before/after measurement, so a special phase is granted only when the child's
// stored history allows it; otherwise the attempt is recorded as practice.
//
// (The verdict itself still comes from the app. Checker mode exists to measure
// how far the automatic verdicts can be trusted.)

export const BASELINE_ITEMS = 10;
export const MIN_PRACTICE_SESSIONS_FOR_CHECK = 5;

export interface HistoryRow { session_id: string; phase: string }

export function resolvePhase(requested: AttemptInput["phase"], history: HistoryRow[]): AttemptInput["phase"] {
  if (requested === "practice") return "practice";

  const practiceSessions = new Set(history.filter((r) => r.phase === "practice").map((r) => r.session_id));

  if (requested === "baseline") {
    // Only before any teaching has happened, and only for the first BASELINE_ITEMS items.
    const baselineRows = history.filter((r) => r.phase === "baseline").length;
    return practiceSessions.size === 0 && baselineRows < BASELINE_ITEMS ? "baseline" : "practice";
  }

  // checkpoint / final: only after enough real practice sessions.
  return practiceSessions.size >= MIN_PRACTICE_SESSIONS_FOR_CHECK ? requested : "practice";
}
