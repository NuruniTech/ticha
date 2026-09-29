// The APP decides whether an attempt was right, not the AI.
//
// Gemini knows which item is on screen, so if we asked it "was that correct?" it
// tends to confirm the expected answer even when the child said something else.
// Instead Ticha only reports what she heard, in Swahili spelling, and we compare
// that with the target here. Strict on purpose: a wrong sound must not be praised.

import { getItem } from "./curriculum";
import { respellItem, respellUnit } from "./instructions";
import type { AttemptOutcome } from "./mastery";

// Things the model may write instead of leaving the field empty.
const NO_SPEECH = new Set(["unclear", "nothing", "silence", "none", "unknown", "noise", "n/a", "na", "?"]);

// Lower-case letters only, with runs of the same letter collapsed, so a child
// drawing the sound out ("baaa", "aaa") still matches "ba" and "a".
export function normalizeSpeech(text: string): string {
  return text.toLowerCase().replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");
}

export function judgeHeard(itemId: string, heard: unknown): AttemptOutcome {
  const item = getItem(itemId);
  if (!item || typeof heard !== "string") return "unscored";
  if (NO_SPEECH.has(heard.trim().toLowerCase())) return "unscored";
  const h = normalizeSpeech(heard);
  if (!h) return "unscored";
  // Ticha is told to SAY the respelling ("eh" for "e", "bah-do" for "bado"), and she
  // reports what she heard using that same respelling, not the raw Swahili spelling.
  // Accept either form, so a correctly pronounced answer is never marked wrong.
  const targets = new Set([
    normalizeSpeech(item.text),
    normalizeSpeech(respellItem(itemId)),
    normalizeSpeech(item.syllables.map(respellUnit).join("")),
  ]);
  return targets.has(h) ? "correct" : "incorrect";
}
