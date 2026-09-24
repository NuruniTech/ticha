import { GoogleGenAI } from "@google/genai";

// Mints a one-use ephemeral Live token.
//
// Why REST first: Google's new "AQ." auth keys are rejected (401
// ACCESS_TOKEN_TYPE_UNSUPPORTED) when sent in the x-goog-api-key HEADER, which is
// what the SDK does — but the same key works when sent as the ?key= query
// parameter. (Verified against the live API on 2026-09-24; standard AIza keys
// accept both.) So we call the REST endpoint directly with ?key= and fall back
// to the SDK if that fails. This runs on the server only; the key never reaches
// the browser, and the URL must never be logged.
//
// Never include the request URL (it contains the key) in an error message.

const ENDPOINT = "https://generativelanguage.googleapis.com/v1alpha/auth_tokens";

export interface TokenTimes { expireTime: string; newSessionExpireTime: string }

async function viaRest(key: string, t: TokenTimes): Promise<string> {
  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uses: 1, ...t }),
  });
  if (!res.ok) throw new Error(`auth_tokens REST failed: HTTP ${res.status}`);
  const data = (await res.json()) as { name?: string };
  if (!data.name) throw new Error("auth_tokens REST returned no token");
  return data.name;
}

async function viaSdk(key: string, t: TokenTimes): Promise<string> {
  const client = new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: "v1alpha" } });
  const token = await client.authTokens.create({
    config: { uses: 1, ...t, httpOptions: { apiVersion: "v1alpha" } },
  });
  if (!token.name) throw new Error("Empty token");
  return token.name;
}

export async function mintEphemeralToken(key: string, t: TokenTimes): Promise<string> {
  try {
    return await viaRest(key, t);
  } catch (restErr) {
    console.error("Ephemeral token via REST failed, trying SDK:", restErr instanceof Error ? restErr.message : "unknown");
    return await viaSdk(key, t);
  }
}
