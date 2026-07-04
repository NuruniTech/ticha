"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import TichaAvatar from "./TichaAvatar";
import LottieEmoji from "./LottieEmoji";
import type { GameWord } from "@/lib/languages";
import { sfx } from "@/lib/sfx";

const STARS_PER_HIT   = 5;
const COMBO_THRESHOLD = 3;
const TIME_LIMIT_MS   = 5000;
const RESULT_SHOW_MS  = 900;   // how long correct/wrong flash stays before next word
const DISTRACTORS     = 3;     // wrong options shown alongside the correct one

interface Props {
  words:      GameWord[];
  language:   string;
  onComplete: (missed: GameWord[], starsEarned: number) => void;
}

function pickDistractors(correct: GameWord, pool: GameWord[], count: number): GameWord[] {
  const others = pool.filter(w => w.id !== correct.id);
  const shuffled = [...others].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// One round = one target word with its shuffled options and start time.
// Built in event/timeout callbacks (never during render) so the shuffle
// stays out of the render phase.
interface Round { idx: number; options: GameWord[]; startedAt: number; }
function makeRound(idx: number, gameWords: GameWord[]): Round {
  const target = gameWords[idx];
  const options = [...pickDistractors(target, gameWords, DISTRACTORS), target]
    .sort(() => Math.random() - 0.5);
  return { idx, options, startedAt: Date.now() };
}

export default function SpeedTapGame({ words, language, onComplete }: Props) {
  const isSwahili = language === "sw";
  const gameWords = useMemo(() => words.slice(0, 5), [words]);

  const [round,      setRound]      = useState<Round>(() => makeRound(0, gameWords));
  const [result,     setResult]     = useState<"correct" | "wrong" | "timeout" | null>(null);
  const [tapKey,     setTapKey]     = useState<string | null>(null);   // which option was tapped
  const [timeLeft,   setTimeLeft]   = useState(TIME_LIMIT_MS);
  const [combo,      setCombo]      = useState(0);
  const [comboFlash, setComboFlash] = useState(false);
  const [bonusStars, setBonusStars] = useState(0);

  const bonusRef   = useRef(0);
  const missedRef  = useRef<GameWord[]>([]);
  const lockedRef  = useRef(false);  // prevents double-tap during result flash
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const wordIdx     = round.idx;
  const options     = round.options;
  const currentWord = gameWords[wordIdx];

  // ── Advance to next word (or finish) ─────────────────────────────────────
  const scheduleAdvance = useCallback(() => {
    setTimeout(() => {
      const next = wordIdx + 1;
      if (next >= gameWords.length) {
        onComplete(missedRef.current, bonusRef.current);
      } else {
        // New round + reset — runs in a timeout callback, not in render/effect
        setRound(makeRound(next, gameWords));
        setResult(null);
        setTapKey(null);
        setTimeLeft(TIME_LIMIT_MS);
        lockedRef.current = false;
      }
    }, RESULT_SHOW_MS);
  }, [wordIdx, gameWords, onComplete]);

  // ── Countdown timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (result !== null || !currentWord) return;

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - round.startedAt;
      const remaining = Math.max(0, TIME_LIMIT_MS - elapsed);
      setTimeLeft(remaining);

      if (remaining === 0) {
        clearInterval(timerRef.current!);
        if (!lockedRef.current) {
          lockedRef.current = true;
          sfx.timeout();
          missedRef.current = [...missedRef.current, currentWord];
          setCombo(0);
          setResult("timeout");
          scheduleAdvance();
        }
      }
    }, 50);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [round, result, currentWord, scheduleAdvance]);

  const handleTap = useCallback((opt: GameWord) => {
    if (lockedRef.current || result !== null) return;
    lockedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);

    setTapKey(opt.id);

    if (opt.id === currentWord.id) {
      sfx.correct();
      const newCombo = combo + 1;
      setCombo(newCombo);
      const stars = STARS_PER_HIT * (newCombo >= COMBO_THRESHOLD ? 2 : 1);
      bonusRef.current += stars;
      setBonusStars(bonusRef.current);
      if (newCombo >= COMBO_THRESHOLD) {
        sfx.combo();
        setComboFlash(true);
        setTimeout(() => setComboFlash(false), 900);
      }
      setResult("correct");
    } else {
      sfx.wrong();
      missedRef.current = [...missedRef.current, currentWord];
      setCombo(0);
      setResult("wrong");
    }

    scheduleAdvance();
  }, [result, combo, currentWord, scheduleAdvance]);

  const t = isSwahili ? {
    title:      "Speed Tap!",
    subtitle:   "Tap the right picture before time runs out!",
    bonusLabel: "stars",
    combo:      (n: number) => `${n}x Combo! 🔥`,
    timeout:    "Too slow!",
  } : {
    title:      "Gonga Haraka!",
    subtitle:   "Gonga picha sahihi kabla muda haujaisha!",
    bonusLabel: "nyota",
    combo:      (n: number) => `Mfululizo ${n}x! 🔥`,
    timeout:    "Polepole mno!",
  };

  if (!currentWord) return null;

  const timerFraction = timeLeft / TIME_LIMIT_MS;
  const timerColor = timerFraction > 0.5 ? "#22C55E" : timerFraction > 0.25 ? "#F59E0B" : "#EF4444";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes stCorrect {
          0%  { transform: scale(1);    background: rgba(34,197,94,0.3); }
          40% { transform: scale(1.12); background: rgba(34,197,94,0.5); }
          100%{ transform: scale(1);    background: rgba(34,197,94,0.3); }
        }
        @keyframes stWrong {
          0%,100%{ transform: translateX(0); }
          20%    { transform: translateX(-8px); }
          40%    { transform: translateX(8px);  }
          60%    { transform: translateX(-5px); }
          80%    { transform: translateX(5px);  }
        }
        @keyframes stReveal {
          0%  { box-shadow: 0 0 0 0    rgba(34,197,94,0.8); }
          50% { box-shadow: 0 0 0 12px rgba(34,197,94,0.3); }
          100%{ box-shadow: 0 0 0 18px rgba(34,197,94,0);   }
        }
        @keyframes stCombo {
          0%  { transform: translateY(0)    scale(0.7); opacity: 0; }
          30% { transform: translateY(-10px) scale(1.3); opacity: 1; }
          70% { transform: translateY(-18px) scale(1.1); opacity: 1; }
          100%{ transform: translateY(-26px) scale(1);   opacity: 0; }
        }
        @keyframes stPulse {
          0%,100%{ opacity: 1; }
          50%    { opacity: 0.4; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
        <TichaAvatar state={bonusStars > 0 ? "celebrating" : "idle"} size={54} />
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", fontWeight: 800, color: "white", margin: 0, lineHeight: 1.2 }}>{t.title}</h2>
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", margin: 0 }}>{t.subtitle}</p>
        </div>
        {/* Word progress dots */}
        <div style={{ display: "flex", gap: "5px" }}>
          {gameWords.map((_, i) => (
            <div key={i} style={{
              width: "10px", height: "10px", borderRadius: "50%",
              background: i < wordIdx ? "#22C55E" : i === wordIdx ? "#4B8BF5" : "rgba(255,255,255,0.15)",
              transition: "background 0.3s",
              boxShadow: i < wordIdx ? "0 0 7px #22C55E" : i === wordIdx ? "0 0 7px #4B8BF5" : "none",
            }} />
          ))}
        </div>
      </div>

      {/* Stars + combo */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px", position: "relative" }}>
        <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: "999px", padding: "5px 18px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <span style={{ fontSize: "13px", fontWeight: 800, color: "#FDE68A" }}>⭐ {bonusStars} {t.bonusLabel}</span>
        </div>
        {comboFlash && (
          <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", fontFamily: "'Baloo 2', cursive", fontSize: "17px", fontWeight: 800, color: "#FB923C", animation: "stCombo 0.9s ease-out forwards", pointerEvents: "none", whiteSpace: "nowrap" }}>
            {t.combo(combo)}
          </div>
        )}
      </div>

      {/* Timer bar */}
      <div style={{ height: "6px", borderRadius: "3px", background: "rgba(255,255,255,0.1)", marginBottom: "18px", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: "3px",
          width: `${timerFraction * 100}%`,
          background: timerColor,
          transition: "width 0.05s linear, background 0.3s",
          boxShadow: `0 0 6px ${timerColor}`,
        }} />
      </div>

      {/* Word prompt */}
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <div style={{
          display: "inline-block",
          background: result === "correct" ? "rgba(34,197,94,0.2)" : result === "wrong" || result === "timeout" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.08)",
          borderRadius: "16px", padding: "12px 28px",
          border: `2px solid ${result === "correct" ? "#22C55E" : result === "wrong" || result === "timeout" ? "#EF4444" : "rgba(255,255,255,0.12)"}`,
          transition: "background 0.2s, border-color 0.2s",
          animation: result === "timeout" ? "stPulse 0.4s ease-in-out 2" : "none",
        }}>
          <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: "26px", fontWeight: 800, color: "white", letterSpacing: "0.02em" }}>
            {currentWord.text}
          </span>
          {result === "timeout" && (
            <p style={{ fontSize: "11px", color: "#FCA5A5", margin: "4px 0 0", fontWeight: 700 }}>{t.timeout}</p>
          )}
        </div>
      </div>

      {/* 2×2 emoji grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", maxWidth: "340px", margin: "0 auto", width: "100%" }}>
        {options.map(opt => {
          const isCorrect  = opt.id === currentWord.id;
          const isTapped   = tapKey === opt.id;
          const showReveal = result !== null && isCorrect;  // always highlight correct after result

          let anim = "none";
          if (isTapped && result === "correct") anim = `stCorrect ${RESULT_SHOW_MS}ms ease-out`;
          if (isTapped && result === "wrong")   anim = `stWrong 0.45s ease-in-out`;
          if (showReveal && !isTapped)          anim = `stReveal ${RESULT_SHOW_MS}ms ease-out`;

          return (
            <button
              key={opt.id}
              onClick={() => handleTap(opt)}
              style={{
                height: "100px", borderRadius: "18px",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: result !== null ? "default" : "pointer",
                touchAction: "manipulation",
                background: showReveal
                  ? "rgba(34,197,94,0.25)"
                  : isTapped && result === "wrong"
                    ? "rgba(239,68,68,0.2)"
                    : "rgba(255,255,255,0.07)",
                border: `2.5px solid ${
                  showReveal ? "#22C55E"
                  : isTapped && result === "wrong" ? "#EF4444"
                  : "rgba(255,255,255,0.12)"
                }`,
                transition: "background 0.15s, border-color 0.15s",
                animation: anim,
              }}
            >
              <LottieEmoji emoji={opt.emoji} size={60} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
