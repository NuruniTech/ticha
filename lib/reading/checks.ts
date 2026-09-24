// Decides whether a child is due a before/after check at the start of a lesson.
// Pure: works from the child's stored attempt rows.

import { CHECK_FORMS } from "./curriculum";
import { countServerSessions } from "./validate";
import type { ReadingTrack } from "./track";

export interface StoredRow { item_id: string; outcome: string; phase: string; created_at: string }

export interface CheckDue { phase: "baseline" | "checkpoint"; items: string[] }

export const CHECK_EVERY_N_SESSIONS = 5;

export function decideCheck(rows: StoredRow[]): CheckDue | null {
  const practice = rows.filter((r) => r.phase === "practice");

  // Baseline: before any teaching. Resumes if an earlier sitting stopped part-way.
  if (practice.length === 0) {
    const done = new Set(rows.filter((r) => r.phase === "baseline").map((r) => r.item_id));
    const remaining = CHECK_FORMS.A.filter((id) => !done.has(id));
    return remaining.length > 0 ? { phase: "baseline", items: [...remaining] } : null;
  }

  // Checkpoint: form B after every N practice sessions (server time). A round is
  // complete at 10 items; a part-finished round is resumed, not restarted.
  const formSize = CHECK_FORMS.B.length;
  const checkpointRows = rows
    .filter((r) => r.phase === "checkpoint")
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const completedRounds = Math.floor(checkpointRows.length / formSize);
  const partial = checkpointRows.slice(completedRounds * formSize).map((r) => r.item_id);
  if (partial.length > 0) {
    return { phase: "checkpoint", items: CHECK_FORMS.B.filter((id) => !partial.includes(id)) };
  }
  const sessions = countServerSessions(practice);
  return sessions >= CHECK_EVERY_N_SESSIONS * (completedRounds + 1)
    ? { phase: "checkpoint", items: [...CHECK_FORMS.B] }
    : null;
}

/** The check for a child on this track. The early track has no formal check. */
export function decideCheckForTrack(track: ReadingTrack, rows: StoredRow[]): CheckDue | null {
  return track === "early" ? null : decideCheck(rows);
}
