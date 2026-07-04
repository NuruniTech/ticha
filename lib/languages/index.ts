// Language registry + course resolution.
//
// The database stores one code per child (children.primary_language) which
// historically means "the language being taught". getCourse() expands that
// into an explicit { target, instruction } pair so the rest of the app never
// hard-codes the en↔sw assumption.

import type { Concept, Course, GameWord, LanguageCode, LanguageMeta } from "./types.ts";
import { CONCEPTS } from "./vocabulary.ts";

export type { Concept, Course, GameWord, LanguageCode, LanguageMeta };
export { CONCEPTS };

export const LANGUAGES: Record<string, LanguageMeta> = {
  en: { code: "en", nameEn: "English", nativeName: "English",   flag: "🇬🇧" },
  sw: { code: "sw", nameEn: "Swahili", nativeName: "Kiswahili", flag: "🇹🇿" },
  // Add new languages here + a form for each concept in vocabulary.ts.
  // Example: yo: { code: "yo", nameEn: "Yoruba", nativeName: "Yorùbá", flag: "🇳🇬" },
};

// Maps the stored code (= target language) to a full course.
// Instruction defaults: English targets are taught through Swahili (the
// original product pairing); every other target is taught through English.
export function getCourse(storedCode: string): Course {
  const target = LANGUAGES[storedCode] ?? LANGUAGES.sw;
  const instruction = target.code === "en" ? LANGUAGES.sw : LANGUAGES.en;
  return { target, instruction };
}

// Resolve one concept for a course. Falls back to the concept id / English
// form so a missing translation never renders an empty tile.
export function resolveConcept(concept: Concept, course: Course): GameWord {
  const targetForm      = concept.forms[course.target.code];
  const instructionForm = concept.forms[course.instruction.code];
  return {
    id:          concept.id,
    text:        targetForm?.text ?? concept.id,
    translation: instructionForm?.text ?? concept.forms.en?.text ?? concept.id,
    emoji:       concept.emoji,
    phonetic:    targetForm?.phonetic,
  };
}

// All words of a category, resolved for a course (pedagogical order kept).
export function resolveWords(category: string, course: Course): GameWord[] {
  const concepts = CONCEPTS[category] ?? CONCEPTS.animals;
  return concepts.map((c) => resolveConcept(c, course));
}

// Resolve specific concept ids (e.g. from a quiz URL); unknown ids are
// dropped. Searches every category so callers don't need to know one.
export function resolveWordsByIds(ids: string[], course: Course): GameWord[] {
  const byId = new Map<string, Concept>();
  for (const list of Object.values(CONCEPTS)) {
    for (const c of list) if (!byId.has(c.id)) byId.set(c.id, c);
  }
  return ids
    .map((id) => byId.get(id))
    .filter((c): c is Concept => Boolean(c))
    .map((c) => resolveConcept(c, course));
}
