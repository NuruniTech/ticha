import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { GoogleGenAI } from "@google/genai";

// Mints a short-lived, single-use ephemeral Gemini token for one Live session.
// The real GEMINI_API_KEY never leaves the server — a leaked token expires on
// its own and cannot be reused, so browser exposure is no longer a risk.
//
// Access rules:
//   - Logged-in parents: 10 tokens per user per minute.
//   - Anonymous visitors (the /demo "Try Without Signing Up" flow): 3 tokens
//     per IP per minute — enough for one demo session + reconnects.
//
// In-memory rate limiter: on Vercel serverless this state is per-instance, so
// it is a soft limit only. The single-use + 50-minute expiry on each token is
// the real abuse ceiling. If demo abuse ever shows up in billing, swap this
// for a Redis-backed limiter (e.g. @upstash/ratelimit).
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_USER = 10;
const RATE_LIMIT_DEMO = 3;
const RATE_WINDOW_MS  = 60_000;

// Token lifetime must outlive the longest possible lesson —
// VoiceSession's safety timeout is 45 min, so 50 min covers it.
const TOKEN_LIFETIME_MS     = 50 * 60 * 1000;
// A fetched token must be used to start a session almost immediately.
const NEW_SESSION_WINDOW_MS = 2 * 60 * 1000;

function isRateLimited(id: string, limit: number): boolean {
  const now   = Date.now();
  const entry = rateLimitMap.get(id);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(id, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (entry.count >= limit) return true;
  entry.count++;
  return false;
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

  if (isRateLimited(limiterId, limit)) {
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
