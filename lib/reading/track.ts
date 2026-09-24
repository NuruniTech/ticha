// Which part of the reading curriculum a child gets, by age.
//
// Early-childhood guidance (age 3-5) sets letter and sound recognition as the
// target, not decoding syllables and words, and a 3-4 year old would find a
// timed-style check far too hard. So:
//   early (age 4 and under): the five vowels only, no before/after check
//   full  (age 5 and over, or age unknown): vowels -> syllables -> words, with checks
// An unknown age gets the full track because we cannot tell; the parent can set
// the age on the child's profile.

import type { ReadingItemKind } from "./curriculum";

export type ReadingTrack = "early" | "full";

export const EARLY_TRACK_MAX_AGE = 4;

export function readingTrack(age?: number | null): ReadingTrack {
  return typeof age === "number" && Number.isFinite(age) && age <= EARLY_TRACK_MAX_AGE ? "early" : "full";
}

export const trackKinds = (track: ReadingTrack): ReadingItemKind[] =>
  track === "early" ? ["vowel"] : ["vowel", "syllable", "word"];
