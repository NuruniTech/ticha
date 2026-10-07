// "Anchor" words for the five vowels: a simple, concrete, high-frequency Swahili
// word a child likely already knows, that starts with the vowel being taught —
// so the sound is shown doing real work in a real word, not just in isolation.
// Each gets a real photo (not an emoji — tested with the founder, who felt
// emoji "don't work well for children"), shown large on the lesson screen
// during the "model" stage, swapping with the vowel glyph rather than sitting
// as a small side icon. Images: public/images/reading-anchors/, sourced from
// Pixabay (free, no attribution required) except "inzi", where a real macro
// photo of a fly reads as unsettling up close — a simple cartoon fly is used
// there instead (founder-approved trade-off).
//
// Word choices confirmed with the founder (a fluent Swahili speaker): "ini"
// (liver) was dropped for "i" — a body part with no good image, and its old
// emoji (🫀) was actually a heart, not a liver, which was simply wrong — in
// favour of "inzi" (fly). "oga" (bathe) was dropped for "o" — an action, not
// an object, so nothing to picture — in favour of "ona" (see), paired with a
// photo of an eye. "o" has no good bare-vowel-initial Swahili noun; this is
// the same gap this file's own history already notes.
export interface Anchor { word: string; image: string; gloss: string }

export const VOWEL_ANCHORS: Record<string, Anchor> = {
  a: { word: "asali", image: "/images/reading-anchors/a-asali.webp", gloss: "honey" },
  e: { word: "embe", image: "/images/reading-anchors/e-embe.webp", gloss: "mango" },
  i: { word: "inzi", image: "/images/reading-anchors/i-inzi.webp", gloss: "fly (the insect)" },
  o: { word: "ona", image: "/images/reading-anchors/o-ona.webp", gloss: "to see" },
  u: { word: "uji", image: "/images/reading-anchors/u-uji.webp", gloss: "porridge" },
};

export const anchorFor = (itemId: string): Anchor | null => {
  const vowel = itemId.startsWith("v-") ? itemId.slice(2) : null;
  return vowel ? VOWEL_ANCHORS[vowel] ?? null : null;
};
