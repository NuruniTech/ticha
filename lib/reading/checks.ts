// Decides whether a child is due a before/after check at the start of a lesson,
// scoped to the category they are working on.

import { CHECK_FORMS, READING_ITEMS, getItem } from "./curriculum";
import { countServerSessions } from "./validate";
import type { ReadingCategory } from "./categories";

export interface StoredRow { item_id: string; outcome: string; phase: string; created_at: string }

export interface CheckDue { phase: "baseline" | "checkpoint"; items: string[] }

export const CHECK_EVERY_N_SESSIONS = 5;

// Baseline once (resumable if a sitting stopped part-way), then checkpoint every
// N practice sessions using formB (a part-finished round is resumed, not restarted).
function decideCheckWithForms(rows: StoredRow[], formA: string[], formB: string[]): CheckDue | null {
  const practice = rows.filter((r) => r.phase === "practice");

  if (practice.length === 0) {
    const done = new Set(rows.filter((r) => r.phase === "baseline").map((r) => r.item_id));
    const remaining = formA.filter((id) => !done.has(id));
    return remaining.length > 0 ? { phase: "baseline", items: [...remaining] } : null;
  }

  const formSize = formB.length;
  const checkpointRows = rows
    .filter((r) => r.phase === "checkpoint")
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const completedRounds = Math.floor(checkpointRows.length / formSize);
  const partial = checkpointRows.slice(completedRounds * formSize).map((r) => r.item_id);
  if (partial.length > 0) {
    return { phase: "checkpoint", items: formB.filter((id) => !partial.includes(id)) };
  }
  const sessions = countServerSessions(practice);
  return sessions >= CHECK_EVERY_N_SESSIONS * (completedRounds + 1)
    ? { phase: "checkpoint", items: [...formB] }
    : null;
}

// Vowels: only 5 items total, so the same complete set is used before and after —
// there is no larger pool to sample a different-but-equal form from.
const VOWEL_CHECK_ITEMS = READING_ITEMS.filter((i) => i.kind === "vowel").map((i) => i.id);
// Consonants: reuse the curated syllable/word check items, with the 2 vowel
// entries each form had (back when one check spanned every kind) dropped, since
// vowels are a separate category now and already proven mastered to get here.
const CONSONANT_FORM_A = CHECK_FORMS.A.filter((id) => getItem(id)!.kind !== "vowel");
const CONSONANT_FORM_B = CHECK_FORMS.B.filter((id) => getItem(id)!.kind !== "vowel");

export function decideCheckForCategory(category: ReadingCategory, rows: StoredRow[]): CheckDue | null {
  return category === "vowels"
    ? decideCheckWithForms(rows, VOWEL_CHECK_ITEMS, VOWEL_CHECK_ITEMS)
    : decideCheckWithForms(rows, CONSONANT_FORM_A, CONSONANT_FORM_B);
}
