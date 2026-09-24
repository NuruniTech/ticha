// Swahili early-reading curriculum (v1). Pure data — no AI, no I/O.
//
// Kiswahili spelling is regular and read in syllables, so the sequence is:
// vowels -> consonant+vowel syllables -> words built from them.
//
// ⚠ PROPOSAL, NOT FINAL: the consonant order and the word list below were
// chosen by the developer and must be reviewed by a fluent Swahili speaker
// (and ideally checked against the Tanzanian Standard 1 KKK syllabus) before
// children use them. Changing an entry means re-recording its audio.

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
export const CONSONANTS = ["b", "m", "t", "k", "n", "l", "s", "d"] as const;

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
// Two matched sets of 10 (5 syllables + 5 words) so a later check measures
// reading, not memory of the baseline items. Form A = baseline, form B =
// checkpoints. ⚠ PROPOSAL: a Swahili teacher should confirm the two forms are
// of equal difficulty (they were picked to spread across consonants and to use
// words of similar length).
export const CHECK_FORMS = {
  A: ["s-ba", "s-mo", "s-ti", "s-ke", "s-su", "w-mama", "w-kuku", "w-soma", "w-sita", "w-nane"],
  B: ["s-bi", "s-mu", "s-te", "s-ko", "s-si", "w-baba", "w-kula", "w-mimi", "w-tano", "w-lala"],
} as const;
