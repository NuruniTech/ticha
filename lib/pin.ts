// Parent PIN helpers.
//
// The PIN is a child gate, not account security: it stops a child who is
// already using the app from wandering into parent areas (dashboard,
// settings, progress). The account password remains the real boundary.
//
// Stored as SHA-256(userId : pin) in profiles.parent_pin_hash. Unlocking is
// remembered per browser tab (sessionStorage) — closing the tab re-locks.

export const PIN_SESSION_KEY = "ticha_pin_ok";

// A sign-in this recent auto-unlocks the gate: entering account credentials
// proves the grown-up is present (also covers "forgot PIN" → sign out & in).
export const FRESH_LOGIN_WINDOW_MS = 2 * 60 * 1000;

export async function hashPin(pin: string, userId: string): Promise<string> {
  const data = new TextEncoder().encode(`ticha-pin:${userId}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isPinUnlocked(): boolean {
  try { return sessionStorage.getItem(PIN_SESSION_KEY) === "1"; }
  catch { return true; } // storage unavailable — fail open, never brick the app
}

export function markPinUnlocked(): void {
  try { sessionStorage.setItem(PIN_SESSION_KEY, "1"); } catch { /* ignore */ }
}
