// ─── Database row types ───────────────────────────────────────────────────────

export interface Profile {
  id: string;           // matches auth.users.id
  email: string;
  full_name: string | null;
  created_at: string;
}

export interface Child {
  id: string;
  parent_id: string;
  name: string;
  age: number | null;
  avatar: string;       // emoji e.g. "🦁"
  primary_language: "sw" | "en";
  xp: number;
  streak: number;
  last_session_at: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  child_id: string;
  game: string;
  language: string;
  duration_seconds: number;
  xp_earned: number;
  words_practiced: string[];   // list of vocabulary words covered
  transcript: TranscriptEntry[];
  created_at: string;
}

export interface Progress {
  id: string;
  child_id: string;
  word: string;
  language: string;
  correct_count: number;
  attempt_count: number;
  last_seen_at: string;
}

// ─── App types ────────────────────────────────────────────────────────────────

export interface TranscriptEntry {
  role: "child" | "ticha";
  text: string;
}

export type GameId = "animals" | "numbers" | "colors" | "body" | "people";
export type LanguageCode = "sw" | "en";

// ─── Accessibility / Settings ─────────────────────────────────────────────────

export type Theme = "default" | "high-contrast" | "colorblind";
export type FontSize = "normal" | "large" | "xlarge";
export type VoiceName = "Aoede" | "Puck" | "Kore" | "Zephyr" | "Charon";

export interface AppSettings {
  theme: Theme;
  fontSize: FontSize;
  voice: VoiceName;
  slowSpeech: boolean;        // Ticha speaks slower
  visualMode: boolean;        // For deaf/hard-of-hearing: text + emoji instead of audio
  highContrast: boolean;
  reduceMotion: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "default",
  fontSize: "normal",
  voice: "Aoede",
  slowSpeech: false,
  visualMode: false,
  highContrast: false,
  reduceMotion: false,
};
