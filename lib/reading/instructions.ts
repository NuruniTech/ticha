// The text the APP sends to Ticha. English directions; Ticha answers the child in
// Swahili (see prompt.ts). Kept as pure functions so they can be tested and so
// the wording lives in one place.
//
// The lesson is shaped like a real tutoring session: welcome, a little game to
// see what the child knows, remembering, learning new things, practising them
// together, and a goodbye that names what was learned.
//
// Kept deliberately SHORT, in plain flowing sentences, not numbered steps. A
// real device log showed Ticha sometimes voicing fragments of her own
// instructions aloud — the more meta-text and bracketed rules a turn carries,
// the more there is to leak. Where a rule is already stated once, standingly,
// in prompt.ts (stay silent until spoken to; call report_attempt only after
// hearing the child), it is not repeated in every single turn here.

import { getItem } from "./curriculum";
import { anchorFor } from "./anchors";
import { isCheckStep, isGuided, type Step, type StepKind } from "./conductor";
import type { Advance } from "./conductor";
import type { AttemptOutcome } from "./mastery";

const kindLabel = (kind: string) => (kind === "vowel" ? "letter" : kind);

// Used if a lesson somehow has nothing left to practise, so it ends kindly instead of hanging.
export const nothingLeftInstruction =
  "[APP] There is nothing more to practise today. In two short Swahili sentences, praise the child for their work and say goodbye, including the word \"tutaonana\".";

export const greetingInstruction = (childName: string) =>
  `[APP] Greet ${childName} warmly by name in one short, happy Swahili sentence — you are Ticha and you are glad to see them. Do not mention lessons or reading yet: you are just meeting a friend. Then stay silent until the next [APP] message.`;

// One spoken sentence that introduces each new part of the lesson.
const PHASE_INTRO: Record<StepKind, string> = {
  baseline:   "tell the child you will first play a little game to see what they already know, and that it is fine not to know some",
  checkpoint: "tell the child you will first play a little game to see how much they have learned, and that it is fine not to know some",
  review:     "tell the child you will now remember things they learned before",
  teach:      'react with excitement to whatever the child just said, then tell them you will now meet a new sound together. Use the exact Swahili words "sauti za kufurahisha" for "fun sounds" — never translate "fun" or "magic" yourself, and never use the word "kichawi" or anything related to witchcraft.',
  mixed:      "tell the child, with excitement, that now you will play everything you learned today all together, like a little celebration",
};

// A chant closes the Vowels category specifically (see promptInstruction): sing
// or chant the five vowels together in order, a-e-i-o-u, so the order becomes a
// little song, not just a list — then the usual celebration line.
const MIXED_VOWEL_CHANT_INTRO =
  "first sing or chant the five vowels together with the child, in order, like a simple little song: a, e, i, o, u. Then, with excitement, tell the child that now you will play everything you learned today all together, like a little celebration";

// Swahili vowel sounds. Ticha already knows Swahili — the real problem is a
// BARE, isolated letter with no surrounding word, where the model can default
// to the ENGLISH LETTER NAME instead of the Swahili sound (English "e" sounds
// like Swahili "i"). The fix is a short, honest reminder anchored to a real
// Swahili word she already knows — NOT a fabricated spelling to read aloud. An
// earlier version asked her to read invented strings ("bah", "soh-mah") letter
// by letter, and that produced words that were neither English nor Swahili.
// Real Swahili spelling is already phonetic; trust it, and just name the sound.
export const VOWEL_SOUND: Record<string, string> = {
  a: '"a" the Swahili way — "ah", as in "baba" — never the English letter name',
  i: '"i" the Swahili way — "ee", as in "kiti" — never the English letter name',
  u: '"u" the Swahili way — "oo", as in "kuku" — never the English letter name',
  e: '"e" the Swahili way — "eh", as in "pesa" — never the English letter name (which is the sound of Swahili "i")',
  o: '"o" the Swahili way — "oh", as in "moja" — never the English letter name',
};

// A short parenthetical reminder for whichever vowels appear in this item —
// omitted entirely when there is nothing to clarify.
function pronunciationNote(itemId: string): string {
  const item = getItem(itemId)!;
  const vowels = [...new Set(item.text.split("").filter((c) => VOWEL_SOUND[c]))];
  if (vowels.length === 0) return "";
  return ` (Say ${vowels.map((v) => VOWEL_SOUND[v]).join(", and ")}.)`;
}

// Variety, so praise sounds like a person and not a script.
export const PRAISES = ["Vizuri sana!", "Hongera!", "Safi kabisa!", "Umefanya vizuri!", "Ndiyo, ni sahihi!", "Vizuri kabisa, mwerevu wangu!"];
const pick = <T,>(list: readonly T[], rng: () => number = Math.random) => list[Math.floor(rng() * list.length)];

// A real back-and-forth before any learning, so the lesson does not open like a test.
// Each message is sent after the child has answered the one before; Ticha reacts to
// what they actually said.
const FUN_QUESTIONS = ["what their favourite animal is", "what yummy thing they ate today", "what colour they like best"];
export const WARMUP_TURNS = 3;
export function warmupInstructions(rng: () => number = Math.random): string[] {
  const q = pick(FUN_QUESTIONS, rng);
  return [
    "[APP] In one short, friendly Swahili sentence, ask the child how they are feeling today. Then listen — this is just a chat, not a lesson yet.",
    `[APP] React warmly to what they just said, so they know you heard them. Then ask one simple, fun question: ${q}. Then listen.`,
    '[APP] React to their answer with real delight. Then say, in one or two short sentences, that today the two of you will play with "sauti za kufurahisha" (say these exact Swahili words for "fun sounds" — never translate "fun" or "magic" yourself, and never say "kichawi" or anything about witchcraft), and ask if they are ready. Then listen.',
  ];
}

// Ideas for the little games, so each one is different.
const PLAY_IDEAS = [
  "say it in a tiny mouse voice, then a big lion voice, and ask the child to copy you each time",
  "say it very slowly like a snail, then very fast like a rabbit, and ask the child to copy you",
  "whisper it like a secret, then say it out loud, and ask the child to copy you",
  "clap once as you say it, and ask the child to clap and say it with you",
];

// Should the recorded sound play before this attempt?
export function shouldPlayClip(step: Step, isRetry: boolean): boolean {
  if (isCheckStep(step)) return false;   // a check must not give the answer away
  if (isGuided(step)) return true;       // modelling, saying together, playing: always play it
  return isRetry;                        // alone / review / mixed: only as help after a miss
}

// How to say an item aloud, blending its parts — real Swahili spelling throughout.
function blendingLine(itemId: string): string {
  const item = getItem(itemId)!;
  if (item.kind === "vowel") return `Say the vowel "${item.text}" once, slowly.${pronunciationNote(itemId)}`;
  if (item.kind === "syllable") return `Say its two sounds slowly, then blend them into "${item.text}".${pronunciationNote(itemId)}`;
  return `Say each part slowly (${item.syllables.join(", ")}), then the whole word "${item.text}".${pronunciationNote(itemId)}`;
}

export function promptInstruction(step: Step, opts: { isRetry: boolean; clipPlayed: boolean; clipExpected: boolean }, rng: () => number = Math.random): string {
  const item = getItem(step.itemId)!;
  const what = `${kindLabel(item.kind)} "${item.text}"`;
  // Every item in an all-vowels lesson is kind "vowel" by construction (the
  // Vowels category contains nothing else — see categories.ts), so the current
  // item alone is enough to tell whether this mixed round is vowels-only,
  // without threading the category through every call site.
  const phaseText = step.kind === "mixed" && item.kind === "vowel" ? MIXED_VOWEL_CHANT_INTRO : PHASE_INTRO[step.kind];
  const intro = step.phaseStart && !opts.isRetry ? `First, in one short Swahili sentence, ${phaseText}. ` : "";
  const playClip = !isCheckStep(step) && opts.clipExpected && !opts.clipPlayed
    ? `Say "${item.text}" clearly yourself, once.${pronunciationNote(step.itemId)} `
    : "";
  const head = `[APP] ${intro}${playClip}The child now sees the ${what}.`;

  if (step.stage === "model") {
    const anchor = anchorFor(step.itemId);
    // "Anchor with a word": show the vowel doing real work in a word the child
    // already knows, not just said in isolation.
    const anchorLine = anchor ? ` For example, it is the first sound in "${anchor.word}".` : "";
    return `${head} In one short Swahili sentence, say this is "${item.text}".${anchorLine} ${blendingLine(step.itemId)} Then stop and stay silent — do not ask them to answer yet.`;
  }
  if (step.stage === "together") {
    return `${head} In one short Swahili sentence, invite them to say it with you, then say it yourself once, slowly.${pronunciationNote(step.itemId)} After they join in, give one short, warm word of praise.`;
  }
  if (step.stage === "play") {
    return `${head} Start a quick, playful moment with "${item.text}": ${pick(PLAY_IDEAS, rng)}.${pronunciationNote(step.itemId)} Then let them join in and react with delight.`;
  }

  const ask = isCheckStep(step)
    ? "ask them to read it out loud — do not say it or hint at it"
    : opts.isRetry
    ? "ask them to try once more"
    : step.kind === "teach"
    ? "tell them it is their turn to say it alone"
    : "ask them to read it out loud";
  return `${head} In one short Swahili sentence, ${ask}. Then listen.`;
}

export function feedbackInstruction(step: Step, outcome: AttemptOutcome, advance: Advance, learned: string[] = [], rng: () => number = Math.random): string {
  if (advance.action === "end") {
    const list = learned.length
      ? ` Name these specific sounds they learned today and say you are proud of them for each one: ${learned.join(", ")}.`
      : " Say you are proud of them for practising today.";
    return `[APP] The lesson is over.${list} In two or three short Swahili sentences, be warm and specific about what they did well, then say goodbye, including the word "tutaonana".`;
  }
  if (isCheckStep(step)) {
    if (advance.action === "next" && advance.discontinued) {
      return "[APP] In one short Swahili sentence, warmly thank the child and say this little game is finished and they did well. Do not say whether anything was right or wrong.";
    }
    return "[APP] Say only a brief, neutral thank-you in Swahili (for example: Asante!). Do not say whether it was right or wrong.";
  }
  if (advance.action === "retry") {
    return outcome === "unscored"
      ? "[APP] You could not hear the child clearly. In one short Swahili sentence, say you did not quite hear, and that you will listen again."
      : "[APP] The child's answer did not match. In one short, kind Swahili sentence, say it is okay and you will listen to the sound again together. Do not say the answer.";
  }
  if (advance.movedOn) {
    return "[APP] In one short Swahili sentence, say it is okay and you will practise this one again another day.";
  }
  return `[APP] The child said it correctly. In one short Swahili sentence, praise them warmly and sound genuinely delighted, not scripted (for example: ${pick(PRAISES, rng)}).`;
}
