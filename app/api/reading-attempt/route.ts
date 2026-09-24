import { NextResponse } from "next/server";
import { getAuthedUser, getOwnedChild, serviceClient } from "@/lib/apiAuth";
import { parseAttempt, resolvePhase, type HistoryRow } from "@/lib/reading/validate";

// Saves one scored reading attempt. Only the verdict is stored — never audio
// and never what the child said. The parent is identified from their session,
// the child's ownership is checked through RLS, and the insert uses the
// service role, so scores cannot be forged from the browser.
//
// Attempts are refused until the parent has given consent (see
// /api/reading-consent): this data feeds learning-outcome measurement.

// A lesson is roughly one attempt every few seconds; this is a loose ceiling
// against runaway loops, not a pacing rule.
const RATE_LIMIT_PER_MIN = 120;

export async function POST(request: Request) {
  const { user, supabase: userClient } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const parsed = parseAttempt(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const a = parsed.value;

  const child = await getOwnedChild(userClient, a.childId);
  if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: consent } = await userClient
    .from("children").select("reading_consent_at").eq("id", a.childId).single();
  if (!consent?.reading_consent_at) {
    return NextResponse.json({ error: "Consent required" }, { status: 403 });
  }

  const admin = serviceClient();
  try {
    const { data: limited, error } = await admin.rpc("check_rate_limit", {
      p_id: `reading:${a.childId}`, p_limit: RATE_LIMIT_PER_MIN, p_window_seconds: 60,
    });
    if (error) throw error;
    if (limited === true) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  } catch (e) {
    // Known parent, already ownership-checked: fail open rather than lose a lesson.
    console.error("reading-attempt rate limit check failed:", e);
  }

  // The client only REQUESTS a phase; the server decides it from stored history
  // so before/after results cannot be relabelled from the browser. If the
  // history cannot be read, fall back to plain practice — never treat "could not
  // read" as "no history", which would hand out a baseline.
  let phase = a.phase;
  if (phase !== "practice") {
    const { data: history, error: historyError } = await admin.from("reading_attempts")
      .select("phase, created_at").eq("child_id", a.childId).limit(5000);
    phase = historyError ? "practice" : resolvePhase(phase, (history ?? []) as HistoryRow[]);
  }

  const row = {
    child_id:   a.childId,
    session_id: a.sessionId,
    item_id:    a.itemId,
    outcome:    a.outcome,
    latency_ms: a.latencyMs,
  };
  let { error } = await admin.from("reading_attempts").insert({ ...row, phase });
  // The database allows each item once per child in the baseline (unique index),
  // which closes the race between two simultaneous baseline requests. A conflict
  // just means this attempt is ordinary practice.
  if (error?.code === "23505" && phase === "baseline") {
    ({ error } = await admin.from("reading_attempts").insert({ ...row, phase: "practice" }));
  }
  if (error) {
    console.error("reading-attempt insert failed:", error);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
