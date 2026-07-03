// Single source of truth for XP levels.
//
// These thresholds drive BOTH the lesson content (which word batch Ticha
// teaches — see getWordBatch in VoiceSession) and every level display in the
// app (child dashboard, parent dashboard, progress page, milestone alerts).
// They were previously duplicated with different values (50/150/300 vs
// 100/300/500), which showed children a higher level than the lessons used.
//
// Level 1: words 0–4 of each topic · Level 2: words 5–9 ·
// Levels 3–4: random batches from the advanced pool.
export const LEVEL_THRESHOLDS = [0, 100, 300, 500] as const;

export type Level = 1 | 2 | 3 | 4;

export function getLevel(xp: number): Level {
  if (xp < LEVEL_THRESHOLDS[1]) return 1;
  if (xp < LEVEL_THRESHOLDS[2]) return 2;
  if (xp < LEVEL_THRESHOLDS[3]) return 3;
  return 4;
}

// XP needed to reach the next level, or null at max level
export function nextLevelXp(xp: number): number | null {
  const level = getLevel(xp);
  if (level === 4) return null;
  return LEVEL_THRESHOLDS[level];
}

// Progress through the current level, 0–100 (100 at max level)
export function levelProgressPct(xp: number): number {
  const level = getLevel(xp);
  if (level === 4) return 100;
  const lo = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const hi = LEVEL_THRESHOLDS[level];
  return Math.min(100, Math.round(((xp - lo) / (hi - lo)) * 100));
}

// Display metadata per level (indexed by level number)
export const LEVEL_META: Record<Level, { label: string; emoji: string; color: string; bg: string }> = {
  1: { label: "Mwanafunzi", emoji: "🌱", color: "#22C55E", bg: "#F0FDF4" },
  2: { label: "Msomi",      emoji: "⭐", color: "#F59E0B", bg: "#FFFBEB" },
  3: { label: "Hodari",     emoji: "🌟", color: "#8B5CF6", bg: "#F5F3FF" },
  4: { label: "Bingwa",     emoji: "🏆", color: "#EF4444", bg: "#FEF2F2" },
};
