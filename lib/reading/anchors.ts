// "Anchor" words for the five vowels: a simple, concrete, high-frequency Swahili
// word a child likely already knows, that starts with the vowel being taught —
// so the sound is shown doing real work in a real word, not just in isolation.
//
// ⚠ PROPOSAL: picked by the developer, not a native speaker. 4 of 5 reuse an
// existing vocabulary concept (with its already-curated emoji); Swahili has no
// common simple word starting with a bare "o", so that one is a fresh pick.
// Please correct any of these — they are just a lookup table, trivial to change,
// and nothing else in the curriculum depends on the exact word chosen.
export interface Anchor { word: string; emoji: string; gloss: string }

export const VOWEL_ANCHORS: Record<string, Anchor> = {
  a: { word: "asali", emoji: "🍯", gloss: "honey" },
  e: { word: "embe", emoji: "🥭", gloss: "mango" },
  i: { word: "ini", emoji: "🫀", gloss: "liver (a part inside the body)" },
  o: { word: "oga", emoji: "🛁", gloss: "to bathe" },
  u: { word: "uji", emoji: "🥣", gloss: "porridge" },
};

export const anchorFor = (itemId: string): Anchor | null => {
  const vowel = itemId.startsWith("v-") ? itemId.slice(2) : null;
  return vowel ? VOWEL_ANCHORS[vowel] ?? null : null;
};
