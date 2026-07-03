// Calendar-day streak calculation, shared by the server session-save route.
// Exactly 1 calendar day since the last session extends the streak, the same
// day keeps it unchanged, anything older resets it to 1.
export function nextStreak(
  currentStreak: number,
  lastSessionAt: string | null,
  now: Date = new Date(),
): number {
  if (!lastSessionAt) return 1;
  const last = new Date(lastSessionAt);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(last)) / 86400000);
  if (dayDiff === 0) return currentStreak; // already practised today
  if (dayDiff === 1) return currentStreak + 1;
  return 1;
}
