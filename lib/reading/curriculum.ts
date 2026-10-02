// Swahili early-reading curriculum (v1). Pure data — no AI, no I/O.
//
// Kiswahili spelling is regular and read in syllables, so the sequence is:
// vowels -> consonant+vowel syllables -> words built from them.
//
// ⚠ PROPOSAL, NOT FINAL: the consonant order and the word list below were
// chosen by the developer and must be reviewed by a fluent Swahili speaker
// before children use them at scale. Changing an entry means re-recording its
// audio. The letter SET itself is verified: Swahili has 18 single-letter
// consonants and 9 digraph sounds taught as their own letters (b, d, f, g, h,
// j, k, l, m, n, p, r, s, t, v, w, y, z; ch, dh, gh, kh, ng, ng', ny, sh, th —
// https://remedialcorner.com/blog/the-kiswahili-alphabet-a-beginners-guide-to-vowels-and-consonants/).
// The ORDER below keeps the original 8 first (they already have curated words
// attached), then the rest of the single letters, then the digraphs, which are
// more complex sound combinations and conventionally taught after the base set.
// That ordering is a reasonable default, not a researched one — reorder freely.

export type ReadingItemKind = "vowel" | "syllable" | "word";

export interface ReadingItem {
  id: string;          // permanent key: "v-a", "s-ba", "w-baba" (also the audio file name)
  kind: ReadingItemKind;
  text: string;        // what the child sees
  syllables: string[]; // how it is read aloud ("baba" -> ["ba","ba"])
  requires: string[];  // item ids that must be learned before this one (words only)
  gloss?: string;      // English meaning, for parents/reviewers; never shown to the child
  audio: string;       // recorded pronunciation, served from /public
  step: number;        // position in the teaching sequence
}

export const VOWELS = ["a", "e", "i", "o", "u"] as const;
export const CONSONANTS = [
  "b", "m", "t", "k", "n", "l", "s", "d",       // original 8 (already have curated words)
  "f", "g", "h", "j", "p", "r", "v", "w", "y", "z", // the rest of the single letters
  "ch", "sh", "ny", "ng", "ng'", "dh", "gh", "kh", "th", // digraph sounds
] as const;

// Every word is spelled only from syllables/vowels taught above (enforced by tests).
const WORDS: { text: string; syllables: string[]; gloss: string }[] = [
  { text: "baba", syllables: ["ba", "ba"], gloss: "father" },
  { text: "mama", syllables: ["ma", "ma"], gloss: "mother" },
  { text: "kaka", syllables: ["ka", "ka"], gloss: "brother" },
  { text: "dada", syllables: ["da", "da"], gloss: "sister" },
  { text: "kuku", syllables: ["ku", "ku"], gloss: "chicken" },
  { text: "sasa", syllables: ["sa", "sa"], gloss: "now" },
  { text: "leo", syllables: ["le", "o"], gloss: "today" },
  { text: "nini", syllables: ["ni", "ni"], gloss: "what" },
  { text: "mimi", syllables: ["mi", "mi"], gloss: "me" },
  { text: "kula", syllables: ["ku", "la"], gloss: "to eat" },
  { text: "lala", syllables: ["la", "la"], gloss: "to sleep" },
  { text: "soma", syllables: ["so", "ma"], gloss: "to read" },
  { text: "somo", syllables: ["so", "mo"], gloss: "lesson" },
  { text: "bado", syllables: ["ba", "do"], gloss: "not yet" },
  { text: "sita", syllables: ["si", "ta"], gloss: "six" },
  { text: "saba", syllables: ["sa", "ba"], gloss: "seven" },
  { text: "nane", syllables: ["na", "ne"], gloss: "eight" },
  { text: "tano", syllables: ["ta", "no"], gloss: "five" },
  { text: "kumi", syllables: ["ku", "mi"], gloss: "ten" },
  { text: "mali", syllables: ["ma", "li"], gloss: "goods, wealth" },
];

const audioFor = (id: string) => `/audio/reading/${id}.mp3`;

function build(): ReadingItem[] {
  type Draft = Omit<ReadingItem, "step">;
  const drafts: Draft[] = [];
  const idOf = (unit: string) => (unit.length === 1 && (VOWELS as readonly string[]).includes(unit) ? `v-${unit}` : `s-${unit}`);

  for (const v of VOWELS) {
    drafts.push({ id: `v-${v}`, kind: "vowel", text: v, syllables: [v], requires: [], audio: audioFor(`v-${v}`) });
  }

  // A word is placed right after the last syllable it needs.
  const positionOfUnit = new Map<string, number>();
  const pendingWords = [...WORDS];
  const flushWords = () => {
    for (let i = pendingWords.length - 1; i >= 0; i--) {
      const w = pendingWords[i];
      if (w.syllables.every((s) => positionOfUnit.has(s))) {
        const id = `w-${w.text}`;
        drafts.push({ id, kind: "word", text: w.text, syllables: w.syllables, requires: w.syllables.map(idOf), gloss: w.gloss, audio: audioFor(id) });
        pendingWords.splice(i, 1);
      }
    }
  };

  for (const v of VOWELS) positionOfUnit.set(v, drafts.length);
  for (const c of CONSONANTS) {
    for (const v of VOWELS) {
      const unit = `${c}${v}`;
      const id = `s-${unit}`;
      drafts.push({ id, kind: "syllable", text: unit, syllables: [unit], requires: [], audio: audioFor(id) });
      positionOfUnit.set(unit, drafts.length);
    }
    // Words that just became readable, kept in the order they appear in WORDS.
    const before = drafts.length;
    flushWords();
    const added = drafts.splice(before);
    added.sort((x, y) => WORDS.findIndex((w) => `w-${w.text}` === x.id) - WORDS.findIndex((w) => `w-${w.text}` === y.id));
    drafts.push(...added);
  }
  if (pendingWords.length) {
    throw new Error(`Reading curriculum: words use untaught syllables: ${pendingWords.map((w) => w.text).join(", ")}`);
  }
  return drafts.map((d, step) => ({ ...d, step }));
}

export const READING_ITEMS: ReadingItem[] = build();

const BY_ID = new Map(READING_ITEMS.map((i) => [i.id, i]));
export const getItem = (id: string): ReadingItem | undefined => BY_ID.get(id);
export const isKnownItemId = (id: string): boolean => BY_ID.has(id);

// ── Before/after check forms ─────────────────────────────────────────────────
// Two matched sets of 10 so a later check measures reading, not memory of the
// baseline items. Form A = baseline, form B = checkpoints. Each is ordered
// EASIEST FIRST (vowels, then syllables, then words) because a check stops after
// a run of misses (see DISCONTINUE_AFTER in conductor.ts), so a child who cannot
// read yet is not made to attempt hard items. ⚠ PROPOSAL: a Swahili teacher
// should confirm the two forms are of equal difficulty.
export const CHECK_FORMS = {
  A: ["v-a", "v-o", "s-ba", "s-mo", "s-ti", "s-ke", "w-mama", "w-kuku", "w-soma", "w-sita"],
  B: ["v-e", "v-u", "s-bi", "s-mu", "s-te", "s-ko", "w-baba", "w-kula", "w-mimi", "w-tano"],
} as const;
