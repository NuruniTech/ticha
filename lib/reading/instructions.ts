// The text the APP sends to Ticha. English directions; Ticha answers the child in
// Swahili (see prompt.ts). Kept as pure functions so they can be tested and so
// the wording lives in one place.
//
// The lesson is shaped like a real tutoring session: welcome, a little game to
// see what the child knows, remembering, learning new things, practising them
// together, and a goodbye that names what was learned.

import { getItem } from "./curriculum";
import { isCheckStep, type Step, type StepKind } from "./conductor";
import type { Advance } from "./conductor";
import type { AttemptOutcome } from "./mastery";

const kindLabel = (kind: string) => (kind === "vowel" ? "letter" : kind);
const spoken = (itemId: string) => getItem(itemId)!.syllables.join("-");

export const greetingInstruction = (childName: string) =>
  `[APP] Greet ${childName} warmly in ONE short Swahili sentence and say you will learn to read together today. Nothing else. Then stay silent until the next [APP] message.`;

// One spoken sentence that introduces each new part of the lesson.
const PHASE_INTRO: Record<StepKind, string> = {
  baseline:   "tell the child you will first play a little game to see what they already know, and that it is fine not to know some",
  checkpoint: "tell the child you will first play a little game to see how much they have learned, and that it is fine not to know some",
  review:     "tell the child you will now remember things they learned before",
  teach:      "tell the child you will now learn something new together",
  mixed:      "tell the child you will now practise everything together",
};

// Should the recorded sound play before this attempt?
export function shouldPlayClip(step: Step, isRetry: boolean): boolean {
  if (isCheckStep(step)) return false;           // a check must not give the answer away
  if (step.kind === "teach") return true;        // introduce and re-play
  return isRetry;                                // review/mixed: only as help after a miss
}

export function promptInstruction(step: Step, opts: { isRetry: boolean; clipPlayed: boolean; clipExpected: boolean }): string {
  const item = getItem(step.itemId)!;
  const head = `[APP] The child now sees the ${kindLabel(item.kind)} "${item.text}" on the screen. Do these in order:`;
  const listen = "Then stay completely silent and listen. When the child answers, call report_attempt with exactly what you heard.";

  const todo: string[] = [];
  if (step.phaseStart && !opts.isRetry) todo.push(`In ONE short Swahili sentence, ${PHASE_INTRO[step.kind]}.`);
  if (!isCheckStep(step) && opts.clipExpected && !opts.clipPlayed) {
    todo.push(`Say the sound "${spoken(step.itemId)}" clearly yourself, once.`);
  }

  if (isCheckStep(step)) {
    todo.push("In ONE short Swahili sentence ask them to read it out loud. Do NOT say it or hint at it.");
  } else if (opts.isRetry) {
    todo.push("In ONE short Swahili sentence ask them to try once more (the correct sound has just been played again).");
  } else if (step.kind === "teach" && step.first) {
    todo.push(`In ONE short Swahili sentence tell them this is "${item.text}" (the correct sound has just been played) and ask them to say it now.`);
  } else {
    todo.push("In ONE short Swahili sentence ask them to read it out loud.");
  }

  return `${head} ${todo.map((t, i) => `${i + 1}) ${t}`).join(" ")} ${listen}`;
}

export function feedbackInstruction(step: Step, outcome: AttemptOutcome, advance: Advance, learned: string[] = []): string {
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
  return "[APP] The child said it correctly. In ONE short Swahili sentence praise them warmly (for example: Vizuri sana!). Nothing else yet.";
}
