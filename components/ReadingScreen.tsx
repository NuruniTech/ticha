"use client";

import { useSyncExternalStore, type RefObject } from "react";
import TichaAvatar, { type AvatarState } from "./TichaAvatar";
import type { ReadingCard } from "@/hooks/useReadingLesson";
import { stageCaption } from "@/lib/reading/captions";
import { friendFor } from "@/lib/reading/friends";
import { getItem } from "@/lib/reading/curriculum";

// The reading lesson screen. Ticha sits on one side; whatever she is teaching
// appears large on the other. Wide screens (tablet / laptop) get two columns;
// phones stack them. For small children the reward is visible and immediate
// (Ticha cheering, a star burst, a sticker for Ticha's sound book), not a progress
// bar — real progress numbers belong on the parent page.

const WIDE = "(min-width: 900px) and (min-aspect-ratio: 5/4)";
function subscribe(cb: () => void) {
  const m = window.matchMedia(WIDE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
const useWide = () => useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches, () => false);

const GLYPH_COLORS = ["#F97316", "#4B8BF5"];

export interface ReadingScreenProps {
  language: string;
  side: "left" | "right";
  card: ReadingCard | null;
  collected: string[];
  celebrateKey: number;
  onReplay: () => void;
  avatarState: AvatarState;
  analyser: AnalyserNode | null;
  ringColor: string;
  statusText: string;
  labelText: string;
  hintText: string;
  listening: boolean; // the child's turn to speak
  isPaused: boolean;
  isCameraOn: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  labels: { pause: string; resume: string; end: string };
  onPause: () => void;
  onCamera: () => void;
  onEnd: () => void;
}

export default function ReadingScreen(p: ReadingScreenProps) {
  const wide = useWide();
  const caption = stageCaption(p.card ? { kind: p.card.kind, stage: p.card.stage } : null, p.language);
  const stage = p.card?.stage;
  const glyphSize = p.card?.item.kind === "word" ? (wide ? 96 : 64) : wide ? 150 : 96;
  const circle = wide ? 300 : 190;

  return (
    <div className="rs-root" data-side={p.side}>
      {/* ── Ticha's side ── */}
      <section className="rs-ticha">
        <div style={{ background: "white", borderRadius: 9999, padding: "9px 24px", boxShadow: "0 3px 16px rgba(0,0,0,0.12)", fontWeight: 800, fontSize: 14, color: "#374151" }}>
          {p.statusText}
        </div>

        <div style={{ position: "relative" }}>
          {!p.isPaused && (p.listening || p.avatarState === "talking") && (
            <>
              <div className="rs-ring" style={{ width: circle + 36, height: circle + 36, background: p.ringColor }} />
              <div className="rs-ring" style={{ width: circle + 18, height: circle + 18, background: p.ringColor }} />
            </>
          )}
          <div className="avatar-circle" style={{ width: circle, height: circle, border: `5px solid ${p.ringColor}`, boxShadow: "0 6px 32px rgba(0,0,0,0.14)" }}>
            <TichaAvatar state={p.avatarState} size={Math.round(circle * 0.86)} analyser={p.analyser} />
          </div>
          {p.isCameraOn && (
            <div style={{ position: "absolute", bottom: 8, right: -8, borderRadius: 10, overflow: "hidden", border: "3px solid #22C55E", zIndex: 2 }}>
              <video ref={p.videoRef} autoPlay playsInline muted style={{ width: 72, height: 54, objectFit: "cover", display: "block" }} />
            </div>
          )}
        </div>

        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: "0.05em", color: p.isPaused ? "#6B7280" : p.avatarState === "talking" ? "#4338CA" : p.listening ? "#15803D" : "#6B7280" }}>
          {p.labelText}
        </p>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#374151", textAlign: "center", maxWidth: 320 }}>{p.hintText}</p>

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
          <button onClick={p.onPause} className="btn-control" style={{ padding: "10px 20px", borderRadius: 16, border: `2.5px solid ${p.isPaused ? "#F59E0B" : "#E5E7EB"}`, background: p.isPaused ? "#FFFBEB" : "white", fontSize: 14, fontWeight: 800, color: p.isPaused ? "#D97706" : "#6B7280", cursor: "pointer", fontFamily: "'Baloo 2', cursive", boxShadow: p.isPaused ? "0 4px 0 #D97706" : "0 4px 0 #D1D5DB" }}>
            {p.isPaused ? p.labels.resume : p.labels.pause}
          </button>
          <button onClick={p.onCamera} className="btn-control" title="Show Ticha what you see" aria-label="Camera" style={{ padding: "10px 14px", borderRadius: 16, border: `2.5px solid ${p.isCameraOn ? "#22C55E" : "#E5E7EB"}`, background: p.isCameraOn ? "#F0FDF4" : "white", color: p.isCameraOn ? "#16A34A" : "#6B7280", cursor: "pointer", boxShadow: p.isCameraOn ? "0 4px 0 #16A34A" : "0 4px 0 #D1D5DB", display: "flex", alignItems: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
          </button>
          <button onClick={p.onEnd} className="btn-control" style={{ padding: "10px 20px", borderRadius: 16, border: "2.5px solid #FCA5A5", background: "#FFF1F2", fontSize: 14, fontWeight: 800, color: "#EF4444", cursor: "pointer", fontFamily: "'Baloo 2', cursive", boxShadow: "0 4px 0 #FCA5A5" }}>
            {p.labels.end}
          </button>
        </div>
      </section>

      {/* ── The lesson side ── */}
      <section className="rs-stage" aria-live="polite">
        {caption && <h2 className="rs-caption">{caption}</h2>}

        {p.card && (
          <div style={{ position: "relative", width: "100%", maxWidth: 520 }}>
            <button
              className={`rs-card ${stage === "play" ? "rs-bounce" : ""}`}
              data-tap={p.card.canReplay}
              onClick={p.card.canReplay ? p.onReplay : undefined}
              aria-label={p.card.canReplay ? "Hear it again" : undefined}
            >
              {p.card.item.syllables.map((s, i) => (
                <span key={i} className="rs-glyph" style={{ fontSize: glyphSize, color: GLYPH_COLORS[i % GLYPH_COLORS.length] }}>{s}</span>
              ))}
              {p.card.canReplay && <span style={{ fontSize: wide ? 34 : 24, marginLeft: 10 }} aria-hidden>🔊</span>}
            </button>
            {p.celebrateKey > 0 && <div key={p.celebrateKey} className="rs-burst" aria-hidden>⭐✨⭐</div>}
          </div>
        )}

        {/* What to do right now, shown as well as said */}
        <div style={{ minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
          {stage === "model" && <div className="rs-waves" aria-hidden><span /><span /><span /><span /><span /></div>}
          {stage === "together" && <><span className="rs-pulse" style={{ fontSize: 36 }} aria-hidden>🎤</span><span className="rs-pulse" style={{ fontSize: 36, animationDelay: "0.3s" }} aria-hidden>🎤</span></>}
          {(stage === "alone" || stage === undefined) && p.card && (
            <span className={p.listening ? "rs-pulse" : ""} style={{ fontSize: 40, opacity: p.listening ? 1 : 0.35 }} aria-hidden>🎤</span>
          )}
          {stage === "play" && <span style={{ fontSize: 36 }} aria-hidden>🎉</span>}
        </div>

        {/* Ticha's sound book: a friendly sticker for every sound the child got right */}
        {p.collected.length > 0 && (
          <div className="rs-book" aria-label="Sound book">
            {p.collected.map((id) => (
              <div key={id} className="rs-sticker" title={getItem(id)?.text}>
                <span style={{ fontSize: 28 }}>{friendFor(id)}</span>
                <b>{getItem(id)?.text}</b>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
