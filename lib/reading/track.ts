// Which part of the reading curriculum a child gets, by age.
//
// Early-childhood guidance (age 3-5) sets letter and sound recognition as the
// target, not decoding syllables and words, and a 3-4 year old would find a
// timed-style check far too hard. So:
//   early (age 4 and under): the five vowels only, no before/after check
//   full  (age 5 and over, or age unknown): vowels -> syllables -> words, with checks
// An unknown age gets the full track because we cannot tell; the parent can set
// the age on the child's profile.

import { READING_ITEMS, type ReadingItemKind } from "./curriculum";
import { itemState, type Attempt } from "./mastery";

export type ReadingTrack = "early" | "full";

export const EARLY_TRACK_MAX_AGE = 4;

export function readingTrack(age?: number | null): ReadingTrack {
  return typeof age === "number" && Number.isFinite(age) && age <= EARLY_TRACK_MAX_AGE ? "early" : "full";
}

/**
 * Age is only where a child STARTS. Once a child has mastered all five vowels they
 * move on to syllables and words whatever their profile age says, so a child who is
 * ahead of their age (or whose age was entered wrongly) is never held back.
 */
export function effectiveTrack(age: number | null | undefined, attemptsByItem: Record<string, Attempt[]>): ReadingTrack {
  if (readingTrack(age) === "full") return "full";
  const vowels = READING_ITEMS.filter((i) => i.kind === "vowel");
  const allMastered = vowels.every((v) => itemState(attemptsByItem[v.id] ?? []) === "mastered");
  return allMastered ? "full" : "early";
}

export const trackKinds = (track: ReadingTrack): ReadingItemKind[] =>
  track === "early" ? ["vowel"] : ["vowel", "syllable", "word"];
