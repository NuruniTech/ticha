import { GoogleGenAI } from "@google/genai";

// Mints a one-use ephemeral Live token.
//
// Transport order, chosen to keep the key out of URLs wherever possible:
//   1. The SDK, which sends the key in the x-goog-api-key HEADER (safer).
//   2. Only if that is rejected: REST with the key as a ?key= query parameter.
//
// Why step 2 exists: Google's new "AQ." auth keys are rejected (401
// ACCESS_TOKEN_TYPE_UNSUPPORTED) in the header, but accepted as ?key= — verified
// against the live API on 2026-09-24. Old "AIza" keys never need step 2.
// Once step 2 has been needed, this server instance goes straight to it, so
// only that key type ever travels in a URL, and only server -> Google over TLS.
//
// The key must never reach a log: errors are rebuilt from a scrubbed message
// (no cause, no stack, no URL) before they leave this module.

const ENDPOINT = "https://generativelanguage.googleapis.com/v1alpha/auth_tokens";

export interface TokenTimes { expireTime: string; newSessionExpireTime: string }

let preferRest = false;
export const resetTokenTransportForTests = () => { preferRest = false; };

async function viaSdk(key: string, t: TokenTimes): Promise<string> {
  const client = new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: "v1alpha" } });
  const token = await client.authTokens.create({
    config: { uses: 1, ...t, httpOptions: { apiVersion: "v1alpha" } },
  });
  if (!token.name) throw new Error("Empty token");
  return token.name;
}

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

// Short, key-free description of an error, safe to log.
function scrub(err: unknown, key: string): string {
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : "unknown error";
  return raw.split(key).join("<key>").split(encodeURIComponent(key)).join("<key>").slice(0, 200);
}

export async function mintEphemeralToken(key: string, t: TokenTimes): Promise<string> {
  try {
    if (preferRest) return await viaRest(key, t);
    try {
      return await viaSdk(key, t);
    } catch (sdkErr) {
      console.error("Ephemeral token via SDK failed, trying REST:", scrub(sdkErr, key));
      const token = await viaRest(key, t);
      preferRest = true;
      return token;
    }
  } catch (err) {
    // Rebuilt without cause or stack so nothing upstream can leak the key.
    throw new Error(scrub(err, key));
  }
}
