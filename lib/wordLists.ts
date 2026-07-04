// ─────────────────────────────────────────────────────────────────────────────
// LEGACY COMPATIBILITY VIEW — derived from lib/languages/vocabulary.ts.
// The canonical vocabulary now lives there as language-neutral concepts.
// This module keeps the historical { sw, en, emoji, swPhonetic } shape for
// code that still assumes the en↔sw pairing (the lesson prompt engine).
// New code should use resolveWords()/GameWord from lib/languages instead.
// ─────────────────────────────────────────────────────────────────────────────
import { CONCEPTS } from "./languages/vocabulary.ts";

export interface QuizWord { sw: string; en: string; emoji: string; swPhonetic: string; }

export const WORD_LISTS: Record<string, QuizWord[]> = Object.fromEntries(
  Object.entries(CONCEPTS).map(([category, concepts]) => [
    category,
    concepts.map((c) => ({
      sw:         c.forms.sw?.text ?? c.id,
      en:         c.forms.en?.text ?? c.id,
      emoji:      c.emoji,
      swPhonetic: c.forms.sw?.phonetic ?? "",
    })),
  ])
);
