// One short caption on the learning side that tells the child what to do right now.
// ⚠ Swahili wording is a proposal: a fluent speaker should confirm it reads naturally
// for a small child.

import type { Stage, StepKind } from "./conductor";

export interface CaptionInput { kind: StepKind; stage?: Stage }

const SW = {
  listen: "Sikiliza",
  together: "Semeni pamoja!",
  yourTurn: "Zamu yako!",
  play: "Tucheze!",
  read: "Soma kwa sauti",
} as const;
const EN = {
  listen: "Listen",
  together: "Say it together!",
  yourTurn: "Your turn!",
  play: "Let's play!",
  read: "Read it out loud",
} as const;

export function stageCaption(input: CaptionInput | null, language: string): string {
  const t = language === "sw" ? SW : EN;
  if (!input) return "";
  if (input.kind === "baseline" || input.kind === "checkpoint") return t.read;
  switch (input.stage) {
    case "model": return t.listen;
    case "together": return t.together;
    case "play": return t.play;
    default: return t.yourTurn;
  }
}
