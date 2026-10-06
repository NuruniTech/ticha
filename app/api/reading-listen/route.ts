import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { serviceClient } from "@/lib/apiAuth";

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

const RATE_LIMIT = 60; // one call per child utterance; generous for a full lesson
const RATE_WINDOW_SEC = 60;

async function isRateLimited(id: string): Promise<boolean> {
  try {
    const { data, error } = await serviceClient().rpc("check_rate_limit", {
      p_id: `reading-listen:${id}`,
      p_limit: RATE_LIMIT,
      p_window_seconds: RATE_WINDOW_SEC,
    });
    if (error) throw error;
    return data === true;
  } catch (err) {
    console.error("Rate limit check failed for reading-listen", id, "-", err);
    return false; // fail open — a missed check must not strand a lesson mid-turn
  }
}

export async function POST(req: NextRequest) {
  const headerStore = req.headers;
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown";
  if (await isRateLimited(`ip:${ip}`)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

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
