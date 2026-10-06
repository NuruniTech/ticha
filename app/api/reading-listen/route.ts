import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getAuthedUser, getOwnedChild, serviceClient } from "@/lib/apiAuth";

// One-shot "what did the child just say" for the reading tutor. Replaces
// Gemini Live's report_attempt function-calling entirely: there is no live
// conversational model left in reading mode to relay what it heard, so the
// app transcribes the child's own captured clip directly and judges it
// itself (judgeHeard, unchanged) — which also removes a whole category of
// old timing bugs (a report arriving before the child spoke, a report that
// never arrives, a stray report during an unscored moment) because there is
// no longer a second party's own turn-taking to race against.
//
// The child's audio is sent once, judged once; it is never stored (same
// privacy stance the old Live-based listening had — only the verdict is
// kept, never the recording or a transcript, beyond this one request).
//
// Auth mirrors /api/reading-attempt: a signed-in parent, child ownership
// checked through RLS, reading consent required. Unlike /api/gemini-key,
// reading mode has no anonymous demo path (prepare() already requires a real
// childId and consent before a lesson can start), so there is no legitimate
// unauthenticated caller to carve out — every request here must be a known
// parent acting for their own child. The rate limit is keyed on that verified
// childId, not a client-asserted IP header, which a caller can spoof freely.

const RATE_LIMIT = 60; // one call per child utterance; generous for a full lesson
const RATE_WINDOW_SEC = 60;

async function isRateLimited(childId: string): Promise<boolean> {
  try {
    const { data, error } = await serviceClient().rpc("check_rate_limit", {
      p_id: `reading-listen:${childId}`,
      p_limit: RATE_LIMIT,
      p_window_seconds: RATE_WINDOW_SEC,
    });
    if (error) throw error;
    return data === true;
  } catch (err) {
    console.error("Rate limit check failed for reading-listen", childId, "-", err);
    // Fail open here, but only ever reached after auth + ownership + consent
    // are already verified below — this is the same precedent reading-attempt
    // sets ("known parent, already ownership-checked: fail open rather than
    // lose a lesson"), not an open fail-open on an anonymous caller.
    return false;
  }
}

export async function POST(req: NextRequest) {
  const { user, supabase: userClient } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const childId = new URL(req.url).searchParams.get("childId");
  if (!childId) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const child = await getOwnedChild(userClient, childId);
  if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: consent } = await userClient
    .from("children").select("reading_consent_at").eq("id", childId).single();
  if (!consent?.reading_consent_at) return NextResponse.json({ error: "Consent required" }, { status: 403 });

  if (await isRateLimited(childId)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  let audioB64: string;
  try {
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length === 0 || buf.length > 2_000_000) return NextResponse.json({ error: "Bad audio" }, { status: 400 }); // ~1 min of 16kHz mono PCM16, generous for one short answer
    audioB64 = buf.toString("base64");
  } catch {
    return NextResponse.json({ error: "Bad audio" }, { status: 400 });
  }

  try {
    const client = new GoogleGenAI({ apiKey: key });
    const res = await client.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [{
        role: "user",
        parts: [
          { text: "This is a short audio clip of a young child saying a single Swahili letter, syllable, or word in isolation. Transcribe EXACTLY what you hear, in plain lowercase Swahili spelling, nothing else — no punctuation, no explanation. If you hear nothing usable (silence, noise, an unclear mumble), reply with an empty response." },
          { inlineData: { mimeType: "audio/wav", data: audioB64 } },
        ],
      }],
    });
    return NextResponse.json({ heard: (res.text ?? "").trim() });
  } catch (err) {
    console.error("reading-listen transcription failed:", err instanceof Error ? err.message : "unknown");
    // Fail toward "heard nothing" rather than erroring the lesson out — an
    // unscored attempt is the same safe fallback the old report-timeout used.
    return NextResponse.json({ heard: "" });
  }
}
