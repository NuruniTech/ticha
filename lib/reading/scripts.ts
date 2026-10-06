// The exact Swahili lines Ticha speaks in the Vowels lesson, under the new
// scripted-TTS architecture (see docs/superpowers/specs/2026-10-06-reading-tts-
// scripted-architecture-design.md). Reviewed and corrected by the founder in
// lib/reading/scripts.draft.md — this file is the structured, stable-ID source
// of truth derived from that review; the .draft.md stays as the human-readable
// record of what was approved and why.
//
// Every line here is either:
//   - a FIXED line: TTS-generated once, offline, shipped as a static file
//     (see scripts/reading-narration/) — no live generation, no paraphrasing
//   - a NAME-DEPENDENT line: generated on the fly at session time (accepts the
//     ~3s TTS latency), because it must include the child's actual name
//
// Variants exist purely for repeated moments (praise, retries) so the same
// thing isn't said the same way every time — each is its own audio file,
// picked at random at runtime, same spirit as the old PRAISES array.

export interface ScriptEntry {
  id: string;
  text: string; // exact Swahili text as approved
}

// ── Opening ──────────────────────────────────────────────────────────────────

// Name-dependent: generated live, not pre-cached. {name} is substituted before
// the TTS call, never baked into a static file.
export const GREETING = (name: string) => `Hujambo ${name}! Nimefurahi sana kukuona leo.`;
export const LESSON_END = (name: string) => `Umefanya kazi nzuri sana leo, ${name}! Ninajivunia sana kuwa mwalimu wako. Tutaonana tena!`;

export const WARMUP_FEELING: ScriptEntry = { id: "warmup_feeling", text: "Unajisikiaje leo?" };

// Keyword-matched reaction to the child's answer about how they're feeling.
// Matching is case-insensitive substring matching against `keywords`.
export interface ReactionGroup { id: string; keywords: string[]; variants: string[] }
export const WARMUP_FEELING_REACTIONS: ReactionGroup[] = [
  { id: "feeling_positive", keywords: ["nzuri", "vizuri", "salama"], variants: ["Ni vizuri sana kusikia hivyo!", "Nimefurahi!"] },
  { id: "feeling_sijambo", keywords: ["sijambo"], variants: ["Safi kabisa!"] },
  { id: "feeling_tired", keywords: ["mchovu", "nimechoka"], variants: ["Pole sana. Tutacheza kwa polepole leo."] },
];
export const WARMUP_FEELING_FALLBACK: ScriptEntry = { id: "warmup_feeling_fallback", text: "Asante kwa kuniambia hivyo!" };

// One of these three is picked at random for the warmup's "fun question" turn.
export const WARMUP_QUESTIONS: ScriptEntry[] = [
  { id: "warmup_q_animal", text: "Ni mnyama gani unampenda zaidi kuliko wengine?" },
  { id: "warmup_q_food", text: "Umekula kitu gani kizuri leo?" },
  { id: "warmup_q_colour", text: "Ni rangi gani unaipenda zaidi?" },
];

// Keyword groups for reacting to the fun-question answer, grouped by which
// question was asked (an animal word only matters if the animal question was
// the one asked, etc). {word} is substituted with the actual matched keyword.
export const WARMUP_ANIMAL_WORDS = ["simba", "tembo", "paka", "mbwa", "ndege", "twiga", "nyani", "sungura", "chui"];
export const WARMUP_FOOD_WORDS = ["ndizi", "embe", "ugali", "wali", "chapati", "maharage", "nyama", "samaki"];
export const WARMUP_COLOUR_WORDS = ["nyekundu", "buluu", "kijani", "njano", "nyeusi", "nyeupe", "zambarau", "machungwa"];
export const WARMUP_QUESTION_REACTION_TEMPLATE = (word: string) => `${word} ni mzuri sana!`; // adapted per-category at use (see note below)
export const WARMUP_QUESTION_REACTION_FALLBACK: ScriptEntry = { id: "warmup_q_reaction_fallback", text: "Hiyo ni nzuri sana!" };

export const READY_CHECK: ScriptEntry = { id: "ready_check", text: "Safi! Leo utajifunza sauti nzuri za kufurahisha. Je, uko tayari?" };

// ── Class intro (vowels only, said once before the first vowel) ────────────

export const CLASS_INTRO: ScriptEntry = {
  id: "class_intro",
  text: "Leo tutakutana na marafiki watano maalum. Wanaitwa irabu: a, e, i, o, u. Tutawajua mmoja mmoja, tukianza na huyu.",
};

// ── Per-vowel teaching ───────────────────────────────────────────────────────

const ANCHOR_SENTENCE: Record<string, string> = {
  a: "Hii ni a. Ni sauti ya kwanza katika neno 'asali'. Sikiliza: aaa.",
  e: "Hii ni e. Ni sauti ya kwanza katika neno 'embe'. Sikiliza: eee.",
  i: "Hii ni i. Ni sauti ya kwanza katika neno 'ini'. Sikiliza: iii.",
  o: "Hii ni o. Ni sauti ya kwanza katika neno 'oga'. Sikiliza: ooo.",
  u: "Hii ni u. Ni sauti ya kwanza katika neno 'uji'. Sikiliza: uuu.",
};
const TOGETHER_SENTENCE: Record<string, string> = {
  a: "Twende pamoja: aaa.",
  e: "Twende pamoja: eee.",
  i: "Twende pamoja: iii.",
  o: "Twende pamoja: ooo.",
  u: "Twende pamoja: uuu.",
};
export const VOWELS = ["a", "e", "i", "o", "u"] as const;
export const teachModel = (vowel: string): ScriptEntry => ({ id: `teach_model_${vowel}`, text: ANCHOR_SENTENCE[vowel] });
export const teachTogether = (vowel: string): ScriptEntry => ({ id: `teach_together_${vowel}`, text: TOGETHER_SENTENCE[vowel] });

// Shared across every vowel — the screen shows which one, so the audio stays generic.
export const TEACH_ALONE: ScriptEntry = { id: "teach_alone", text: "Sasa ni zamu yako. Jaribu kusema peke yako." };

export const TEACH_PLAY: ScriptEntry[] = [
  { id: "play_1", text: "Tuseme kwa sauti ya panya mdogo... alafu kwa sauti ya simba mkubwa!" },
  { id: "play_2", text: "Tuseme polepole kama konokono... alafu haraka kama sungura!" },
  { id: "play_3", text: "Tunong'one kama siri... alafu tuseme kwa sauti kubwa!" },
  { id: "play_4", text: "Tupige makofi mara moja tunaposema!" },
];

// ── Feedback (shared across every item, not vowel-specific) ────────────────

export const PRAISE: ScriptEntry[] = [
  { id: "praise_1", text: "Vizuri sana!" },
  { id: "praise_2", text: "Hongera sana!" },
  { id: "praise_3", text: "Safi kabisa!" },
  { id: "praise_4", text: "Umefanya vizuri!" },
  { id: "praise_5", text: "Ndiyo, ni sahihi!" },
  { id: "praise_6", text: "Vizuri kabisa, wewe una akili sana!" },
];

export const RETRY_INCORRECT: ScriptEntry[] = [
  { id: "retry_incorrect_1", text: "Umekosea kidogo sana. Embu tusikilize tena pamoja." },
  { id: "retry_incorrect_2", text: "Safi! Sasa jaribu tena." },
];

export const RETRY_UNSCORED: ScriptEntry = { id: "retry_unscored", text: "Sijakusikia vizuri. Sema tena, tafadhali." };
export const MOVED_ON_AFTER_MISS: ScriptEntry = { id: "moved_on_after_miss", text: "Ni sawa, tutajaribu tena siku nyingine." };
export const CHECK_NEUTRAL: ScriptEntry = { id: "check_neutral", text: "Asante!" };
export const CHECK_DISCONTINUE: ScriptEntry = { id: "check_discontinue", text: "Asante sana kwa kujaribu. Tumemaliza mchezo huu, na umefanya vizuri sana leo." };

// ── Closing round ("mixed") ──────────────────────────────────────────────────

export const MIXED_INTRO: ScriptEntry = {
  id: "mixed_intro",
  text: "Twende pamoja: a, e, i, o, u! Sasa tutacheza na vyote tulivyojifunza leo, kama sherehe ndogo!",
};

// ── Resolving a line id back to text (server-side: pipeline generation AND the
// on-the-fly fallback API route both call this, so there is exactly one place
// that knows how to turn an id into words) ──────────────────────────────────

const FIXED_BY_ID: Record<string, string> = Object.fromEntries(
  [
    WARMUP_FEELING,
    WARMUP_FEELING_FALLBACK,
    ...WARMUP_QUESTIONS,
    WARMUP_QUESTION_REACTION_FALLBACK,
    READY_CHECK,
    CLASS_INTRO,
    TEACH_ALONE,
    ...TEACH_PLAY,
    ...PRAISE,
    ...RETRY_INCORRECT,
    RETRY_UNSCORED,
    MOVED_ON_AFTER_MISS,
    CHECK_NEUTRAL,
    CHECK_DISCONTINUE,
    MIXED_INTRO,
  ].map((e) => [e.id, e.text])
);
for (const g of WARMUP_FEELING_REACTIONS) g.variants.forEach((text, i) => { FIXED_BY_ID[`${g.id}_${i + 1}`] = text; });
for (const v of VOWELS) { FIXED_BY_ID[teachModel(v).id] = teachModel(v).text; FIXED_BY_ID[teachTogether(v).id] = teachTogether(v).text; }

/** Finds which reaction group (if any) a child's transcribed answer matches, for the feeling warmup turn. */
export function matchFeelingReaction(heard: string): { groupId: string; variants: string[] } | null {
  const h = heard.toLowerCase();
  const group = WARMUP_FEELING_REACTIONS.find((g) => g.keywords.some((k) => h.includes(k)));
  return group ? { groupId: group.id, variants: group.variants } : null;
}

export type FunCategory = "animal" | "food" | "colour";
const CATEGORY_WORDS: Record<FunCategory, string[]> = { animal: WARMUP_ANIMAL_WORDS, food: WARMUP_FOOD_WORDS, colour: WARMUP_COLOUR_WORDS };

/** Finds which known word (if any) a child's answer contains, for the fun-question warmup turn. */
export function matchFunWord(category: FunCategory, heard: string): string | null {
  const h = heard.toLowerCase();
  return CATEGORY_WORDS[category].find((w) => h.includes(w)) ?? null;
}

/**
 * Resolves any line id to its exact text. `name` is required for the two
 * name-dependent ids; `word` is required for the on-the-fly reaction-template
 * id (`warmup_q_reaction_word`). Returns null for an unknown id — callers
 * must treat that as a bug, never silently fall back to arbitrary text.
 */
export function resolveLineText(id: string, opts: { name?: string; word?: string } = {}): string | null {
  if (id === "greeting") return opts.name ? GREETING(opts.name) : null;
  if (id === "lesson_end") return opts.name ? LESSON_END(opts.name) : null;
  if (id === "warmup_q_reaction_word") return opts.word ? WARMUP_QUESTION_REACTION_TEMPLATE(opts.word) : null;
  return FIXED_BY_ID[id] ?? null;
}

// ── Every FIXED entry, for the generation/verification pipeline ────────────
// (name-dependent GREETING/LESSON_END deliberately excluded — never pre-generated)
export function allFixedEntries(): ScriptEntry[] {
  return [
    WARMUP_FEELING,
    ...WARMUP_FEELING_REACTIONS.flatMap((g) => g.variants.map((text, i) => ({ id: `${g.id}_${i + 1}`, text }))),
    WARMUP_FEELING_FALLBACK,
    ...WARMUP_QUESTIONS,
    WARMUP_QUESTION_REACTION_FALLBACK,
    READY_CHECK,
    CLASS_INTRO,
    ...VOWELS.map(teachModel),
    ...VOWELS.map(teachTogether),
    TEACH_ALONE,
    ...TEACH_PLAY,
    ...PRAISE,
    ...RETRY_INCORRECT,
    RETRY_UNSCORED,
    MOVED_ON_AFTER_MISS,
    CHECK_NEUTRAL,
    CHECK_DISCONTINUE,
    MIXED_INTRO,
  ];
}
