import { NextResponse } from "next/server";
import { getAuthedUser, getOwnedChild, serviceClient } from "@/lib/apiAuth";

// Saves quiz-game results server-side: XP plus per-word progress counts.
// Also used by XpSyncOnLoad to flush XP that was earned offline (words: []).
// Star cap: 3-4 games × 5 words × 5 stars (×2 combo) + retries + 25 bonus —
// a legitimate perfect run stays well under 300.
const MAX_QUIZ_STARS = 300;

export async function POST(request: Request) {
  const { user, supabase: userClient } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    childId?: string;
    language?: string;
    stars?: number;
    words?: { sw?: string; correct?: boolean }[];
  };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const { childId } = body;
  if (typeof childId !== "string") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const child = await getOwnedChild(userClient, childId);
  if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stars = Math.max(0, Math.min(Math.floor(body.stars || 0), MAX_QUIZ_STARS));
  const words = (Array.isArray(body.words) ? body.words : [])
    .filter((w) => w && typeof w.sw === "string")
    .slice(0, 25) as { sw: string; correct?: boolean }[];
  const language = typeof body.language === "string" ? body.language : "sw";

  const admin = serviceClient();

  if (stars > 0) {
    const { error } = await admin.from("children")
      .update({ xp: child.xp + stars })
      .eq("id", childId);
    if (error) {
      console.error("quiz-results xp update failed:", error);
      return NextResponse.json({ error: "Save failed" }, { status: 500 });
    }
  }

  if (words.length > 0) {
    try {
      const wordKeys = words.map((w) => w.sw);
      const { data: existing } = await admin.from("progress")
        .select("word, correct_count, attempt_count")
        .eq("child_id", childId).in("word", wordKeys).eq("language", language);
      const existingMap = Object.fromEntries(
        (existing || []).map((r) => [r.word, r as { correct_count: number; attempt_count: number }])
      );
      const upserts = words.map((w) => {
        const prev = existingMap[w.sw];
        return {
          child_id:      childId,
          word:          w.sw,
          language,
          attempt_count: (prev?.attempt_count || 0) + 1,
          correct_count: (prev?.correct_count || 0) + (w.correct ? 1 : 0),
          last_seen_at:  new Date().toISOString(),
        };
      });
      await admin.from("progress").upsert(upserts, { onConflict: "child_id,word,language" });
    } catch (e) {
      console.error("quiz-results progress upsert failed:", e); // non-critical
    }
  }

  return NextResponse.json({ xpAwarded: stars });
}
