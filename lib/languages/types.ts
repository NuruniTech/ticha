// Core types for the language data layer.

// Open string union: "en" and "sw" get autocomplete, but new codes
// (e.g. "yo", "am", "zu") type-check without touching this file.
export type LanguageCode = "en" | "sw" | (string & {});

export interface VocabForm {
  text: string;
  phonetic?: string; // pronunciation reference — never sent verbatim to the model
}

// A language-neutral vocabulary item. `id` is a stable opaque key
// (historically the Swahili spelling); it is the progress-table key and the
// quiz-URL token — never change existing ids.
export interface Concept {
  id: string;
  emoji: string;
  forms: Partial<Record<LanguageCode, VocabForm>>;
}

export interface LanguageMeta {
  code: LanguageCode;
  nameEn: string;      // "Swahili"
  nativeName: string;  // "Kiswahili"
  flag: string;        // "🇹🇿"
}

// A course pairs the language being TAUGHT with the language of INSTRUCTION
// (the child's stronger language, used for explanations).
export interface Course {
  target: LanguageMeta;
  instruction: LanguageMeta;
}

// A vocabulary word fully resolved for one course — what games and UI
// consume. Games never look at language codes.
export interface GameWord {
  id: string;          // concept id (progress key)
  text: string;        // target-language form (what the child is learning)
  translation: string; // instruction-language form
  emoji: string;
  phonetic?: string;   // target-language phonetic, when available
}
