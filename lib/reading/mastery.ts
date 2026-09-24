// Mastery rules for one reading item. Pure functions over a child's attempts.
//
// "Unscored" attempts (the listening could not tell what was said) never count
// for or against the child — they are ignored here entirely.

export type AttemptOutcome = "correct" | "incorrect" | "unscored";

export interface Attempt {
  sessionId: string;
  outcome: AttemptOutcome;
  at: number; // epoch ms
}

export type ItemState = "unseen" | "learning" | "mastered";

// An item is mastered after 3 correct attempts across at least 2 different
// sessions, so a lucky streak inside one sitting does not count. A later miss
// does not undo mastery.
export const MASTERY_CORRECT = 3;
export const MASTERY_SESSIONS = 2;

const scored = (attempts: Attempt[]) => attempts.filter((a) => a.outcome !== "unscored");
export const correctCount = (attempts: Attempt[]) => attempts.filter((a) => a.outcome === "correct").length;

export function isMastered(attempts: Attempt[]): boolean {
  const correct = attempts.filter((a) => a.outcome === "correct");
  return correct.length >= MASTERY_CORRECT && new Set(correct.map((a) => a.sessionId)).size >= MASTERY_SESSIONS;
}

export function itemState(attempts: Attempt[]): ItemState {
  if (scored(attempts).length === 0) return "unseen";
  return isMastered(attempts) ? "mastered" : "learning";
}

export const lastAttemptAt = (attempts: Attempt[]) => attempts.reduce((m, a) => Math.max(m, a.at), 0);
