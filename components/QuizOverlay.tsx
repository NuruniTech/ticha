"use client";

import { useState, useRef, useMemo } from "react";
import TichaAvatar from "./TichaAvatar";
import LottieEmoji from "./LottieEmoji";
import { supabase } from "@/lib/supabase";
import type { QuizWord } from "@/lib/wordLists";

export type { QuizWord };
interface Question { q: string; options: string[]; answer: number; emoji: string; }

const STARS_PER_CORRECT = 15;

function buildQuestions(words: QuizWord[], isSwahili: boolean): Question[] {
  const pool = words.map(w => (isSwahili ? w.en : w.sw));
  return words.map((word) => {
    const correct = isSwahili ? word.en : word.sw;
    const wrongs  = pool.filter(o => o !== correct).sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [correct, ...wrongs].sort(() => Math.random() - 0.5);
    return {
      // isSwahili=true  (learning Swahili, speaks English) → English question, Swahili word shown
      // isSwahili=false (learning English, speaks Swahili) → Swahili question, English word shown
      q:       isSwahili ? `What is "${word.sw}" in English?` : `"${word.en}" kwa Kiswahili ni nini?`,
      options,
      answer:  options.indexOf(correct),
      emoji:   word.emoji,
    };
  });
}

interface Props {
  words:      QuizWord[];
  language:   string;
  childId:    string | null;
  sessionStars: number;
  onComplete: () => void;
}

export default function QuizOverlay({ words, language, childId, sessionStars, onComplete }: Props) {
  const isSwahili = language === "sw";
  const [questions] = useState<Question[]>(() => buildQuestions(words, isSwahili));
  const [currentQ,  setCurrentQ]  = useState(0);
  const [selected,  setSelected]  = useState<number | null>(null);
  const [answered,  setAnswered]  = useState(false);
  const [score,     setScore]     = useState(0);
  const [bonusStars, setBonusStars] = useState(0);
  const [done,      setDone]      = useState(false);

  // refs so async handlers always see the latest values
  const scoreRef        = useRef(0);
  const bonusRef        = useRef(0);
  // tracks which question indices were answered correctly
  const correctMapRef   = useRef<boolean[]>([]);

  const q = questions[currentQ];

  function handleAnswer(idx: number) {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    const isCorrect = idx === q.answer;
    correctMapRef.current[currentQ] = isCorrect;
    if (isCorrect) {
      scoreRef.current   += 1;
      bonusRef.current   += STARS_PER_CORRECT;
      setScore(scoreRef.current);
      setBonusStars(bonusRef.current);
    }
  }

  async function handleNext() {
    if (currentQ < questions.length - 1) {
      setCurrentQ(c => c + 1);
      setSelected(null);
      setAnswered(false);
    } else {
      // Save bonus stars to child (queue for later if offline)
      if (childId && bonusRef.current > 0) {
        try {
          const { data: child } = await supabase
            .from("children").select("xp").eq("id", childId).single();
          if (child) {
            await supabase.from("children")
              .update({ xp: child.xp + bonusRef.current }).eq("id", childId);
          }
        } catch {
          // Offline — queue for sync when internet returns
          try {
            const key = "ticha_pending_xp";
            const pending = JSON.parse(localStorage.getItem(key) || "[]");
            pending.push({ childId, xp: bonusRef.current, ts: Date.now() });
            localStorage.setItem(key, JSON.stringify(pending));
          } catch { /* localStorage unavailable */ }
        }
      }

      // Save per-word quiz progress — fire-and-forget, non-blocking
      if (childId) {
        (async () => {
          try {
            const wordKeys = words.map(w => w.sw);
            const { data: existing } = await supabase
              .from("progress")
              .select("word, correct_count, attempt_count")
              .eq("child_id", childId)
              .in("word", wordKeys)
              .eq("language", language);

            const existingMap = Object.fromEntries(
              (existing || []).map(r => [r.word, r as { correct_count: number; attempt_count: number }])
            );

            const upserts = words.map((word, i) => {
              const wasCorrect = correctMapRef.current[i] ?? false;
              const prev = existingMap[word.sw];
              return {
                child_id:      childId,
                word:          word.sw,
                language,
                attempt_count: (prev?.attempt_count || 0) + 1,
                correct_count: (prev?.correct_count || 0) + (wasCorrect ? 1 : 0),
                last_seen_at:  new Date().toISOString(),
              };
            });

            await supabase.from("progress").upsert(upserts, { onConflict: "child_id,word,language" });
          } catch { /* non-critical — progress will catch up next quiz */ }
        })();
      }

      setDone(true);
    }
  }

  const totalStars = sessionStars + bonusRef.current;
  const pct     = questions.length ? Math.round((scoreRef.current / questions.length) * 100) : 0;

  // isSwahili = true  → child is an English speaker learning Swahili  → UI in English
  // isSwahili = false → child is a Swahili speaker learning English  → UI in Swahili
  const t = isSwahili ? {
    quizTime:     "Quiz Time! 🎉",
    questionOf:   (n: number, t: number) => `Question ${n} of ${t}`,
    backHome:     "🏠 Back to Home",
    nextQ:        "Next Question →",
    seeResults:   "See Results 🏆",
    outOf:        (s: number, t: number) => `${s} out of ${t} correct`,
    lessonStars:  "Lesson Stars",
    quizBonus:    "Quiz Bonus",
    totalToday:   "Total today",
    stars:        (n: number) => `⭐ ${n} Stars`,
    wrongAnswer:  (ans: string) => `The answer is "${ans}" — you'll remember next time!`,
    praise:       pct === 100 ? "Perfect score! Well done! 🏆"
                : pct >= 80  ? "Amazing! Keep it up! 🌟"
                : pct >= 60  ? "Good job! Keep going! ⭐"
                :              "Nice try! You'll do even better! 💪",
  } : {
    quizTime:     "Mchezo wa Maneno! 🎉",
    questionOf:   (n: number, t: number) => `Swali ${n} kati ya ${t}`,
    backHome:     "🏠 Rudi Nyumbani",
    nextQ:        "Swali Lijalo →",
    seeResults:   "Angalia Matokeo 🏆",
    outOf:        (s: number, t: number) => `${s} kati ya ${t} sahihi`,
    lessonStars:  "Nyota za Somo",
    quizBonus:    "Bonasi ya Mchezo",
    totalToday:   "Jumla leo",
    stars:        (n: number) => `⭐ Nyota ${n}`,
    wrongAnswer:  (ans: string) => `Jibu sahihi ni "${ans}" — utakumbuka mara ijayo!`,
    praise:       pct === 100 ? "Vizuri kabisa! Hongera sana! 🏆"
                : pct >= 80  ? "Vizuri sana! Endelea hivyo! 🌟"
                : pct >= 60  ? "Umefanya vizuri! Jaribu zaidi! ⭐"
                :              "Asante kwa kujaribu! Utafanya vizuri zaidi! 💪",
  };

  // ── Confetti pieces (memoised so they don't re-randomise on re-render) ───
  const confettiPieces = useMemo(() =>
    Array.from({ length: 32 }, (_, i) => ({
      id: i,
      left: `${(i * 3.2) % 100}%`,
      color: ["#FCD34D","#34D399","#60A5FA","#F87171","#A78BFA","#FB923C","#F472B6"][i % 7],
      delay: `${(i % 9) * 0.14}s`,
      duration: `${1.7 + (i % 6) * 0.22}s`,
      size: `${8 + (i % 5) * 3}px`,
      round: i % 3 === 0,
    })),
  []);

  // ── Results / Ticha comes back ─────────────────────────────────────────────
  if (done) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "linear-gradient(160deg, #1E3A8A 0%, #0D1F5C 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "28px" }}>
        {/* Confetti */}
        <style>{`
          @keyframes quizConfettiFall {
            0%   { transform: translateY(-16px) rotate(0deg); opacity: 1; }
            100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
          }
          @keyframes quizResultPop {
            0%   { transform: scale(0.8); opacity: 0; }
            70%  { transform: scale(1.06); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes starBurst {
            0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 1; }
            55%  { transform: translate(-50%, -130%) scale(1.6); opacity: 1; }
            100% { transform: translate(-50%, -190%) scale(1); opacity: 0; }
          }
        `}</style>
        {confettiPieces.map(p => (
          <div key={p.id} style={{
            position: "fixed", top: "-16px", left: p.left, pointerEvents: "none",
            width: p.size, height: p.size, background: p.color,
            borderRadius: p.round ? "50%" : "2px",
            animation: `quizConfettiFall ${p.duration} ${p.delay} ease-in both`,
            zIndex: 201,
          }} />
        ))}

        <TichaAvatar state="celebrating" size={190} />

        <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "26px", fontWeight: 800, color: "white", marginTop: "16px", marginBottom: "6px", textAlign: "center" }}>
          {t.praise}
        </h1>
        <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.55)", marginBottom: "24px" }}>
          {t.outOf(scoreRef.current, questions.length)}
        </p>

        {/* Stars breakdown */}
        <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: "20px", padding: "20px 28px", marginBottom: "28px", border: "1px solid rgba(255,255,255,0.12)", width: "100%", maxWidth: "360px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)" }}>{t.lessonStars}</span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#86EFAC" }}>⭐ +{sessionStars}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
            <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)" }}>{t.quizBonus}</span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#86EFAC" }}>⭐ +{bonusRef.current}</span>
          </div>
          <div style={{ height: "1px", background: "rgba(255,255,255,0.1)", marginBottom: "14px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "16px", fontWeight: 800, color: "white" }}>{t.totalToday}</span>
            <span style={{ fontSize: "20px", fontWeight: 800, color: "#FDE68A" }}>{t.stars(totalStars)}</span>
          </div>
        </div>

        <button className="btn-primary" onClick={onComplete} style={{ padding: "14px 40px", fontSize: "17px" }}>
          {t.backHome}
        </button>
      </div>
    );
  }

  // ── Quiz question ──────────────────────────────────────────────────────────
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,80,0.97)", backdropFilter: "blur(10px)", zIndex: 200, display: "flex", flexDirection: "column", padding: "20px" }}>
      <style>{`
        @keyframes starBurst {
          0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 1; }
          55%  { transform: translate(-50%, -130%) scale(1.6); opacity: 1; }
          100% { transform: translate(-50%, -190%) scale(1); opacity: 0; }
        }
        @keyframes emojiFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50%       { transform: translateY(-10px) scale(1.1); }
        }
        @keyframes emojiCorrect {
          0%   { transform: scale(1); }
          25%  { transform: scale(1.4) rotate(-8deg); }
          50%  { transform: scale(1.4) rotate(8deg); }
          75%  { transform: scale(1.2) rotate(-4deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
      `}</style>

      {/* Header: small Ticha + progress */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
        <TichaAvatar
          state={answered && selected === q.answer ? "celebrating" : "idle"}
          size={68}
        />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: "15px", fontWeight: 800, color: "white" }}>
              {t.quizTime}
            </span>
            <span style={{ background: "rgba(46,139,46,0.3)", borderRadius: "9999px", padding: "3px 10px", fontSize: "12px", fontWeight: 700, color: "#86EFAC" }}>
              ✓ {score}/{questions.length}
            </span>
          </div>
          <div style={{ height: "5px", background: "rgba(255,255,255,0.1)", borderRadius: "9999px", overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#2E8B2E", borderRadius: "9999px", width: `${(currentQ / questions.length) * 100}%`, transition: "width 0.4s" }} />
          </div>
          <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", marginTop: "4px" }}>
            {t.questionOf(currentQ + 1, questions.length)}
          </p>
        </div>
      </div>

      {/* Question card */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: "460px", margin: "0 auto", width: "100%" }}>
        <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: "22px", padding: "24px 20px", border: "1px solid rgba(255,255,255,0.1)", marginBottom: "14px" }}>

          {/* Animated emoji for the word being asked */}
          <div style={{ textAlign: "center", marginBottom: "10px" }}>
            <div style={{
              display: "inline-block",
              animation: answered && selected === q.answer
                ? "emojiCorrect 0.5s ease-out forwards"
                : "emojiFloat 2.4s ease-in-out infinite",
            }}>
              <LottieEmoji emoji={q.emoji} size={96} />
            </div>
          </div>

          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "20px", fontWeight: 800, color: "white", textAlign: "center", marginBottom: "20px", lineHeight: 1.3 }}>
            {q.q}
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {q.options.map((opt, idx) => {
              let bg     = "rgba(255,255,255,0.06)";
              let border = "rgba(255,255,255,0.12)";
              let color  = "white";
              if (answered) {
                if (idx === q.answer)                     { bg = "rgba(46,139,46,0.4)";  border = "#2E8B2E"; color = "#86EFAC"; }
                else if (idx === selected)                { bg = "rgba(239,68,68,0.25)"; border = "#EF4444"; color = "#FCA5A5"; }
              }
              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  disabled={answered}
                  style={{ background: bg, border: `2px solid ${border}`, borderRadius: "14px", padding: "14px 10px", cursor: answered ? "default" : "pointer", textAlign: "center", transition: "all 0.2s" }}
                  onMouseEnter={(e) => { if (!answered) e.currentTarget.style.borderColor = "#2E8B2E"; }}
                  onMouseLeave={(e) => { if (!answered && selected !== idx) e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
                >
                  <span style={{ fontSize: "15px", fontFamily: "'Baloo 2', cursive", fontWeight: 800, color }}>
                    {answered && idx === q.answer    && "✓ "}
                    {answered && idx === selected && idx !== q.answer && "✗ "}
                    {opt}
                  </span>
                </button>
              );
            })}
          </div>

          {answered && (
            <div style={{ marginTop: "14px", padding: "10px 14px", borderRadius: "10px", background: selected === q.answer ? "rgba(46,139,46,0.2)" : "rgba(239,68,68,0.15)", textAlign: "center", position: "relative" }}>
              {/* Star burst on correct answer */}
              {selected === q.answer && (
                <div style={{
                  position: "absolute", top: "50%", left: "50%",
                  fontSize: "36px", lineHeight: 1, pointerEvents: "none",
                  animation: "starBurst 0.65s ease-out forwards",
                  zIndex: 10,
                }}>⭐</div>
              )}
              <p style={{ fontSize: "14px", fontWeight: 700, color: selected === q.answer ? "#86EFAC" : "#FCA5A5", margin: 0 }}>
                {selected === q.answer
                  ? `+${STARS_PER_CORRECT} ⭐ ${(isSwahili
                      ? ["Excellent! 🎉", "Amazing! ⭐", "Incredible! 🌟", "Well done! 🎊"]
                      : ["Vizuri sana! 🎉", "Hongera! ⭐", "Ajabu! 🌟", "Kabisa! 🎊"]
                    )[currentQ % 4]}`
                  : t.wrongAnswer(q.options[q.answer])}
              </p>
            </div>
          )}
        </div>

        {answered && (
          <button
            className="btn-primary animate-fade-up"
            onClick={handleNext}
            style={{ width: "100%", padding: "14px", fontSize: "16px" }}
          >
            {currentQ < questions.length - 1 ? t.nextQ : t.seeResults}
          </button>
        )}
      </div>
    </div>
  );
}
