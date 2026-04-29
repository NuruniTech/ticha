"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import TichaAvatar from "./TichaAvatar";
import LottieEmoji from "./LottieEmoji";
import { supabase } from "@/lib/supabase";
import type { QuizWord } from "@/lib/wordLists";

const STARS_PER_MATCH = 20;
const COMBO_THRESHOLD = 3;
const WORD_COLORS = ["#F97316", "#4B8BF5", "#22C55E", "#EC4899", "#F59E0B"];

type Selection = { key: string; side: "word" | "emoji" } | null;

interface Props {
  words:        QuizWord[];
  language:     string;
  childId:      string | null;
  sessionStars: number;
  onComplete:   () => void;
}

export default function WordMatchGame({ words, language, childId, sessionStars, onComplete }: Props) {
  const isSwahili = language === "sw";
  const gameWords = useMemo(() => words.slice(0, 5), [words]);

  const wordOrder  = useMemo(() => [...gameWords].sort(() => Math.random() - 0.5), [gameWords]);
  const emojiOrder = useMemo(() => [...gameWords].sort(() => Math.random() - 0.5), [gameWords]);

  const [selection,  setSelection]  = useState<Selection>(null);
  const [matched,    setMatched]    = useState<Set<string>>(new Set());
  const [shaking,    setShaking]    = useState<Set<string>>(new Set());
  const [popping,    setPopping]    = useState<Set<string>>(new Set());
  const [combo,      setCombo]      = useState(0);
  const [comboFlash, setComboFlash] = useState(false);
  const [bonusStars, setBonusStars] = useState(0);
  const [done,       setDone]       = useState(false);

  const bonusRef = useRef(0);
  const savedRef = useRef(false);

  const confetti = useMemo(() =>
    Array.from({ length: 32 }, (_, i) => ({
      id: i,
      left:     `${(i * 3.2) % 100}%`,
      color:    ["#FCD34D","#34D399","#60A5FA","#F87171","#A78BFA","#FB923C","#F472B6"][i % 7],
      delay:    `${(i % 9) * 0.14}s`,
      duration: `${1.7 + (i % 6) * 0.22}s`,
      size:     `${8 + (i % 5) * 3}px`,
      round:    i % 3 === 0,
    })), []);

  async function saveResults(bonus: number) {
    if (savedRef.current || !childId) return;
    savedRef.current = true;
    if (bonus > 0) {
      try {
        const { data: child } = await supabase.from("children").select("xp").eq("id", childId).single();
        if (child) await supabase.from("children").update({ xp: child.xp + bonus }).eq("id", childId);
      } catch {
        try {
          const pending = JSON.parse(localStorage.getItem("ticha_pending_xp") || "[]");
          pending.push({ childId, xp: bonus, ts: Date.now() });
          localStorage.setItem("ticha_pending_xp", JSON.stringify(pending));
        } catch { /* unavailable */ }
      }
    }
    try {
      const wordKeys = gameWords.map(w => w.sw);
      const { data: existing } = await supabase.from("progress")
        .select("word, correct_count, attempt_count")
        .eq("child_id", childId).in("word", wordKeys).eq("language", language);
      const existingMap = Object.fromEntries((existing || []).map(r => [r.word, r as { correct_count: number; attempt_count: number }]));
      const upserts = gameWords.map(word => {
        const prev = existingMap[word.sw];
        return {
          child_id:      childId,
          word:          word.sw,
          language,
          attempt_count: (prev?.attempt_count || 0) + 1,
          correct_count: (prev?.correct_count || 0) + 1,
          last_seen_at:  new Date().toISOString(),
        };
      });
      await supabase.from("progress").upsert(upserts, { onConflict: "child_id,word,language" });
    } catch { /* non-critical */ }
  }

  const handleTap = useCallback((key: string, side: "word" | "emoji") => {
    if (matched.has(key) || shaking.size > 0) return;

    if (!selection) { setSelection({ key, side }); return; }
    if (selection.key === key && selection.side === side) { setSelection(null); return; }
    if (selection.side === side) { setSelection({ key, side }); return; }

    // Opposite side tapped — check match
    if (selection.key === key) {
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

      setSelection(null);
      if (newMatched.size === gameWords.length) {
        setTimeout(async () => { await saveResults(bonusRef.current); setDone(true); }, 700);
      }
    } else {
      // ✗ Wrong
      setShaking(new Set([selection.key, key]));
      setCombo(0);
      setSelection(null);
      setTimeout(() => setShaking(new Set()), 550);
    }
  }, [selection, matched, shaking, combo, gameWords]);

  const t = isSwahili ? {
    title:       "Word Match!",
    subtitle:    "Tap a word — then tap its picture!",
    praise100:   "Perfect Match! 🏆",
    praise:      "Amazing! 🌟",
    matched:     "matched",
    lessonStars: "Lesson Stars",
    gameBonus:   "Game Bonus",
    totalToday:  "Total today",
    stars:       (n: number) => `⭐ ${n} Stars`,
    backHome:    "🏠 Back to Home",
    combo:       (n: number) => `${n}x Combo! 🔥`,
    bonusLabel:  "bonus stars",
  } : {
    title:       "Linganisha!",
    subtitle:    "Gonga neno — kisha gonga picha yake!",
    praise100:   "Mechi Kamili! 🏆",
    praise:      "Vizuri Sana! 🌟",
    matched:     "zimelinganishwa",
    lessonStars: "Nyota za Somo",
    gameBonus:   "Bonasi ya Mchezo",
    totalToday:  "Jumla leo",
    stars:       (n: number) => `⭐ Nyota ${n}`,
    backHome:    "🏠 Rudi Nyumbani",
    combo:       (n: number) => `Mfululizo ${n}x! 🔥`,
    bonusLabel:  "nyota za bonasi",
  };

  // ── Done screen ────────────────────────────────────────────────────────────
  if (done) {
    const totalStars = sessionStars + bonusRef.current;
    return (
      <div style={{ position: "fixed", inset: 0, background: "linear-gradient(160deg, #1E3A8A 0%, #0D1F5C 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "28px" }}>
        <style>{`
          @keyframes wmConfettiFall {
            0%   { transform: translateY(-16px) rotate(0deg); opacity: 1; }
            100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
          }
          @keyframes wmResultPop {
            0%   { transform: scale(0.8); opacity: 0; }
            70%  { transform: scale(1.06); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>

        {confetti.map(p => (
          <div key={p.id} style={{ position: "fixed", top: "-16px", left: p.left, pointerEvents: "none", width: p.size, height: p.size, background: p.color, borderRadius: p.round ? "50%" : "2px", animation: `wmConfettiFall ${p.duration} ${p.delay} ease-in both`, zIndex: 201 }} />
        ))}

        <div style={{ animation: "wmResultPop 0.5s ease-out forwards" }}>
          <TichaAvatar state="celebrating" size={190} />
        </div>

        <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "27px", fontWeight: 800, color: "white", marginTop: "16px", marginBottom: "6px", textAlign: "center" }}>
          {matched.size === gameWords.length ? t.praise100 : t.praise}
        </h1>
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", marginBottom: "24px" }}>
          {gameWords.length}/{gameWords.length} {t.matched} ✓
        </p>

        <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: "20px", padding: "20px 28px", marginBottom: "28px", border: "1px solid rgba(255,255,255,0.12)", width: "100%", maxWidth: "360px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)" }}>{t.lessonStars}</span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#86EFAC" }}>⭐ +{sessionStars}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
            <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)" }}>{t.gameBonus}</span>
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

  // ── Game screen ────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "fixed", inset: 0, background: "linear-gradient(160deg, #1E3A8A 0%, #0D1F5C 100%)", zIndex: 200, display: "flex", flexDirection: "column", padding: "16px 14px" }}>
      <style>{`
        @keyframes wmShake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          20%       { transform: translateX(-7px) rotate(-2deg); }
          40%       { transform: translateX(7px) rotate(2deg); }
          60%       { transform: translateX(-5px) rotate(-1deg); }
          80%       { transform: translateX(5px) rotate(1deg); }
        }
        @keyframes wmPop {
          0%   { transform: scale(1);   opacity: 1; }
          45%  { transform: scale(1.35); opacity: 1; }
          100% { transform: scale(0);   opacity: 0; }
        }
        @keyframes wmCombo {
          0%   { transform: translateY(0) scale(0.7);  opacity: 0; }
          30%  { transform: translateY(-10px) scale(1.3); opacity: 1; }
          70%  { transform: translateY(-18px) scale(1.1); opacity: 1; }
          100% { transform: translateY(-26px) scale(1);   opacity: 0; }
        }
        @keyframes wmCorrectRing {
          0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.6); }
          100% { box-shadow: 0 0 0 16px rgba(34,197,94,0); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
        <TichaAvatar state={matched.size > 0 ? "celebrating" : "idle"} size={54} />
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", fontWeight: 800, color: "white", margin: 0, lineHeight: 1.2 }}>{t.title}</h1>
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", margin: 0 }}>{t.subtitle}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "5px" }}>
          {/* Match progress dots */}
          <div style={{ display: "flex", gap: "5px" }}>
            {gameWords.map((_, i) => (
              <div key={i} style={{ width: "11px", height: "11px", borderRadius: "50%", background: i < matched.size ? "#22C55E" : "rgba(255,255,255,0.15)", transition: "background 0.3s, box-shadow 0.3s", boxShadow: i < matched.size ? "0 0 7px #22C55E" : "none" }} />
            ))}
          </div>
        </div>
      </div>

      {/* Stars + combo banner */}
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

      {/* Two-column match grid */}
      <div style={{ flex: 1, display: "flex", gap: "10px", maxWidth: "480px", margin: "0 auto", width: "100%" }}>

        {/* Word tiles */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          {wordOrder.map((word, i) => {
            const key        = word.sw;
            const color      = WORD_COLORS[i % WORD_COLORS.length];
            const isMatched  = matched.has(key);
            const isPopping  = popping.has(key);
            const isShaking  = shaking.has(key);
            const isSelected = selection?.key === key && selection?.side === "word";
            return (
              <button
                key={key}
                onClick={() => handleTap(key, "word")}
                style={{
                  flex:          1,
                  background:    isMatched ? "rgba(255,255,255,0.03)"
                               : isSelected ? color
                               : `${color}1A`,
                  border:        `2.5px solid ${isMatched ? "transparent"
                               : isSelected ? color
                               : `${color}55`}`,
                  borderRadius:  "16px",
                  cursor:        isMatched ? "default" : "pointer",
                  display:       "flex",
                  alignItems:    "center",
                  justifyContent:"center",
                  padding:       "10px",
                  opacity:       isMatched ? 0 : 1,
                  pointerEvents: isMatched ? "none" : "auto",
                  transition:    "background 0.15s, border-color 0.15s, opacity 0.15s",
                  animation:     isShaking ? "wmShake 0.55s ease-in-out"
                               : isPopping ? "wmPop 0.55s ease-out forwards"
                               : isSelected ? "wmCorrectRing 0.6s ease-out" : "none",
                  boxShadow:     isSelected ? `0 0 0 3px ${color}44, 0 6px 16px ${color}33` : "none",
                }}
              >
                <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: "16px", fontWeight: 800, color: isSelected ? "white" : color, letterSpacing: "0.01em" }}>
                  {isSwahili ? word.sw : word.en}
                </span>
              </button>
            );
          })}
        </div>

        {/* Emoji tiles */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          {emojiOrder.map((word) => {
            const key        = word.sw;
            const isMatched  = matched.has(key);
            const isPopping  = popping.has(key);
            const isShaking  = shaking.has(key);
            const isSelected = selection?.key === key && selection?.side === "emoji";
            return (
              <button
                key={key}
                onClick={() => handleTap(key, "emoji")}
                style={{
                  flex:          1,
                  background:    isMatched ? "rgba(255,255,255,0.02)"
                               : isSelected ? "rgba(255,255,255,0.18)"
                               : "rgba(255,255,255,0.07)",
                  border:        `2.5px solid ${isMatched ? "transparent"
                               : isSelected ? "#FDE68A"
                               : "rgba(255,255,255,0.12)"}`,
                  borderRadius:  "16px",
                  cursor:        isMatched ? "default" : "pointer",
                  display:       "flex",
                  alignItems:    "center",
                  justifyContent:"center",
                  padding:       "8px",
                  opacity:       isMatched ? 0 : 1,
                  pointerEvents: isMatched ? "none" : "auto",
                  transition:    "background 0.15s, border-color 0.15s, opacity 0.15s",
                  animation:     isShaking ? "wmShake 0.55s ease-in-out"
                               : isPopping ? "wmPop 0.55s ease-out forwards"
                               : "none",
                  boxShadow:     isSelected ? "0 0 0 3px rgba(253,230,138,0.35), 0 6px 16px rgba(253,230,138,0.15)" : "none",
                }}
              >
                <LottieEmoji emoji={word.emoji} size={52} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
