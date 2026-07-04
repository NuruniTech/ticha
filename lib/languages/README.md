# lib/languages — the language data layer

Everything language-specific in Ticha flows through this directory. The rest
of the app deals in **concepts** (language-neutral vocabulary items) and
**courses** (a `{ target, instruction }` language pair) — it never hard-codes
"sw" or "en" for word display.

## Files

| File | What it holds |
|---|---|
| `types.ts` | `LanguageCode`, `Concept`, `Course`, `GameWord`, `LanguageMeta` |
| `index.ts` | `LANGUAGES` registry, `getCourse()`, `resolveWords()` / `resolveWordsByIds()` |
| `vocabulary.ts` | All 313 vocabulary concepts with per-language forms. **Order is pedagogical**: words 0–4 = Level 1, 5–9 = Level 2, 10+ = advanced pool |
| `content/exchangeHooks.ts` | Exchange-1 "hooks" — the vivid per-word opening lines, written in the **instruction** language |
| `content/exchangeQuestions.ts` | Exchange-3 mastery-check questions, also per instruction language |

## Key invariants

- **Concept `id`s are permanent.** They are historically the Swahili
  spellings, but treat them as opaque keys: they are the `progress` table's
  word key and the quiz-URL token. Renaming one erases children's mastery
  history for that word.
- **`getSystemPrompt` output is snapshot-tested** (1,950 parameter
  combinations). If you deliberately change lesson content, regenerate the
  snapshot; if you're refactoring, the snapshot must not change.
- The stored `children.primary_language` code means "the language being
  taught". `getCourse()` expands it: English targets are instructed in
  Swahili; all other targets are instructed in English by default.

## How to add a new language (e.g. Yoruba)

1. **Register it** in `index.ts`:
   `yo: { code: "yo", nameEn: "Yoruba", nativeName: "Yorùbá", flag: "🇳🇬" }`
2. **Add a form to each concept** in `vocabulary.ts`:
   `forms: { sw: {...}, en: {...}, yo: { text: "kìnnìún", phonetic: "kee-NEE-oon" } }`
   Missing forms fall back gracefully (English, then the concept id), so you
   can ship category by category.
3. **As a new TARGET** (children learning Yoruba through English): after
   steps 1–2, games and quizzes work. The voice lesson also needs
   target-specific prompt guidance (pronunciation rules, goodbye phrase) —
   see "current limits" below.
4. **As a new INSTRUCTION language** (Yoruba-speaking children learning
   English/Swahili): additionally translate the teaching content — add a
   Yoruba branch in `content/exchangeHooks.ts` and
   `content/exchangeQuestions.ts`, plus UI strings (`lib/translations.ts`
   and the small per-game string tables).

## Current limits (deliberate, next phase)

- `lib/lessonPrompt.ts` still contains en↔sw-specific *instructional
  scaffolding* (the `isSwahili ? ... : ...` blocks for lesson structure,
  goodbye script, pronunciation guide). Vocabulary and per-word teaching
  content are fully data-driven; the scaffold is the remaining hard-coded
  surface, to be parameterized when the first third language is added.
- Gemini Live voice quality for a new language should be validated early —
  it constrains everything else.
