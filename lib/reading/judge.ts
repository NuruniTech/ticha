// The APP decides whether an attempt was right, not the AI.
//
// Gemini knows which item is on screen, so if we asked it "was that correct?" it
// tends to confirm the expected answer even when the child said something else.
// Instead Ticha only reports what she heard, in Swahili spelling, and we compare
// that with the target here. Strict on purpose: a wrong sound must not be praised.

import { getItem } from "./curriculum";
import type { AttemptOutcome } from "./mastery";

// Things the model may write instead of leaving the field empty.
const NO_SPEECH = new Set(["unclear", "nothing", "silence", "none", "unknown", "noise", "n/a", "na", "?"]);

// Lower-case letters only, with runs of the same letter collapsed, so a child
// drawing the sound out ("baaa", "aaa") still matches "ba" and "a".
export function normalizeSpeech(text: string): string {
  return text.toLowerCase().replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");
}

// A plain vowel sound has no single obvious ASCII spelling (the Swahili "e" sound
// is informally written "e" or "eh" depending on the writer), so when Ticha
// transcribes what she heard she may render it either way. This only WIDENS what
// counts as correct — it can never turn a real answer into a false "incorrect" —
// so it stays as a safety net for matching even though Ticha is no longer asked
// to SPEAK any respelling (see instructions.ts: an earlier version asked her to
// read fabricated spellings like "bah"/"soh-mah" aloud, which produced words that
// were neither English nor Swahili; that is gone from what she is told to say).
const VOWEL_RESPELL: Record<string, string> = { a: "ah", e: "eh", i: "ee", o: "oh", u: "oo" };
const respellUnit = (unit: string): string => `${unit.slice(0, -1)}${VOWEL_RESPELL[unit.slice(-1)] ?? unit.slice(-1)}`;
const respellItem = (itemId: string): string => getItem(itemId)!.syllables.map(respellUnit).join("");

export function judgeHeard(itemId: string, heard: unknown): AttemptOutcome {
  const item = getItem(itemId);
  if (!item || typeof heard !== "string") return "unscored";
  if (NO_SPEECH.has(heard.trim().toLowerCase())) return "unscored";
  const h = normalizeSpeech(heard);
  if (!h) return "unscored";
  const targets = new Set([normalizeSpeech(item.text), normalizeSpeech(respellItem(itemId))]);
  return targets.has(h) ? "correct" : "incorrect";
}
