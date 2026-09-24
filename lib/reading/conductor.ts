// The lesson conductor: the APP decides what happens next, not the AI.
// Pure state machine — given a plan and a stream of verdicts it says which item
// is on screen, whether to retry, and when the lesson is over.

import type { LessonPlan } from "./lesson";
import type { AttemptOutcome } from "./mastery";

export type StepKind = "baseline" | "checkpoint" | "review" | "teach" | "mixed";

export interface Step {
  itemId: string;
  kind: StepKind;
  first: boolean;      // first appearance of this item in the lesson
  phaseStart: boolean; // first step of a new part of the lesson (welcome the new part aloud)
}

export interface ConductorState {
  steps: Step[];
  index: number;    // current step
  tries: number;    // attempts made on the current step
  unscored: number; // attempts on the current step that could not be judged
  checkMisses: number; // consecutive check items not answered correctly (for the stop rule)
  done: boolean;
}

export const MAX_TRIES = 3;          // one try plus up to two more after a miss
export const MAX_UNSCORED_TRIES = 2; // if we cannot tell twice, move on

// A check stops after this many misses in a row (the standard "discontinue"
// rule in national reading assessments), so a child who cannot read yet is not
// made to attempt items that are clearly too hard.
export const DISCONTINUE_AFTER = 4;

export type Advance =
  | { action: "retry" }
  | { action: "next"; movedOn: boolean; discontinued?: boolean } // movedOn = left without a correct answer
  | { action: "end"; movedOn: boolean; discontinued?: boolean };

export const isCheckStep = (s: Step) => s.kind === "baseline" || s.kind === "checkpoint";

export function buildSteps(opts: { check?: { phase: "baseline" | "checkpoint"; items: string[] }; plan: LessonPlan }): Step[] {
  const steps: Step[] = [];
  const seen = new Set<string>();
  const add = (itemId: string, kind: StepKind) => {
    const phaseStart = steps.length === 0 || steps[steps.length - 1].kind !== kind;
    steps.push({ itemId, kind, first: !seen.has(itemId), phaseStart });
    seen.add(itemId);
  };
  if (opts.check) opts.check.items.forEach((id) => add(id, opts.check!.phase));
  opts.plan.review.forEach((id) => add(id, "review"));
  opts.plan.teach.forEach((id) => add(id, "teach"));
  opts.plan.mixed.forEach((id) => add(id, "mixed"));
  return steps;
}

export function startConductor(steps: Step[]): ConductorState {
  return { steps, index: 0, tries: 0, unscored: 0, checkMisses: 0, done: steps.length === 0 };
}

export const currentStep = (s: ConductorState): Step | null => (s.done ? null : s.steps[s.index] ?? null);

export function applyVerdict(state: ConductorState, outcome: AttemptOutcome): { state: ConductorState; advance: Advance } {
  const step = currentStep(state);
  if (!step) return { state, advance: { action: "end", movedOn: false } };

  const tries = state.tries + 1;
  const unscored = state.unscored + (outcome === "unscored" ? 1 : 0);

  // Checks measure what the child can do unaided: one attempt, no retries, no teaching.
  const leave =
    isCheckStep(step) ||
    outcome === "correct" ||
    tries >= MAX_TRIES ||
    unscored >= MAX_UNSCORED_TRIES;

  if (!leave) return { state: { ...state, tries, unscored }, advance: { action: "retry" } };

  const movedOn = outcome !== "correct" && !isCheckStep(step);

  // Stop rule for checks: too many misses in a row -> skip the rest of the check.
  const checkMisses = isCheckStep(step) ? (outcome === "correct" ? 0 : state.checkMisses + 1) : 0;
  let nextIndex = state.index + 1;
  let discontinued = false;
  if (isCheckStep(step) && checkMisses >= DISCONTINUE_AFTER) {
    while (nextIndex < state.steps.length && isCheckStep(state.steps[nextIndex])) nextIndex++;
    discontinued = nextIndex > state.index + 1;
  }

  const base = { ...state, tries: 0, unscored: 0, checkMisses, index: nextIndex };
  if (nextIndex >= state.steps.length) {
    return { state: { ...base, done: true }, advance: { action: "end", movedOn, ...(discontinued ? { discontinued } : {}) } };
  }
  return { state: base, advance: { action: "next", movedOn, ...(discontinued ? { discontinued } : {}) } };
}
