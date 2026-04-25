"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import VoiceSession from "@/components/VoiceSession";
import TichaAvatar from "@/components/TichaAvatar";

const GAMES = [
  { id: "animals",   labelEn: "Animals",    labelSw: "Wanyama",   emoji: "🦁", bg: "#FF8C00" },
  { id: "colors",    labelEn: "Colors",     labelSw: "Rangi",     emoji: "🎨", bg: "#9B59F5" },
  { id: "numbers",   labelEn: "Numbers",    labelSw: "Nambari",   emoji: "🔢", bg: "#4B8BF5" },
  { id: "people",    labelEn: "People",     labelSw: "Watu",      emoji: "👨‍👩‍👧‍👦", bg: "#22C55E" },
  { id: "chakula",   labelEn: "Food",       labelSw: "Chakula",   emoji: "🍽️", bg: "#F97316" },
  { id: "hisia",     labelEn: "Feelings",   labelSw: "Hisia",     emoji: "❤️", bg: "#EC4899" },
];

const DEMO_CHILD_NAME = "Amina";
const DEMO_CHILD_AGE  = 8;

export default function DemoPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const sw = lang === "sw";

  const [game, setGame]         = useState<string | null>(null);
  const [direction, setDirection] = useState<"sw" | "en">("sw"); // sw = learning English

  const t = {
    title:      sw ? "Jaribu Ticha bila Kusajili! 🎉" : "Try Ticha — No Sign Up Needed! 🎉",
    sub:        sw ? "Chagua mada na uanze mazungumzo na Ticha sasa hivi." : "Pick a topic and start a live conversation with Ticha right now.",
    dirLabel:   sw ? "Unajifunza:" : "Learning:",
    dirEn:      sw ? "Kiingereza" : "English",
    dirSw:      sw ? "Kiswahili" : "Swahili",
    topicLabel: sw ? "Chagua mada:" : "Choose a topic:",
    back:       sw ? "← Rudi" : "← Back",
    signupBanner: sw ? "Unapenda Ticha? Jisajili bure uhifadhi maendeleo ya mtoto wako →" : "Enjoying Ticha? Sign up free to save your child's progress →",
  };

  if (game) {
    return (
      <div>
        {/* Signup nudge banner */}
        <div
          onClick={() => router.push("/signup")}
          style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 500, background: "#FF8C00", padding: "10px 16px", textAlign: "center", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
        >
          <span style={{ fontSize: "13px", fontWeight: 700, color: "white" }}>{t.signupBanner}</span>
          <span style={{ fontSize: "13px", color: "white", fontWeight: 800 }}>→</span>
        </div>
        <div style={{ paddingTop: "44px" }}>
          <VoiceSession
            childName={DEMO_CHILD_NAME}
            language={direction}
            game={game}
            childId={null}
            childAge={DEMO_CHILD_AGE}
            childXp={0}
            prevSessions={0}
          />
        </div>
      </div>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(160deg, #047857 0%, #10B981 100%)", fontFamily: "'Nunito', sans-serif", padding: "24px" }}>

      <div style={{ maxWidth: "480px", margin: "0 auto" }}>

        {/* Back */}
        <button onClick={() => router.push("/")} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "9999px", padding: "8px 18px", color: "white", fontWeight: 700, fontSize: "13px", cursor: "pointer", marginBottom: "24px" }}>
          {t.back}
        </button>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <TichaAvatar state="idle" size={120} />
          <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "24px", fontWeight: 800, color: "white", marginTop: "12px", marginBottom: "6px" }}>
            {t.title}
          </h1>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>
            {t.sub}
          </p>
        </div>

        {/* Card */}
        <div style={{ background: "white", borderRadius: "24px", padding: "24px", boxShadow: "0 16px 48px rgba(0,0,0,0.15)" }}>

          {/* Direction toggle */}
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#6B7280", marginBottom: "8px" }}>{t.dirLabel}</p>
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
            {(["sw", "en"] as const).map(d => (
              <button key={d} onClick={() => setDirection(d)}
                style={{ flex: 1, padding: "10px", borderRadius: "12px", border: `2px solid ${direction === d ? "#10B981" : "#E5E7EB"}`, background: direction === d ? "#F0FDF4" : "white", fontSize: "14px", fontWeight: 700, color: direction === d ? "#047857" : "#6B7280", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>
                {d === "sw" ? `🇬🇧 ${t.dirEn}` : `🇹🇿 ${t.dirSw}`}
              </button>
            ))}
          </div>

          {/* Topic grid */}
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#6B7280", marginBottom: "10px" }}>{t.topicLabel}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
            {GAMES.map(g => (
              <button key={g.id} onClick={() => setGame(g.id)}
                style={{ background: g.bg, borderRadius: "16px", border: "none", padding: "16px 8px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", boxShadow: `0 4px 0 rgba(0,0,0,0.15)`, transition: "transform 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
                onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
              >
                <span style={{ fontSize: "26px" }}>{g.emoji}</span>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "white", fontFamily: "'Baloo 2', cursive", textAlign: "center" }}>
                  {lang === "sw" ? g.labelSw : g.labelEn}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Signup nudge */}
        <div onClick={() => router.push("/signup")}
          style={{ marginTop: "20px", background: "rgba(255,255,255,0.12)", borderRadius: "16px", padding: "14px 18px", textAlign: "center", cursor: "pointer", border: "1.5px solid rgba(255,255,255,0.2)" }}>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "white" }}>{t.signupBanner}</p>
        </div>
      </div>
    </main>
  );
}
