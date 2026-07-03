"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import TichaAvatar from "./TichaAvatar";
import LottieEmoji from "./LottieEmoji";
import type { QuizWord } from "@/lib/wordLists";

const STARS_PER_MATCH = 5;
const COMBO_THRESHOLD = 3;
const REVEAL_DURATION = 1600;
const WORD_COLORS     = ["#F97316", "#4B8BF5", "#22C55E", "#EC4899", "#F59E0B"];

type Selection = { key: string; side: "word" | "emoji" } | null;

interface Props {
  words:      QuizWord[];
  language:   string;
  // Called when all pairs are processed. Missed = pairs the child got wrong.
  onComplete: (missed: QuizWord[], starsEarned: number) => void;
}

export default function WordMatchGame({ words, language, onComplete }: Props) {
  const isSwahili = language === "sw";
  const gameWords = useMemo(() => words.slice(0, 5), [words]);

  const wordOrder  = useMemo(() => [...gameWords].sort(() => Math.random() - 0.5), [gameWords]);
  const emojiOrder = useMemo(() => [...gameWords].sort(() => Math.random() - 0.5), [gameWords]);

  const [selection,  setSelection]  = useState<Selection>(null);
  const [matched,    setMatched]    = useState<Set<string>>(new Set());
  const [dismissed,  setDismissed]  = useState<Set<string>>(new Set());
  const [shaking,    setShaking]    = useState<Set<string>>(new Set());
  const [popping,    setPopping]    = useState<Set<string>>(new Set());
  const [revealKey,  setRevealKey]  = useState<string | null>(null);
  const [combo,      setCombo]      = useState(0);
  const [comboFlash, setComboFlash] = useState(false);
  const [bonusStars, setBonusStars] = useState(0);

  const bonusRef   = useRef(0);
  const doneRef    = useRef(false); // guard against double-firing onComplete

  const handleTap = useCallback((key: string, side: "word" | "emoji") => {
    if (matched.has(key) || dismissed.has(key)) return;
    if (shaking.size > 0 || revealKey !== null) return;

    if (!selection)                                       { setSelection({ key, side }); return; }
    if (selection.key === key && selection.side === side) { setSelection(null); return; }
    if (selection.side === side)                          { setSelection({ key, side }); return; }

    const correctKey = selection.key;
    setSelection(null);

    if (correctKey === key) {
      // ✓ Correct
      const newMatched = new Set([...matched, key]);
      setMatched(newMatched);
      setPopping(p => { const n = new Set(p); n.add(key); return n; });
      setTimeout(() => setPopping(p => { const n = new Set(p); n.delete(key); return n; }), 550);

      const newCombo = combo + 1;
      setCombo(newCombo);
      const stars = STARS_PER_MATCH * (newCombo >= COMBO_THRESHOLD ? 2 : 1);
      bonusRef.current += stars;
      setBonusStars(bonusRef.current);
      if (newCombo >= COMBO_THRESHOLD) {
        setComboFlash(true);
        setTimeout(() => setComboFlash(false), 900);
      }

      if (newMatched.size + dismissed.size >= gameWords.length && !doneRef.current) {
        doneRef.current = true;
        const missed = gameWords.filter(w => !newMatched.has(w.sw));
        setTimeout(() => onComplete(missed, bonusRef.current), 700);
      }
    } else {
      // ✗ Wrong — shake, then reveal correct pair, then dismiss it
      setShaking(new Set([correctKey, key]));
      setCombo(0);

      setTimeout(() => {
        setShaking(new Set());
        setRevealKey(correctKey);

        setTimeout(() => {
          setRevealKey(null);
          setDismissed(prev => {
            const next = new Set([...prev, correctKey]);
            setMatched(mtch => {
              if (mtch.size + next.size >= gameWords.length && !doneRef.current) {
                doneRef.current = true;
                const missed = gameWords.filter(w => !mtch.has(w.sw));
                setTimeout(() => onComplete(missed, bonusRef.current), 400);
              }
              return mtch;
            });
            return next;
          });
        }, REVEAL_DURATION);
      }, 560);
    }
  }, [selection, matched, dismissed, shaking, revealKey, combo, gameWords, onComplete]);

  const t = isSwahili ? {
    title:      "Word Match!",
    subtitle:   "Tap a word — then tap its picture!",
    bonusLabel: "stars",
    combo:      (n: number) => `${n}x Combo! 🔥`,
  } : {
    title:      "Linganisha!",
    subtitle:   "Gonga neno — kisha gonga picha yake!",
    bonusLabel: "nyota",
    combo:      (n: number) => `Mfululizo ${n}x! 🔥`,
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0" }}>
      <style>{`
        @keyframes wmShake {
          0%,100%{transform:translateX(0) rotate(0deg)}
          20%{transform:translateX(-7px) rotate(-2deg)}
          40%{transform:translateX(7px) rotate(2deg)}
          60%{transform:translateX(-5px) rotate(-1deg)}
          80%{transform:translateX(5px) rotate(1deg)}
        }
        @keyframes wmPop {
          0%{transform:scale(1);opacity:1}
          45%{transform:scale(1.35);opacity:1}
          100%{transform:scale(0);opacity:0}
        }
        @keyframes wmReveal {
          0%  {transform:scale(1);   box-shadow:0 0 0 0   rgba(34,197,94,0.7)}
          25% {transform:scale(1.1); box-shadow:0 0 0 10px rgba(34,197,94,0.3)}
          75% {transform:scale(1.07);box-shadow:0 0 0 14px rgba(34,197,94,0.1)}
          100%{transform:scale(1);   box-shadow:0 0 0 18px rgba(34,197,94,0)}
        }
        @keyframes wmCombo {
          0%{transform:translateY(0) scale(0.7);opacity:0}
          30%{transform:translateY(-10px) scale(1.3);opacity:1}
          70%{transform:translateY(-18px) scale(1.1);opacity:1}
          100%{transform:translateY(-26px) scale(1);opacity:0}
        }
      `}</style>

      {/* Game header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
        <TichaAvatar state={matched.size > 0 ? "celebrating" : "idle"} size={54} />
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", fontWeight: 800, color: "white", margin: 0, lineHeight: 1.2 }}>{t.title}</h2>
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", margin: 0 }}>{t.subtitle}</p>
        </div>
        <div style={{ display: "flex", gap: "5px" }}>
          {gameWords.map((_, i) => (
            <div key={i} style={{ width: "10px", height: "10px", borderRadius: "50%", background: i < matched.size ? "#22C55E" : "rgba(255,255,255,0.15)", transition: "background 0.3s, box-shadow 0.3s", boxShadow: i < matched.size ? "0 0 7px #22C55E" : "none" }} />
          ))}
        </div>
      </div>

      {/* Stars + combo */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px", position: "relative" }}>
        <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: "999px", padding: "5px 18px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <span style={{ fontSize: "13px", fontWeight: 800, color: "#FDE68A" }}>⭐ {bonusStars} {t.bonusLabel}</span>
        </div>
        {comboFlash && (
          <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", fontFamily: "'Baloo 2', cursive", fontSize: "17px", fontWeight: 800, color: "#FB923C", animation: "wmCombo 0.9s ease-out forwards", pointerEvents: "none", whiteSpace: "nowrap" }}>
            {t.combo(combo)}
          </div>
        )}
      </div>

      {/* Two-column grid */}
      <div style={{ flex: 1, display: "flex", gap: "10px", maxWidth: "480px", margin: "0 auto", width: "100%" }}>
        {/* Word tiles */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          {wordOrder.map((word, i) => {
            const key         = word.sw;
            const color       = WORD_COLORS[i % WORD_COLORS.length];
            const gone        = matched.has(key) || dismissed.has(key);
            const isShaking   = shaking.has(key);
            const isPopping   = popping.has(key);
            const isRevealing = revealKey === key;
            const isSelected  = selection?.key === key && selection?.side === "word";
            return (
              <button key={key} onClick={() => handleTap(key, "word")} style={{
                flex: 1, borderRadius: "16px", cursor: gone ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", padding: "10px",
                opacity: gone ? 0 : 1, pointerEvents: gone ? "none" : "auto", touchAction: "manipulation",
                background:  isRevealing ? "#22C55E" : isSelected ? color : `${color}1A`,
                border:      `2.5px solid ${gone ? "transparent" : isRevealing ? "#16A34A" : isSelected ? color : `${color}55`}`,
                boxShadow:   isSelected ? `0 0 0 3px ${color}44, 0 6px 16px ${color}33` : "none",
                transition:  "background 0.15s, border-color 0.15s, opacity 0.2s",
                animation:   isShaking ? "wmShake 0.55s ease-in-out" : isPopping ? "wmPop 0.55s ease-out forwards" : isRevealing ? `wmReveal ${REVEAL_DURATION}ms ease-out` : "none",
              }}>
                <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: "16px", fontWeight: 800, letterSpacing: "0.01em", color: isRevealing || isSelected ? "white" : color }}>
                  {isSwahili ? word.sw : word.en}
                </span>
              </button>
            );
          })}
        </div>

        {/* Emoji tiles */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          {emojiOrder.map((word) => {
            const key         = word.sw;
            const gone        = matched.has(key) || dismissed.has(key);
            const isShaking   = shaking.has(key);
            const isPopping   = popping.has(key);
            const isRevealing = revealKey === key;
            const isSelected  = selection?.key === key && selection?.side === "emoji";
            return (
              <button key={key} onClick={() => handleTap(key, "emoji")} style={{
                flex: 1, borderRadius: "16px", cursor: gone ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", padding: "8px",
                opacity: gone ? 0 : 1, pointerEvents: gone ? "none" : "auto", touchAction: "manipulation",
                background:  isRevealing ? "rgba(34,197,94,0.25)" : isSelected ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.07)",
                border:      `2.5px solid ${gone ? "transparent" : isRevealing ? "#22C55E" : isSelected ? "#FDE68A" : "rgba(255,255,255,0.12)"}`,
                boxShadow:   isSelected ? "0 0 0 3px rgba(253,230,138,0.35), 0 6px 16px rgba(253,230,138,0.15)" : "none",
                transition:  "background 0.15s, border-color 0.15s, opacity 0.2s",
                animation:   isShaking ? "wmShake 0.55s ease-in-out" : isPopping ? "wmPop 0.55s ease-out forwards" : isRevealing ? `wmReveal ${REVEAL_DURATION}ms ease-out` : "none",
              }}>
                <LottieEmoji emoji={word.emoji} size={52} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
