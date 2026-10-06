import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { resolveLineText } from "@/lib/reading/scripts";
import { serviceClient } from "@/lib/apiAuth";

// On-the-fly TTS for the scripted reading tutor. This is the FALLBACK path,
// not the default: almost every line is pre-generated offline, reviewed, and
// served as a static file from /audio/reading-script/ with zero latency. This
// route exists only for:
//   - the two name-dependent lines (greeting, lesson_end) — can never be
//     pre-generated, since the child's name isn't known ahead of time
//   - the reaction-word template — same reason, the matched word varies
//   - any pre-generated line that is missing or still pending review
//
// The client never sends free text here — only a known lineId (+ name/word
// where required), resolved server-side via resolveLineText. This keeps the
// paid TTS call from being usable as an arbitrary free-text generator at the
// app's expense, same spirit as /api/gemini-key never handing out the real key.
//
// Returns the raw WAV bytes Gemini TTS produces — playable directly by the
// browser's Web Audio API, no server-side ffmpeg needed for this path (that
// stays local-only, for the offline pre-generation pipeline).

const RATE_LIMIT = 30; // generous: a lesson needs at most a handful of these per sitting
const RATE_WINDOW_SEC = 60;
const VOICE = "Kore";

async function isRateLimited(id: string): Promise<boolean> {
  try {
    const { data, error } = await serviceClient().rpc("check_rate_limit", {
      p_id: `reading-speak:${id}`,
      p_limit: RATE_LIMIT,
      p_window_seconds: RATE_WINDOW_SEC,
    });
    if (error) throw error;
    return data === true;
  } catch (err) {
    console.error("Rate limit check failed for reading-speak", id, "-", err);
    return false; // fail open — a missing line would otherwise silently break a lesson
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const { lineId, name, word } = (body as { lineId?: unknown; name?: unknown; word?: unknown }) ?? {};
  if (typeof lineId !== "string" || lineId.length === 0 || lineId.length > 64) {
    return NextResponse.json({ error: "Bad lineId" }, { status: 400 });
  }

  const text = resolveLineText(lineId, {
    name: typeof name === "string" ? name.slice(0, 64) : undefined,
    word: typeof word === "string" ? word.slice(0, 64) : undefined,
  });
  if (!text) return NextResponse.json({ error: "Unknown line" }, { status: 400 });

  const headerStore = req.headers;
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown";
  if (await isRateLimited(`ip:${ip}`)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  try {
    const client = new GoogleGenAI({ apiKey: key });
    const res = await client.models.generateContent({
      model: "gemini-3.8-flash-tts",
      contents: [{ role: "user", parts: [{ text }] }],
      config: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
    });
    const b64 = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!b64) throw new Error("no audio in TTS response");
    return new NextResponse(Buffer.from(b64, "base64"), { headers: { "Content-Type": "audio/wav" } });
  } catch (err) {
    console.error("reading-speak TTS failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Could not generate speech" }, { status: 503 });
  }
}
