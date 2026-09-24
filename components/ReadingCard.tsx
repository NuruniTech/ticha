"use client";

import type { ReadingCard as Card } from "@/hooks/useReadingLesson";

// The big letter / syllable / word the child is reading. Syllables of a word are
// shown in alternating colours because Kiswahili is read syllable by syllable.
// Tapping replays the recorded sound — practice only, and hidden during checks.

const COLORS = ["#F97316", "#4B8BF5"];

export default function ReadingCard({ card, onReplay }: { card: Card; onReplay: () => void }) {
  const { item, index, total, canReplay } = card;
  return (
    <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <button
        onClick={canReplay ? onReplay : undefined}
        aria-label={canReplay ? "Hear it again" : undefined}
        style={{
          width: "100%", minHeight: 120, borderRadius: 24, border: "3px solid #FDE68A",
          background: "#FFFBEB", cursor: canReplay ? "pointer" : "default",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          boxShadow: "0 6px 0 #FCD34D", padding: "8px 12px",
        }}
      >
        {item.syllables.map((s, i) => (
          <span
            key={i}
            style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: item.kind === "word" ? 52 : 72, color: COLORS[i % COLORS.length], lineHeight: 1 }}
          >
            {s}
          </span>
        ))}
        {canReplay && <span style={{ fontSize: 22, marginLeft: 8 }} aria-hidden>🔊</span>}
      </button>
      <div style={{ display: "flex", gap: 5 }} aria-label={`Step ${index + 1} of ${total}`}>
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: i < index ? "#22C55E" : i === index ? "#F59E0B" : "#E5E7EB" }} />
        ))}
      </div>
    </div>
  );
}
