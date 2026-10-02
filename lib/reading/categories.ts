// Reading categories: the child (or parent) explicitly picks what to work on —
// Vowels or Consonants — like the vocabulary tutor's game topics. The session
// stays inside that category until it is mastered, instead of silently drifting
// from vowels into syllables underneath the child without anyone choosing that.
//
// Consonants is locked until every vowel is mastered. There is no age gate: a
// child of any age can start on Vowels; Consonants opens on mastery alone.
// (Replaces the earlier age-based "track" system, which only gated the
// YOUNGEST children this way and let everyone else skip straight to syllables
// from session 2 — a real bug, not the intended design.)

import { READING_ITEMS, type ReadingItemKind } from "./curriculum";
import { itemState, type Attempt } from "./mastery";

export type ReadingCategory = "vowels" | "consonants";
export const READING_CATEGORIES: ReadingCategory[] = ["vowels", "consonants"];

// Which curriculum item kinds belong to each category. Consonants includes the
// words woven into it (e.g. "mama"), as agreed — a bigger, standalone word bank
// is a separate "Words" category, not yet built.
export const CATEGORY_KINDS: Record<ReadingCategory, ReadingItemKind[]> = {
  vowels: ["vowel"],
  consonants: ["syllable", "word"],
};

const vowelItems = () => READING_ITEMS.filter((i) => i.kind === "vowel");

export function isCategoryUnlocked(category: ReadingCategory, attemptsByItem: Record<string, Attempt[]>): boolean {
  if (category === "vowels") return true;
  return vowelItems().every((v) => itemState(attemptsByItem[v.id] ?? []) === "mastered");
}

// For a completion badge on the child's page — every item in the category mastered.
export function isCategoryMastered(category: ReadingCategory, attemptsByItem: Record<string, Attempt[]>): boolean {
  const kinds = CATEGORY_KINDS[category];
  return READING_ITEMS.filter((i) => kinds.includes(i.kind)).every((i) => itemState(attemptsByItem[i.id] ?? []) === "mastered");
}

export const isReadingCategory = (s: string): s is ReadingCategory => (READING_CATEGORIES as string[]).includes(s);
