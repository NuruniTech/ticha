// The text the APP sends to Ticha. English directions; Ticha answers the child in
// Swahili (see prompt.ts). Kept as pure functions so they can be tested and so
// the wording lives in one place.

import { getItem } from "./curriculum";
import { isCheckStep, type Step } from "./conductor";
import type { Advance } from "./conductor";
import type { AttemptOutcome } from "./mastery";

const kindLabel = (kind: string) => (kind === "vowel" ? "letter" : kind);
const spoken = (itemId: string) => getItem(itemId)!.syllables.join("-");

export const greetingInstruction = (childName: string) =>
  `[APP] Greet ${childName} warmly in ONE short Swahili sentence and say you will learn to read together today. Nothing else. Then stay silent until the next [APP] message.`;

// Should the recorded sound play before this attempt?
export function shouldPlayClip(step: Step, isRetry: boolean): boolean {
  if (isCheckStep(step)) return false;           // a check must not give the answer away
  if (step.kind === "teach") return true;        // introduce and re-play
  return isRetry;                                // review/mixed: only as help after a miss
}

export function promptInstruction(step: Step, opts: { isRetry: boolean; clipPlayed: boolean; clipExpected: boolean }): string {
  const item = getItem(step.itemId)!;
  const what = `${kindLabel(item.kind)} "${item.text}"`;
  const base = `[APP] The child now sees the ${what} on the screen.`;
  const listen = "Then stay completely silent and listen. When the child answers, call report_attempt.";

  if (isCheckStep(step)) {
    return `${base} In ONE short Swahili sentence ask them to read it out loud. Do NOT say it or hint at it. ${listen}`;
  }
  const noClip = opts.clipExpected && !opts.clipPlayed
    ? ` No recording is available, so first say the sound "${spoken(step.itemId)}" clearly yourself, once.`
    : "";
  if (opts.isRetry) {
    return `${base}${noClip} The correct sound has just been played again. In ONE short Swahili sentence ask them to try once more. ${listen}`;
  }
  if (step.kind === "teach" && step.first) {
    return `${base}${noClip} The correct sound has just been played. In ONE short Swahili sentence tell them this is "${item.text}" and ask them to say it now. ${listen}`;
  }
  return `${base}${noClip} In ONE short Swahili sentence ask them to read it out loud. ${listen}`;
}

export function feedbackInstruction(step: Step, outcome: AttemptOutcome, advance: Advance): string {
  if (advance.action === "end") {
    return "[APP] The lesson is over. In TWO short Swahili sentences, praise the child for their work today and say goodbye, including the word \"tutaonana\".";
  }
  if (isCheckStep(step)) {
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
