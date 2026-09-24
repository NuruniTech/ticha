// The text the APP sends to Ticha. English directions; Ticha answers the child in
// Swahili (see prompt.ts). Kept as pure functions so they can be tested and so
// the wording lives in one place.
//
// The lesson is shaped like a real tutoring session: welcome, a little game to
// see what the child knows, remembering, learning new things, practising them
// together, and a goodbye that names what was learned.

import { getItem } from "./curriculum";
import { isCheckStep, isGuided, type Step, type StepKind } from "./conductor";
import type { Advance } from "./conductor";
import type { AttemptOutcome } from "./mastery";

const kindLabel = (kind: string) => (kind === "vowel" ? "letter" : kind);
const spoken = (itemId: string) => getItem(itemId)!.syllables.join("-");

// Used if a lesson somehow has nothing left to practise, so it ends kindly instead of hanging.
export const nothingLeftInstruction =
  "[APP] There is nothing more to practise today. In TWO short Swahili sentences, praise the child for their work and say goodbye, including the word \"tutaonana\".";

export const greetingInstruction = (childName: string) =>
  `[APP] Greet ${childName} warmly by name in ONE short, happy Swahili sentence and say you are Ticha and you are so glad to see them. Do NOT mention lessons or reading yet: you are just meeting a friend. Nothing else. Then stay silent until the next [APP] message.`;

// One spoken sentence that introduces each new part of the lesson.
const PHASE_INTRO: Record<StepKind, string> = {
  baseline:   "tell the child you will first play a little game to see what they already know, and that it is fine not to know some",
  checkpoint: "tell the child you will first play a little game to see how much they have learned, and that it is fine not to know some",
  review:     "tell the child you will now remember things they learned before",
  teach:      "react with excitement to whatever the child just said, then tell them you will now meet a new magic sound together",
  mixed:      "tell the child you will now practise everything together",
};

// Swahili sounds, spelled out for the model.
//
// Handing the model a bare letter ("e") makes it read the ENGLISH letter name — which
// is "ee", the sound of Swahili "i". So instead of letters we give it RESPELLINGS it
// reads correctly: "meh", "bah", "soh-mah". Vowels: a "ah", e "eh", i "ee", o "oh", u "oo".
export const VOWEL_RESPELL: Record<string, string> = { a: "ah", e: "eh", i: "ee", o: "oh", u: "oo" };
export const VOWEL_SOUND: Record<string, string> = {
  a: '"ah", as in Swahili "baba"',
  e: '"eh", as in Swahili "pesa" (short, like the "e" in English "bed")',
  i: '"ee", as in Swahili "kiti"',
  o: '"oh", as in Swahili "moja" (short and round)',
  u: '"oo", as in Swahili "kuku"',
};
export const SOUNDS_NOT_NAMES = "Use the Swahili SOUND of each letter, never the English letter name (not \"bee\", \"ay\", \"see\", \"ee\" for e).";

/** "ba" -> "bah", "me" -> "meh", "a" -> "ah" */
export function respellUnit(unit: string): string {
  const vowel = unit.slice(-1);
  return `${unit.slice(0, -1)}${VOWEL_RESPELL[vowel] ?? vowel}`;
}
/** "soma" -> "soh-mah" */
export const respellItem = (itemId: string): string => getItem(itemId)!.syllables.map(respellUnit).join("-");

function pronunciationNote(itemId: string): string {
  const item = getItem(itemId)!;
  const vowels = [...new Set(item.text.split("").filter((c) => VOWEL_SOUND[c]))];
  return `${SOUNDS_NOT_NAMES} Say it exactly as respelled here: "${respellItem(itemId)}". ${vowels.map((v) => `The vowel "${v}" is ${VOWEL_SOUND[v]}.`).join(" ")} `;
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
  const tail = "Then stay silent and listen. Do NOT teach anything. Do NOT call report_attempt.";
  return [
    `[APP] In ONE short, friendly Swahili sentence ask the child how they are feeling today. ${tail}`,
    `[APP] React to what the child just said in ONE warm sentence, so they know you really heard them (you may laugh a little). Then ask ONE simple, fun question: ${q}. ${tail}`,
    `[APP] React to their answer with real delight (for example make the animal's sound, or say something playful about it). Then say in ONE or TWO short sentences that today the two of you will play with magic sounds, and ask if they are ready. ${tail}`,
  ];
}

// Ideas for the little games, so each one is different.
const PLAY_IDEAS = [
  "say the sound in a tiny mouse voice, then in a big lion voice, and ask the child to copy you each time",
  "say the sound very slowly like a snail, then very fast like a rabbit, and ask the child to copy you",
  "whisper the sound like a secret, then say it out loud, and ask the child to copy you",
  "clap once as you say the sound, and ask the child to clap and say it with you",
];

// Should the recorded sound play before this attempt?
export function shouldPlayClip(step: Step, isRetry: boolean): boolean {
  if (isCheckStep(step)) return false;   // a check must not give the answer away
  if (isGuided(step)) return true;       // modelling, saying together, playing: always play it
  return isRetry;                        // alone / review / mixed: only as help after a miss
}

// The separate sounds of an item, for blending ("m" + "meh" -> "meh").
function blendingLine(itemId: string): string {
  const item = getItem(itemId)!;
  if (item.kind === "vowel") {
    return `Say the sound "${respellUnit(item.text)}" once, slowly, exactly as respelled here (it is the Swahili vowel "${item.text}"). ${pronunciationNote(itemId)}`;
  }
  if (item.kind === "syllable") {
    const consonant = item.text.slice(0, -1);
    const vowel = item.text.slice(-1);
    return `Say its sounds slowly, one at a time ("${consonant}", then "${VOWEL_RESPELL[vowel]}"), and then the whole syllable, respelled here as "${respellItem(itemId)}". ${pronunciationNote(itemId)}`;
  }
  return `Say each syllable slowly, one at a time (${item.syllables.map((s) => `"${respellUnit(s)}"`).join(", ")}), and then the whole word, respelled here as "${respellItem(itemId)}". ${pronunciationNote(itemId)}`;
}

export function promptInstruction(step: Step, opts: { isRetry: boolean; clipPlayed: boolean; clipExpected: boolean }, rng: () => number = Math.random): string {
  const item = getItem(step.itemId)!;
  const what = `${kindLabel(item.kind)} "${item.text}"`;
  const head = `[APP] The child now sees the ${what} on the screen. Do these in order:`;
  const listen = "Then stay completely silent and listen. When the child answers, call report_attempt with exactly what you heard.";

  const todo: string[] = [];
  if (step.phaseStart && !opts.isRetry) todo.push(`In ONE short Swahili sentence, ${PHASE_INTRO[step.kind]}.`);
  if (!isCheckStep(step) && opts.clipExpected && !opts.clipPlayed) {
    todo.push(`Say the sound "${respellItem(step.itemId)}" clearly yourself, once. ${pronunciationNote(step.itemId)}`);
  }

  // "I do": Ticha models the item. Not scored, and the child is not asked to answer yet.
  if (step.stage === "model") {
    todo.push(`The correct sound has just been played. In ONE short Swahili sentence say this is the ${kindLabel(item.kind)} "${item.text}".`);
    todo.push(blendingLine(step.itemId));
    return `${head} ${todo.map((t, i) => `${i + 1}) ${t}`).join(" ")} Then stop and stay silent. Do NOT ask the child to say it yet. Do NOT call report_attempt.`;
  }

  // "We do": child and Ticha say it together. Not scored.
  if (step.stage === "together") {
    todo.push("The correct sound has just been played again. In ONE short Swahili sentence invite the child to say it together with you.");
    todo.push(`Say it yourself once, slowly, then stay silent while the child says it. ${pronunciationNote(step.itemId)}`);
    return `${head} ${todo.map((t, i) => `${i + 1}) ${t}`).join(" ")} After the child speaks, reply with ONE short, warm word of praise (for example: Vizuri!). Do NOT call report_attempt for this step.`;
  }

  // A little game with the sound. Not scored: playing with it is also practice.
  if (step.stage === "play") {
    todo.push(`Start a tiny playful game with the sound "${respellItem(step.itemId)}" (in ONE or TWO short, excited Swahili sentences): ${pick(PLAY_IDEAS, rng)}. ${pronunciationNote(step.itemId)}`);
    todo.push("Then stay silent and let the child join in.");
    return `${head} ${todo.map((t, i) => `${i + 1}) ${t}`).join(" ")} After they join in, react with delight in ONE short sentence. Do NOT call report_attempt.`;
  }

  if (isCheckStep(step)) {
    todo.push("In ONE short Swahili sentence ask them to read it out loud. Do NOT say it or hint at it.");
  } else if (opts.isRetry) {
    todo.push("In ONE short Swahili sentence ask them to try once more (the correct sound has just been played again).");
  } else if (step.kind === "teach") {
    // "You do": the child alone.
    todo.push("In ONE short Swahili sentence tell them it is now their turn to say it alone.");
  } else {
    todo.push("In ONE short Swahili sentence ask them to read it out loud.");
  }
  return `${head} ${todo.map((t, i) => `${i + 1}) ${t}`).join(" ")} ${listen}`;
}

export function feedbackInstruction(step: Step, outcome: AttemptOutcome, advance: Advance, learned: string[] = [], rng: () => number = Math.random): string {
  if (advance.action === "end") {
    const list = learned.length ? ` Mention what they practised today: ${learned.join(", ")}.` : "";
    return `[APP] The lesson is over.${list} In TWO short Swahili sentences, praise the child for their work today and say goodbye, including the word "tutaonana".`;
  }
  if (isCheckStep(step)) {
    if (advance.action === "next" && advance.discontinued) {
      return "[APP] In ONE short Swahili sentence, warmly thank the child and say this little game is finished and they did well. Do NOT say whether anything was right or wrong. Nothing else.";
    }
    return "[APP] Say only a brief, neutral thank-you in Swahili (for example: Asante!). Do NOT say whether it was right or wrong. Nothing else.";
  }
  if (advance.action === "retry") {
    return outcome === "unscored"
      ? "[APP] You could not hear the child clearly. In ONE short Swahili sentence say you did not quite hear, and that you will listen again. Nothing else."
      : "[APP] The child's answer did not match. In ONE short, kind Swahili sentence say it is okay and that you will listen to the sound again together. Do NOT say the answer. Nothing else.";
  }
  if (advance.movedOn) {
    return "[APP] In ONE short Swahili sentence say it is okay and that you will practise this one again another day. Nothing else.";
  }
  return `[APP] The child said it correctly. In ONE short Swahili sentence praise them warmly and sound genuinely delighted, not scripted (for example: ${pick(PRAISES, rng)}). Nothing else yet.`;
}
