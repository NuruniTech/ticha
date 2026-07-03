"use client";

import { useState, useMemo, useRef } from "react";
import TichaAvatar from "./TichaAvatar";
import LottieEmoji from "./LottieEmoji";
import WordMatchGame from "./WordMatchGame";
import FlipCardsGame from "./FlipCardsGame";
import SpeedTapGame  from "./SpeedTapGame";
import type { QuizWord } from "@/lib/wordLists";

// ── Config ─────────────────────────────────────────────────────────────────
const MAX_HEARTS        = 3;
const COMPLETION_BONUS  = { perfect: 25, cleared: 10, partial: 0 };
// Lose a heart when you miss more than half the pairs in a game/retry
const heartLost = (missed: number, total: number) => missed > Math.floor(total / 2);

// As new game types are built, add them here and AVAILABLE_GAMES increments.
const AVAILABLE_GAMES = 3; // WordMatch + FlipCards + SpeedTap

// How many games per session by age (capped at available games)
function getGameCount(age: number) {
  const ideal = age <= 5 ? 2 : age <= 8 ? 3 : 4;
  return Math.min(ideal, AVAILABLE_GAMES);
}

const GAME_NAMES_EN = ["Word Match", "Flip Cards", "Speed Tap", "Word Spell"];
const GAME_NAMES_SW = ["Linganisha",  "Pindua Kadi", "Gonga Haraka", "Andika Neno"];

type Phase = "game" | "between" | "prereplay" | "retry" | "done" | "gameover";

interface RetryItem { words: QuizWord[]; label: string; gameType: number; }

interface Props {
  words:        QuizWord[];
  language:     string;
  childId:      string | null;
  sessionStars: number;
  childAge?:    number;
  onComplete:   () => void;
}

export default function GameSession({ words, language, childId, sessionStars, childAge = 7, onComplete }: Props) {
  const isSwahili = language === "sw";
  const gameWords = useMemo(() => words.slice(0, 5), [words]);
  const gameCount = useMemo(() => getGameCount(childAge), [childAge]);

  const [phase,      setPhase]      = useState<Phase>("game");
  const [gameIndex,  setGameIndex]  = useState(0);
  const [gameKey,    setGameKey]    = useState(0);   // bumped on every game/retry mount
  const [hearts,     setHearts]     = useState(MAX_HEARTS);
  const [retryQueue, setRetryQueue] = useState<RetryItem[]>([]);
  const [retryIndex, setRetryIndex] = useState(0);
  const [totalStars, setTotalStars] = useState(0);

  const heartsRef    = useRef(MAX_HEARTS);
  const totalRef     = useRef(0);
  const savedRef     = useRef(false);
  const retryRef     = useRef<RetryItem[]>([]);
  const retryIdxRef  = useRef(0);
  const hadMissesRef = useRef(false);

  const confetti = useMemo(() =>
    Array.from({ length: 32 }, (_, i) => ({
      id: i, left: `${(i * 3.2) % 100}%`,
      color:    ["#FCD34D","#34D399","#60A5FA","#F87171","#A78BFA","#FB923C","#F472B6"][i % 7],
      delay:    `${(i % 9) * 0.14}s`,
      duration: `${1.7 + (i % 6) * 0.22}s`,
      size:     `${8 + (i % 5) * 3}px`,
      round:    i % 3 === 0,
    })), []);

  // ── Server-side save ───────────────────────────────────────────────────────
  // XP and per-word progress are written by /api/quiz-results (service role),
  // which verifies the child belongs to the logged-in parent and clamps stars.
  async function saveResults(finalStars: number) {
    if (savedRef.current || !childId) return;
    savedRef.current = true;
    const allMissed = new Set(retryRef.current.flatMap(r => r.words.map(w => w.sw)));
    const words = gameWords.map(word => ({ sw: word.sw, correct: !allMissed.has(word.sw) }));
    try {
      const res = await fetch("/api/quiz-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, language, stars: finalStars, words }),
      });
      if (!res.ok) throw new Error(`quiz save failed: ${res.status}`);
    } catch {
      // Offline or server hiccup — queue the XP; XpSyncOnLoad flushes it later
      if (finalStars > 0) {
        try {
          const pending = JSON.parse(localStorage.getItem("ticha_pending_xp") || "[]");
          pending.push({ childId, xp: finalStars, ts: Date.now() });
          localStorage.setItem("ticha_pending_xp", JSON.stringify(pending));
        } catch { /* unavailable */ }
      }
    }
  }

  // ── Game completion handler ────────────────────────────────────────────────
  function onGameComplete(missed: QuizWord[], stars: number) {
    totalRef.current += stars;
    setTotalStars(totalRef.current);

    if (missed.length > 0) {
      hadMissesRef.current = true;
      const label = isSwahili
        ? `${GAME_NAMES_EN[gameIndex]} Retry`
        : `Marudio ya ${GAME_NAMES_SW[gameIndex]}`;
      const newQueue = [...retryRef.current, { words: missed, label, gameType: gameIndex }];
      retryRef.current = newQueue;
      setRetryQueue(newQueue);
    }

    // Check heart loss for this game
    let newHearts = heartsRef.current;
    if (heartLost(missed.length, gameWords.length)) {
      newHearts = Math.max(0, newHearts - 1);
      heartsRef.current = newHearts;
      setHearts(newHearts);
    }

    if (newHearts === 0) { finalize("gameover"); return; }

    const nextIndex = gameIndex + 1;
    if (nextIndex < gameCount) {
      // More games to play
      setGameIndex(nextIndex);
      setGameKey(k => k + 1);
      setPhase("between");
    } else {
      // All games done — check for retries
      if (retryRef.current.length > 0) {
        setPhase("prereplay");
      } else {
        finalize("done");
      }
    }
  }

  // ── Retry completion handler ───────────────────────────────────────────────
  function onRetryComplete(missed: QuizWord[], stars: number) {
    totalRef.current += stars;
    setTotalStars(totalRef.current);

    const retryWords = retryRef.current[retryIdxRef.current]?.words ?? [];
    let newHearts = heartsRef.current;
    if (heartLost(missed.length, retryWords.length)) {
      newHearts = Math.max(0, newHearts - 1);
      heartsRef.current = newHearts;
      setHearts(newHearts);
    }

    if (newHearts === 0) { finalize("gameover"); return; }

    const nextRetry = retryIdxRef.current + 1;
    if (nextRetry < retryRef.current.length) {
      retryIdxRef.current = nextRetry;
      setRetryIndex(nextRetry);
      setGameKey(k => k + 1);
      setTimeout(() => setPhase("retry"), 400);
    } else {
      finalize("done");
    }
  }

  // ── Finalize ───────────────────────────────────────────────────────────────
  function finalize(outcome: "done" | "gameover") {
    const bonus = outcome === "gameover" ? COMPLETION_BONUS.partial
                : !hadMissesRef.current  ? COMPLETION_BONUS.perfect
                :                          COMPLETION_BONUS.cleared;
    totalRef.current += bonus;
    setTotalStars(totalRef.current);
    saveResults(totalRef.current);
    setPhase(outcome);
  }

  // ── Translations ──────────────────────────────────────────────────────────
  const t = isSwahili ? {
    betweenDone:   (n: number) => `Game ${n} complete! ✓`,
    betweenNext:   (name: string) => `Up next: ${name}`,
    betweenBtn:    "Let's Go! →",
    prereplay:     "Almost done!",
    prereplaySub:  "Let's try the ones you missed",
    prereplayBtn:  "Start Review →",
    retryOf:       (label: string) => label,
    donePerfect:   "Perfect Run! 🏆",
    doneCleared:   "You Got There! 🌟",
    doneLabel:     "Well done!",
    gameoverTitle: "Don't give up!",
    gameoverSub:   "You ran out of lives — keep practising!",
    lessonStars:   "Lesson Stars",
    gameBonus:     "Game Stars",
    completion:    "Completion Bonus",
    totalToday:    "Total today",
    stars:         (n: number) => `⭐ ${n} Stars`,
    backHome:      "🏠 Back to Home",
    hearts:        "Lives",
  } : {
    betweenDone:   (n: number) => `Mchezo ${n} umekamilika! ✓`,
    betweenNext:   (name: string) => `Ujao: ${name}`,
    betweenBtn:    "Twende! →",
    prereplay:     "Karibu mwisho!",
    prereplaySub:  "Jaribu uliyokosa",
    prereplayBtn:  "Anza Mapitio →",
    retryOf:       (label: string) => label,
    donePerfect:   "Mkamilifu! 🏆",
    doneCleared:   "Umefaulu! 🌟",
    doneLabel:     "Hongera!",
    gameoverTitle: "Usikate tamaa!",
    gameoverSub:   "Umekosa maisha — endelea kufanya mazoezi!",
    lessonStars:   "Nyota za Somo",
    gameBonus:     "Nyota za Mchezo",
    completion:    "Bonasi ya Kukamilisha",
    totalToday:    "Jumla leo",
    stars:         (n: number) => `⭐ Nyota ${n}`,
    backHome:      "🏠 Rudi Nyumbani",
    hearts:        "Maisha",
  };

  const bonus = !hadMissesRef.current ? COMPLETION_BONUS.perfect : COMPLETION_BONUS.cleared;

  // ── Persistent top bar (hearts + progress) shown during gameplay ───────────
  const TopBar = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
      {/* Hearts */}
      <div style={{ display: "flex", gap: "4px" }}>
        {Array.from({ length: MAX_HEARTS }, (_, i) => (
          <span key={i} style={{ fontSize: "20px", filter: i >= hearts ? "grayscale(1) opacity(0.2)" : "none" }}>❤️</span>
        ))}
      </div>
      {/* Game progress pills */}
      <div style={{ display: "flex", gap: "6px" }}>
        {Array.from({ length: gameCount }, (_, i) => (
          <div key={i} style={{ width: "28px", height: "7px", borderRadius: "4px", background: i < gameIndex ? "#22C55E" : i === gameIndex && phase === "game" ? "#4B8BF5" : "rgba(255,255,255,0.15)", transition: "background 0.3s" }} />
        ))}
        {retryRef.current.length > 0 && (
          <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: phase === "retry" ? "#F59E0B" : "rgba(255,255,255,0.15)" }} />
        )}
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  // Active game
  if (phase === "game" || phase === "retry") {
    const isRetry    = phase === "retry";
    const gameLabel  = isRetry
      ? retryRef.current[retryIdxRef.current]?.label ?? ""
      : (isSwahili ? GAME_NAMES_EN[gameIndex] : GAME_NAMES_SW[gameIndex]);
    const activeWords  = isRetry ? retryRef.current[retryIdxRef.current]?.words ?? [] : gameWords;
    const activeType   = isRetry ? (retryRef.current[retryIdxRef.current]?.gameType ?? 0) : gameIndex;
    const onDone       = isRetry ? onRetryComplete : onGameComplete;

    return (
      <div style={{ position: "fixed", inset: 0, background: "linear-gradient(160deg, #1E3A8A 0%, #0D1F5C 100%)", zIndex: 200, display: "flex", flexDirection: "column", padding: "16px 14px" }}>
        <TopBar />
        {isRetry && (
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#F59E0B", background: "rgba(245,158,11,0.15)", borderRadius: "999px", padding: "3px 12px", border: "1px solid rgba(245,158,11,0.3)" }}>
              🔄 {gameLabel}
            </span>
          </div>
        )}
        {activeType === 0 && <WordMatchGame  key={gameKey} words={activeWords} language={language} onComplete={onDone} />}
        {activeType === 1 && <FlipCardsGame  key={gameKey} words={activeWords} language={language} onComplete={onDone} />}
        {activeType === 2 && <SpeedTapGame   key={gameKey} words={activeWords} language={language} onComplete={onDone} />}
      </div>
    );
  }

  // Between games
  if (phase === "between") {
    const nextName = isSwahili ? GAME_NAMES_EN[gameIndex] : GAME_NAMES_SW[gameIndex];
    return (
      <div style={{ position: "fixed", inset: 0, background: "linear-gradient(160deg, #1E3A8A 0%, #0D1F5C 100%)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px" }}>
        <style>{`@keyframes gsBetweenPop{0%{transform:scale(0.85);opacity:0}70%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}`}</style>
        <div style={{ animation: "gsBetweenPop 0.4s ease-out forwards", display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: "360px" }}>
          <TichaAvatar state="celebrating" size={140} />
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "24px", fontWeight: 800, color: "white", margin: "16px 0 6px", textAlign: "center" }}>
            {t.betweenDone(gameIndex)}
          </h2>
          <div style={{ display: "flex", gap: "4px", marginBottom: "20px" }}>
            {Array.from({ length: MAX_HEARTS }, (_, i) => (
              <span key={i} style={{ fontSize: "22px", filter: i >= hearts ? "grayscale(1) opacity(0.2)" : "none" }}>❤️</span>
            ))}
          </div>
          <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: "16px", padding: "14px 20px", border: "1px solid rgba(255,255,255,0.1)", width: "100%", textAlign: "center", marginBottom: "24px" }}>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: "0 0 4px" }}>{t.betweenNext(nextName)}</p>
            <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "20px", fontWeight: 800, color: "white", margin: 0 }}>{nextName}</p>
          </div>
          <button className="btn-primary" onClick={() => setPhase("game")} style={{ width: "100%", padding: "14px", fontSize: "17px" }}>
            {t.betweenBtn}
          </button>
        </div>
      </div>
    );
  }

  // Pre-retry screen
  if (phase === "prereplay") {
    return (
      <div style={{ position: "fixed", inset: 0, background: "linear-gradient(160deg, #1E3A8A 0%, #0D1F5C 100%)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px" }}>
        <style>{`@keyframes gsPrePop{0%{transform:scale(0.85);opacity:0}70%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}`}</style>
        <div style={{ animation: "gsPrePop 0.4s ease-out forwards", display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: "360px" }}>
          <TichaAvatar state="idle" size={130} />
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "24px", fontWeight: 800, color: "white", margin: "16px 0 6px", textAlign: "center" }}>{t.prereplay}</h2>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.55)", marginBottom: "20px", textAlign: "center" }}>{t.prereplaySub}</p>
          {/* List which games have misses */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", marginBottom: "24px" }}>
            {retryRef.current.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.07)", borderRadius: "12px", padding: "10px 14px", border: "1px solid rgba(255,255,255,0.1)" }}>
                <span style={{ fontSize: "18px" }}>🔄</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "14px", fontWeight: 800, color: "white", margin: 0 }}>{item.label}</p>
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", margin: 0 }}>{item.words.length} {isSwahili ? "words" : "maneno"}</p>
                </div>
                <div style={{ display: "flex", gap: "4px" }}>
                  {item.words.map(w => <LottieEmoji key={w.sw} emoji={w.emoji} size={24} />)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "4px", marginBottom: "20px" }}>
            {Array.from({ length: MAX_HEARTS }, (_, i) => (
              <span key={i} style={{ fontSize: "22px", filter: i >= hearts ? "grayscale(1) opacity(0.2)" : "none" }}>❤️</span>
            ))}
          </div>
          <button className="btn-primary" onClick={() => { retryIdxRef.current = 0; setRetryIndex(0); setGameKey(k => k + 1); setPhase("retry"); }} style={{ width: "100%", padding: "14px", fontSize: "17px" }}>
            {t.prereplayBtn}
          </button>
        </div>
      </div>
    );
  }

  // Done screen
  if (phase === "done") {
    const praiseText = !hadMissesRef.current ? t.donePerfect : t.doneCleared;
    const total = sessionStars + totalRef.current;
    return (
      <div style={{ position: "fixed", inset: 0, background: "linear-gradient(160deg, #1E3A8A 0%, #0D1F5C 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "28px" }}>
        <style>{`
          @keyframes gsConfettiFall{0%{transform:translateY(-16px) rotate(0deg);opacity:1}100%{transform:translateY(105vh) rotate(720deg);opacity:0}}
          @keyframes gsResultPop{0%{transform:scale(0.8);opacity:0}70%{transform:scale(1.06);opacity:1}100%{transform:scale(1);opacity:1}}
        `}</style>
        {confetti.map(p => (
          <div key={p.id} style={{ position: "fixed", top: "-16px", left: p.left, pointerEvents: "none", width: p.size, height: p.size, background: p.color, borderRadius: p.round ? "50%" : "2px", animation: `gsConfettiFall ${p.duration} ${p.delay} ease-in both`, zIndex: 201 }} />
        ))}
        <div style={{ animation: "gsResultPop 0.5s ease-out forwards" }}>
          <TichaAvatar state="celebrating" size={190} />
        </div>
        <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "27px", fontWeight: 800, color: "white", marginTop: "16px", marginBottom: "20px", textAlign: "center" }}>{praiseText}</h1>
        <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: "20px", padding: "20px 28px", marginBottom: "28px", border: "1px solid rgba(255,255,255,0.12)", width: "100%", maxWidth: "360px" }}>
          <Row label={t.lessonStars}  value={`⭐ +${sessionStars}`} />
          <Row label={t.gameBonus}    value={`⭐ +${totalRef.current - bonus}`} />
          <Row label={t.completion}   value={`⭐ +${bonus}`} />
          <div style={{ height: "1px", background: "rgba(255,255,255,0.1)", margin: "10px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "16px", fontWeight: 800, color: "white" }}>{t.totalToday}</span>
            <span style={{ fontSize: "20px", fontWeight: 800, color: "#FDE68A" }}>{t.stars(total)}</span>
          </div>
        </div>
        <button className="btn-primary" onClick={onComplete} style={{ padding: "14px 40px", fontSize: "17px" }}>{t.backHome}</button>
      </div>
    );
  }

  // Game over
  if (phase === "gameover") {
    const total = sessionStars + totalRef.current;
    return (
      <div style={{ position: "fixed", inset: 0, background: "linear-gradient(160deg, #1E3A8A 0%, #0D1F5C 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "28px" }}>
        <TichaAvatar state="idle" size={160} />
        <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "26px", fontWeight: 800, color: "white", marginTop: "16px", marginBottom: "8px", textAlign: "center" }}>{t.gameoverTitle}</h1>
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", marginBottom: "24px", textAlign: "center", maxWidth: "280px" }}>{t.gameoverSub}</p>
        <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: "20px", padding: "16px 24px", marginBottom: "28px", border: "1px solid rgba(255,255,255,0.1)", width: "100%", maxWidth: "320px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)" }}>{t.totalToday}</span>
            <span style={{ fontSize: "18px", fontWeight: 800, color: "#FDE68A" }}>{t.stars(total)}</span>
          </div>
        </div>
        <button className="btn-primary" onClick={onComplete} style={{ padding: "14px 40px", fontSize: "17px" }}>{t.backHome}</button>
      </div>
    );
  }

  return null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
      <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)" }}>{label}</span>
      <span style={{ fontSize: "14px", fontWeight: 700, color: "#86EFAC" }}>{value}</span>
    </div>
  );
}
