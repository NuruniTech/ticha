"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ── Quiz question bank ────────────────────────────────────────────────────────
const QUESTIONS: Record<string, { q: string; options: string[]; answer: number }[]> = {
  animals: [
    { q: "What is 'simba' in English?",    options: ["Lion", "Elephant", "Giraffe", "Dog"],      answer: 0 },
    { q: "What is 'tembo' in English?",    options: ["Cat", "Elephant", "Bird", "Fish"],          answer: 1 },
    { q: "What is 'twiga' in English?",    options: ["Zebra", "Cow", "Giraffe", "Lion"],          answer: 2 },
    { q: "What is 'paka' in English?",     options: ["Dog", "Bird", "Fish", "Cat"],               answer: 3 },
    { q: "What is 'ndege' in English?",    options: ["Bird", "Fish", "Cow", "Dog"],               answer: 0 },
    { q: "How do you say 'dog' in Swahili?",    options: ["Paka", "Mbwa", "Samaki", "Ndege"],    answer: 1 },
    { q: "How do you say 'lion' in Swahili?",   options: ["Twiga", "Tembo", "Simba", "Ng'ombe"], answer: 2 },
    { q: "How do you say 'fish' in Swahili?",   options: ["Ndege", "Mbwa", "Paka", "Samaki"],    answer: 3 },
  ],
  numbers: [
    { q: "What is 'moja' in English?",   options: ["One", "Two", "Three", "Four"],    answer: 0 },
    { q: "What is 'mbili' in English?",  options: ["Three", "Two", "Five", "One"],    answer: 1 },
    { q: "What is 'tatu' in English?",   options: ["Four", "Five", "Three", "Two"],   answer: 2 },
    { q: "What is 'tano' in English?",   options: ["Three", "Six", "Four", "Five"],   answer: 3 },
    { q: "How do you say 'four' in Swahili?",  options: ["Tatu", "Nne", "Tano", "Sita"], answer: 1 },
    { q: "How do you say 'six' in Swahili?",   options: ["Saba", "Nane", "Sita", "Tano"], answer: 2 },
    { q: "What is 'saba' in English?",   options: ["Six", "Eight", "Seven", "Nine"],  answer: 2 },
    { q: "What is 'kumi' in English?",   options: ["Eight", "Nine", "Seven", "Ten"],  answer: 3 },
  ],
  colors: [
    { q: "What is 'nyekundu' in English?",  options: ["Red", "Blue", "Green", "Yellow"],   answer: 0 },
    { q: "What is 'bluu' in English?",      options: ["Green", "Blue", "Yellow", "White"],  answer: 1 },
    { q: "What is 'kijani' in English?",    options: ["Yellow", "Black", "Green", "Pink"],  answer: 2 },
    { q: "What is 'nyeusi' in English?",    options: ["White", "Orange", "Pink", "Black"],  answer: 3 },
    { q: "How do you say 'yellow' in Swahili?", options: ["Nyekundu", "Njano", "Pinki", "Bluu"],   answer: 1 },
    { q: "How do you say 'white' in Swahili?",  options: ["Nyeusi", "Kijani", "Nyeupe", "Bluu"],  answer: 2 },
    { q: "What is 'njano' in English?",     options: ["Orange", "Pink", "Blue", "Yellow"],  answer: 3 },
    { q: "How do you say 'red' in Swahili?", options: ["Bluu", "Njano", "Nyekundu", "Pinki"], answer: 2 },
  ],
  free: [
    { q: "What is 'chakula' in English?",  options: ["Food", "Water", "House", "School"],   answer: 0 },
    { q: "What is 'maji' in English?",     options: ["House", "Water", "Friend", "Family"], answer: 1 },
    { q: "What is 'shule' in English?",    options: ["Home", "Family", "School", "Food"],   answer: 2 },
    { q: "What is 'rafiki' in English?",   options: ["Family", "School", "Water", "Friend"], answer: 3 },
    { q: "How do you say 'house' in Swahili?", options: ["Shule", "Nyumba", "Maji", "Chakula"], answer: 1 },
    { q: "How do you say 'family' in Swahili?", options: ["Rafiki", "Shule", "Familia", "Maji"], answer: 2 },
  ],
};

const STARS_PER_CORRECT = 15;

function shuffle<T>(arr: T[], count: number): T[] {
  const copy = [...arr].sort(() => Math.random() - 0.5);
  return copy.slice(0, count);
}

function QuizContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const game    = searchParams.get("game")    || "animals";
  const lang    = searchParams.get("lang")    || "sw";
  const childId = searchParams.get("childId") || null;
  const sessionStars = parseInt(searchParams.get("xp") || "0");

  const [questions] = useState(() => shuffle(QUESTIONS[game] || QUESTIONS.animals, 5));

  const [currentQ, setCurrentQ]   = useState(0);
  const [selected, setSelected]   = useState<number | null>(null);
  const [answered, setAnswered]   = useState(false);
  const [score, setScore]         = useState(0);
  const [bonusStars, setBonusStars] = useState(0);
  const [done, setDone]           = useState(false);
  const [saving, setSaving]       = useState(false);

  const q = questions[currentQ];

  function handleAnswer(idx: number) {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    if (idx === q.answer) {
      setScore((s) => s + 1);
      setBonusStars((x) => x + STARS_PER_CORRECT);
    }
  }

  async function handleNext() {
    if (currentQ < questions.length - 1) {
      setCurrentQ((c) => c + 1);
      setSelected(null);
      setAnswered(false);
    } else {
      setDone(true);
      // Save bonus stars to child
      if (childId && bonusStars > 0) {
        setSaving(true);
        try {
          const { data: child } = await supabase.from("children").select("xp").eq("id", childId).single();
          if (child) {
            await supabase.from("children").update({ xp: child.xp + bonusStars }).eq("id", childId);
          }
        } catch (e) { console.error(e); }
        setSaving(false);
      }
    }
  }

  const totalStars = sessionStars + bonusStars;
  const pct       = Math.round((score / questions.length) * 100);
  const resultEmoji = pct === 100 ? "🏆" : pct >= 80 ? "🌟" : pct >= 60 ? "⭐" : "💪";
  const resultMsg   = pct === 100 ? "Perfect score! Hongera sana!" : pct >= 80 ? "Amazing! Vizuri sana!" : pct >= 60 ? "Good job! Keep practising!" : "Nice try! You'll do better next time!";

  // ── Results screen ───────────────────────────────────────────────────────
  if (done) {
    return (
      <main style={{ minHeight: "100vh", background: "linear-gradient(160deg, #1E3A8A, #0D1F5C)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ maxWidth: "420px", width: "100%", textAlign: "center" }}>

          <div className="animate-bounce-soft" style={{ fontSize: "80px", marginBottom: "16px" }}>{resultEmoji}</div>

          <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "28px", fontWeight: 800, color: "white", marginBottom: "8px" }}>
            {resultMsg}
          </h1>
          <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.6)", marginBottom: "28px" }}>
            You got <strong style={{ color: "white" }}>{score}/{questions.length}</strong> correct!
          </p>

          {/* Stars breakdown */}
          <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: "20px", padding: "20px 24px", marginBottom: "24px", border: "1px solid rgba(255,255,255,0.12)" }}>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "12px", fontWeight: 700, letterSpacing: "0.08em" }}>⭐ STARS EARNED TODAY</p>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.7)" }}>Lesson Stars</span>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#86EFAC" }}>⭐ +{sessionStars}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.7)" }}>Quiz bonus</span>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#86EFAC" }}>⭐ +{bonusStars}</span>
            </div>
            <div style={{ height: "1px", background: "rgba(255,255,255,0.1)", marginBottom: "12px" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "16px", fontWeight: 800, color: "white" }}>Total</span>
              <span style={{ fontSize: "18px", fontWeight: 800, color: "#FDE68A" }}>⭐ {totalStars} Stars</span>
            </div>
          </div>

          {/* Score bar */}
          <div style={{ marginBottom: "28px" }}>
            <div style={{ height: "10px", background: "rgba(255,255,255,0.1)", borderRadius: "9999px", overflow: "hidden" }}>
              <div style={{ height: "100%", background: pct >= 80 ? "#2E8B2E" : pct >= 60 ? "#F59E0B" : "#EF4444", width: `${pct}%`, borderRadius: "9999px", transition: "width 1s ease-out" }} />
            </div>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "6px" }}>{pct}% correct</p>
          </div>

          <button
            className="btn-primary"
            onClick={() => router.push(childId ? `/child/${childId}` : "/dashboard")}
            disabled={saving}
            style={{ width: "100%", padding: "16px", fontSize: "18px", opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "Saving..." : "🏠 Back to Dashboard"}
          </button>

          <button
            onClick={() => router.push(childId ? `/child/${childId}` : "/dashboard")}
            style={{ marginTop: "12px", background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}
          >
            View progress report →
          </button>
        </div>
      </main>
    );
  }

  // ── Quiz question screen ─────────────────────────────────────────────────
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(160deg, #1E3A8A, #0D1F5C)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ maxWidth: "460px", width: "100%" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>
              Question {currentQ + 1} of {questions.length}
            </span>
            <span style={{ background: "rgba(46,139,46,0.3)", borderRadius: "9999px", padding: "4px 12px", fontSize: "13px", fontWeight: 700, color: "#86EFAC" }}>
              ✓ {score} correct
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "9999px", overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#2E8B2E", width: `${((currentQ) / questions.length) * 100}%`, borderRadius: "9999px", transition: "width 0.4s" }} />
          </div>
        </div>

        {/* Question card */}
        <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: "24px", padding: "28px 24px", border: "1px solid rgba(255,255,255,0.12)", marginBottom: "16px" }}>

          {/* Quiz badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <div style={{ width: "36px", height: "36px", background: "#2E8B2E", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>🎓</div>
            <div>
              <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "13px", fontWeight: 800, color: "#86EFAC", margin: 0 }}>Ticha Quiz</p>
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", margin: 0 }}>+{STARS_PER_CORRECT} ⭐ for correct answer</p>
            </div>
          </div>

          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "22px", fontWeight: 800, color: "white", marginBottom: "20px", lineHeight: 1.3 }}>
            {q.q}
          </h2>

          {/* Options */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {q.options.map((opt, idx) => {
              let bg    = "rgba(255,255,255,0.06)";
              let border = "rgba(255,255,255,0.12)";
              let color  = "white";
              if (answered) {
                if (idx === q.answer) {
                  bg = "rgba(46,139,46,0.35)"; border = "#2E8B2E"; color = "#86EFAC";
                } else if (idx === selected && idx !== q.answer) {
                  bg = "rgba(239,68,68,0.25)"; border = "#EF4444"; color = "#FCA5A5";
                }
              } else if (selected === idx) {
                bg = "rgba(46,139,46,0.2)"; border = "#2E8B2E";
              }
              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  disabled={answered}
                  style={{
                    background: bg, border: `2px solid ${border}`, borderRadius: "14px",
                    padding: "14px 10px", cursor: answered ? "default" : "pointer",
                    textAlign: "center", transition: "all 0.2s",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                  }}
                  onMouseEnter={(e) => { if (!answered) e.currentTarget.style.borderColor = "#2E8B2E"; }}
                  onMouseLeave={(e) => { if (!answered && selected !== idx) e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
                >
                  <span style={{ fontSize: "15px", fontFamily: "'Baloo 2', cursive", fontWeight: 800, color }}>
                    {answered && idx === q.answer && "✓ "}
                    {answered && idx === selected && idx !== q.answer && "✗ "}
                    {opt}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Feedback */}
          {answered && (
            <div style={{ marginTop: "16px", padding: "10px 14px", borderRadius: "12px", background: selected === q.answer ? "rgba(46,139,46,0.2)" : "rgba(239,68,68,0.15)", textAlign: "center" }}>
              <p style={{ fontSize: "14px", fontWeight: 700, color: selected === q.answer ? "#86EFAC" : "#FCA5A5", margin: 0 }}>
                {selected === q.answer
                  ? ["Vizuri sana! 🎉", "Hongera! ⭐", "Excellent! 🌟", "Kabisa! 🎊"][Math.floor(Math.random() * 4)]
                  : `The answer is "${q.options[q.answer]}" — try to remember it!`}
              </p>
            </div>
          )}
        </div>

        {/* Next button */}
        {answered && (
          <button className="btn-primary animate-fade-up" onClick={handleNext} style={{ width: "100%", padding: "15px", fontSize: "17px" }}>
            {currentQ < questions.length - 1 ? "Next Question →" : "See Results 🏆"}
          </button>
        )}

        {/* Skip quiz */}
        {!answered && (
          <p style={{ textAlign: "center", fontSize: "12px", color: "rgba(255,255,255,0.25)", marginTop: "12px" }}>
            <button onClick={() => router.push(childId ? `/child/${childId}` : "/dashboard")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.25)", fontSize: "12px" }}>
              Skip quiz
            </button>
          </p>
        )}
      </div>
    </main>
  );
}

export default function QuizPage() {
  return <Suspense><QuizContent /></Suspense>;
}
