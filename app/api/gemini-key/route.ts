import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { GoogleGenAI } from "@google/genai";
import { serviceClient } from "@/lib/apiAuth";

// Mints a short-lived, single-use ephemeral Gemini token for one Live session.
// The real GEMINI_API_KEY never leaves the server — a leaked token expires on
// its own and cannot be reused, so browser exposure is no longer a risk.
//
// Access rules:
//   - Logged-in parents: 10 tokens per user per minute.
//   - Anonymous visitors (the /demo "Try Without Signing Up" flow): 3 tokens
//     per IP per minute — enough for one demo session + reconnects.
//
// The limiter counts in Postgres (public.check_rate_limit, see lib/schema.sql)
// rather than in memory. On Vercel serverless, in-process state is per-instance
// and resets on every cold start, so an in-memory Map was effectively no limit
// at all — and this route bills real money for anonymous callers.
const RATE_LIMIT_USER = 10;
const RATE_LIMIT_DEMO = 3;
const RATE_WINDOW_SEC = 60;

// Token lifetime must outlive the longest possible lesson —
// VoiceSession's safety timeout is 45 min, so 50 min covers it.
const TOKEN_LIFETIME_MS     = 50 * 60 * 1000;
// A fetched token must be used to start a session almost immediately.
const NEW_SESSION_WINDOW_MS = 2 * 60 * 1000;

// Returns true when this caller should be rejected.
//
// If the limiter itself is broken (Supabase down, migration not run) we have to
// choose which way to fail. Anonymous callers fail CLOSED: they are the billing
// exposure, and losing the demo for a few minutes is cheaper than an unmetered
// token faucet. Signed-in parents fail OPEN: they are known, already capped at
// 10/min, and a database blip should not break a lesson mid-session.
async function isRateLimited(
  id: string,
  limit: number,
  failClosed: boolean
): Promise<boolean> {
  try {
    const { data, error } = await serviceClient().rpc("check_rate_limit", {
      p_id: id,
      p_limit: limit,
      p_window_seconds: RATE_WINDOW_SEC,
    });
    if (error) throw error;
    return data === true;
  } catch (err) {
    console.error("Rate limit check failed for", id, "-", err);
    return failClosed;
  }
}

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Anonymous visitors are allowed (demo flow) but rate-limited by IP
  let limiterId: string;
  let limit: number;
  if (user) {
    limiterId = `user:${user.id}`;
    limit     = RATE_LIMIT_USER;
  } else {
    const headerStore = await headers();
    const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim()
      || headerStore.get("x-real-ip")
      || "unknown";
    limiterId = `ip:${ip}`;
    limit     = RATE_LIMIT_DEMO;
  }

  if (await isRateLimited(limiterId, limit, !user)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  try {
    // Ephemeral tokens are only available on the v1alpha API surface
    const client = new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: "v1alpha" } });
    const now = Date.now();
    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime:           new Date(now + TOKEN_LIFETIME_MS).toISOString(),
        newSessionExpireTime: new Date(now + NEW_SESSION_WINDOW_MS).toISOString(),
        httpOptions: { apiVersion: "v1alpha" },
      },
    });
    if (!token.name) throw new Error("Empty token");
    return NextResponse.json({ token: token.name });
  } catch (err) {
    console.error("Ephemeral token creation failed:", err);
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
}
