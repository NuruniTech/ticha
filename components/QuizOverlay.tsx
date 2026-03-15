"use client";

import { useState, useRef } from "react";
import TichaAvatar from "./TichaAvatar";
import { supabase } from "@/lib/supabase";

export interface QuizWord { sw: string; en: string; }
interface Question { q: string; options: string[]; answer: number; }

const STARS_PER_CORRECT = 15;

function buildQuestions(words: QuizWord[], isSwahili: boolean): Question[] {
  const pool = words.map(w => (isSwahili ? w.en : w.sw));
  return words.map((word) => {
    const correct = isSwahili ? word.en : word.sw;
    const wrongs  = pool.filter(o => o !== correct).sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [correct, ...wrongs].sort(() => Math.random() - 0.5);
    return {
      q:       isSwahili ? `What is "${word.sw}" in English?` : `What is "${word.en}" in Swahili?`,
      options,
      answer:  options.indexOf(correct),
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
  const scoreRef   = useRef(0);
  const bonusRef   = useRef(0);

  const q = questions[currentQ];

  function handleAnswer(idx: number) {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    if (idx === q.answer) {
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
      // Save bonus stars to child
      if (childId && bonusRef.current > 0) {
        try {
          const { data: child } = await supabase
            .from("children").select("xp").eq("id", childId).single();
          if (child) {
            await supabase.from("children")
              .update({ xp: child.xp + bonusRef.current }).eq("id", childId);
          }
        } catch (e) { console.error(e); }
      }
      setDone(true);
    }
  }

  const totalStars = sessionStars + bonusRef.current;
  const pct     = questions.length ? Math.round((scoreRef.current / questions.length) * 100) : 0;
  const praise  = pct === 100 ? "Perfect score! Hongera sana! 🏆"
                : pct >= 80  ? "Amazing! Vizuri sana! 🌟"
                : pct >= 60  ? "Good job! Keep going! ⭐"
                :              "Nice try! You'll do better! 💪";

  // ── Results / Ticha comes back ─────────────────────────────────────────────
  if (done) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "linear-gradient(160deg, #1E3A8A 0%, #0D1F5C 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "28px" }}>

        <TichaAvatar state="celebrating" size={190} />

        <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "26px", fontWeight: 800, color: "white", marginTop: "16px", marginBottom: "6px", textAlign: "center" }}>
          {praise}
        </h1>
        <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.55)", marginBottom: "24px" }}>
          {scoreRef.current} out of {questions.length} correct
        </p>

        {/* Stars breakdown */}
        <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: "20px", padding: "20px 28px", marginBottom: "28px", border: "1px solid rgba(255,255,255,0.12)", width: "100%", maxWidth: "360px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)" }}>Lesson Stars</span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#86EFAC" }}>⭐ +{sessionStars}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
            <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)" }}>Quiz bonus</span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#86EFAC" }}>⭐ +{bonusRef.current}</span>
          </div>
          <div style={{ height: "1px", background: "rgba(255,255,255,0.1)", marginBottom: "14px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "16px", fontWeight: 800, color: "white" }}>Total today</span>
            <span style={{ fontSize: "20px", fontWeight: 800, color: "#FDE68A" }}>⭐ {totalStars} Stars</span>
          </div>
        </div>

        <button className="btn-primary" onClick={onComplete} style={{ padding: "14px 40px", fontSize: "17px" }}>
          🏠 Back to Home
        </button>
      </div>
    );
  }

  // ── Quiz question ──────────────────────────────────────────────────────────
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,80,0.97)", backdropFilter: "blur(10px)", zIndex: 200, display: "flex", flexDirection: "column", padding: "20px" }}>

      {/* Header: small Ticha + progress */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
        <TichaAvatar
          state={answered && selected === q.answer ? "celebrating" : "idle"}
          size={68}
        />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: "15px", fontWeight: 800, color: "white" }}>
              Quiz Time! 🎉
            </span>
            <span style={{ background: "rgba(46,139,46,0.3)", borderRadius: "9999px", padding: "3px 10px", fontSize: "12px", fontWeight: 700, color: "#86EFAC" }}>
              ✓ {score}/{questions.length}
            </span>
          </div>
          <div style={{ height: "5px", background: "rgba(255,255,255,0.1)", borderRadius: "9999px", overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#2E8B2E", borderRadius: "9999px", width: `${(currentQ / questions.length) * 100}%`, transition: "width 0.4s" }} />
          </div>
          <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", marginTop: "4px" }}>
            Question {currentQ + 1} of {questions.length}
          </p>
        </div>
      </div>

      {/* Question card */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: "460px", margin: "0 auto", width: "100%" }}>
        <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: "22px", padding: "24px 20px", border: "1px solid rgba(255,255,255,0.1)", marginBottom: "14px" }}>

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
            <div style={{ marginTop: "14px", padding: "10px 14px", borderRadius: "10px", background: selected === q.answer ? "rgba(46,139,46,0.2)" : "rgba(239,68,68,0.15)", textAlign: "center" }}>
              <p style={{ fontSize: "14px", fontWeight: 700, color: selected === q.answer ? "#86EFAC" : "#FCA5A5", margin: 0 }}>
                {selected === q.answer
                  ? `+${STARS_PER_CORRECT} ⭐ ${["Vizuri sana! 🎉", "Hongera! ⭐", "Excellent! 🌟", "Kabisa! 🎊"][currentQ % 4]}`
                  : `The answer is "${q.options[q.answer]}" — you'll remember next time!`}
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
            {currentQ < questions.length - 1 ? "Next Question →" : "See Results 🏆"}
          </button>
        )}
      </div>
    </div>
  );
}
