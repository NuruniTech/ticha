import { NextResponse } from "next/server";
import { getAuthedUser, getOwnedChild, serviceClient } from "@/lib/apiAuth";
import { nextStreak } from "@/lib/streak";

// Saves a finished voice lesson: session row + XP + streak, server-side.
// XP is clamped against session duration so scores can't be forged from
// the browser (the client no longer has write access to these columns —
// see the "Server-authoritative XP" section of lib/schema.sql).

// Praise detection awards 10 stars at a time; a genuine lesson produces at
// most ~1 praise per ~30s of conversation. duration/3 (~10 stars per 30s)
// leaves generous headroom for enthusiastic lessons while making a forged
// "10-second session, 500 XP" request worthless.
const MAX_XP_PER_SESSION = 150;
const xpCap = (durationSeconds: number) =>
  Math.min(MAX_XP_PER_SESSION, Math.floor(durationSeconds / 3));

const MAX_TRANSCRIPT_ENTRIES = 500;
const MAX_ENTRY_CHARS        = 2000;

export async function POST(request: Request) {
  const { user, supabase: userClient } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    childId?: string; game?: string; language?: string;
    durationSeconds?: number; xpEarned?: number;
    wordsPracticed?: string[]; transcript?: { role: string; text: string }[];
    manualEnd?: boolean;
  };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const { childId, game, language } = body;
  if (typeof childId !== "string" || typeof game !== "string" || typeof language !== "string") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const child = await getOwnedChild(userClient, childId);
  if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const durationSeconds = Math.max(0, Math.min(Math.floor(body.durationSeconds || 0), 2 * 60 * 60));
  const manualEnd       = Boolean(body.manualEnd);
  const xpAwarded       = manualEnd
    ? 0
    : Math.max(0, Math.min(Math.floor(body.xpEarned || 0), xpCap(durationSeconds)));

  const wordsPracticed = Array.isArray(body.wordsPracticed)
    ? body.wordsPracticed.filter((w) => typeof w === "string").slice(0, 20)
    : [];
  const transcript = Array.isArray(body.transcript)
    ? body.transcript
        .filter((t) => t && typeof t.text === "string" && (t.role === "child" || t.role === "ticha"))
        .slice(0, MAX_TRANSCRIPT_ENTRIES)
        .map((t) => ({ role: t.role, text: t.text.slice(0, MAX_ENTRY_CHARS) }))
    : [];

  const admin = serviceClient();

  const { error: insertError } = await admin.from("sessions").insert({
    child_id: childId,
    game,
    language,
    duration_seconds: durationSeconds,
    xp_earned: xpAwarded,
    words_practiced: wordsPracticed,
    transcript,
  });
  if (insertError) {
    console.error("complete-session insert failed:", insertError);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }

  // Streak + XP only advance on naturally completed lessons
  let streak = child.streak;
  if (!manualEnd) {
    streak = nextStreak(child.streak, child.last_session_at);
    const { error: updateError } = await admin.from("children").update({
      xp: child.xp + xpAwarded,
      streak,
      last_session_at: new Date().toISOString(),
    }).eq("id", childId);
    if (updateError) {
      console.error("complete-session child update failed:", updateError);
      return NextResponse.json({ error: "Save failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ xpAwarded, streak });
}
