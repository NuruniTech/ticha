"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import TichaAvatar from "./TichaAvatar";
import LottieEmoji from "./LottieEmoji";
import type { GameWord } from "@/lib/languages";
import { sfx } from "@/lib/sfx";

const STARS_PER_MATCH = 5;
const COMBO_THRESHOLD = 3;
const WRONG_LIMIT     = 3;    // wrong involvements before pair is revealed and dismissed
const FLIP_BACK_MS    = 1300; // how long a wrong pair stays visible before flipping back
const REVEAL_MS       = 1600; // how long correct pair pulses green before dismissing
const WORD_COLORS     = ["#F97316", "#4B8BF5", "#22C55E", "#EC4899", "#F59E0B"];

interface CardData {
  id:       string;
  key:      string;      // w.sw — links word card ↔ emoji card
  type:     "word" | "emoji";
  word:     GameWord;
  colorIdx: number;
}

interface Props {
  words:      GameWord[];
  language:   string;
  onComplete: (missed: GameWord[], starsEarned: number) => void;
}

function buildDeck(gameWords: GameWord[]): CardData[] {
  return gameWords
    .flatMap((word, i) => [
      { id: `w-${word.id}`, key: word.id, type: "word"  as const, word, colorIdx: i },
      { id: `e-${word.id}`, key: word.id, type: "emoji" as const, word, colorIdx: i },
    ])
    .sort(() => Math.random() - 0.5);
}

export default function FlipCardsGame({ words, language, onComplete }: Props) {
  const isSwahili = language === "sw";
  const gameWords = useMemo(() => words.slice(0, 5), [words]);

  const [deck]       = useState<CardData[]>(() => buildDeck(gameWords));
  const [selected,   setSelected]   = useState<string[]>([]);   // at most 2 card IDs
  const [matched,    setMatched]    = useState<Set<string>>(new Set());
  const [dismissed,  setDismissed]  = useState<Set<string>>(new Set());
  const [isLocked,   setIsLocked]   = useState(false);
  const [revealKey,  setRevealKey]  = useState<string | null>(null);
  const [popping,    setPopping]    = useState<Set<string>>(new Set());
  const [combo,      setCombo]      = useState(0);
  const [comboFlash, setComboFlash] = useState(false);
  const [bonusStars, setBonusStars] = useState(0);

  const bonusRef    = useRef(0);
  const doneRef     = useRef(false);
  const wrongRef    = useRef<Record<string, number>>({});
  const matchedRef  = useRef(new Set<string>());
  const dismissedRef= useRef(new Set<string>());

  // ── Check completion ──────────────────────────────────────────────────────
  function checkDone() {
    if (matchedRef.current.size + dismissedRef.current.size >= gameWords.length && !doneRef.current) {
      doneRef.current = true;
      const missed = gameWords.filter(w => dismissedRef.current.has(w.id));
      setTimeout(() => onComplete(missed, bonusRef.current), 400);
      return true;
    }
    return false;
  }

  // ── Dismiss a pair (reveal flash → remove) ────────────────────────────────
  function dismissPair(key: string, onDone: () => void) {
    setRevealKey(key);
    setTimeout(() => {
      setRevealKey(null);
      dismissedRef.current = new Set([...dismissedRef.current, key]);
      setDismissed(new Set(dismissedRef.current));
      onDone();
    }, REVEAL_MS);
  }

  // ── Tap handler ───────────────────────────────────────────────────────────
  const handleTap = useCallback((card: CardData) => {
    if (isLocked || revealKey !== null) return;
    if (matchedRef.current.has(card.key) || dismissedRef.current.has(card.key)) return;
    if (selected.includes(card.id)) return;
    if (selected.length >= 2) return;

    const newSel = [...selected, card.id];
    setSelected(newSel);
    if (newSel.length < 2) { sfx.tap(); return; }

    // Two cards face-up — evaluate
    setIsLocked(true);
    const c1 = deck.find(d => d.id === newSel[0])!;
    const c2 = deck.find(d => d.id === newSel[1])!;

    if (c1.key === c2.key) {
      // ✓ Match
      sfx.correct();
      const newCombo = combo + 1;
      setCombo(newCombo);
      const stars = STARS_PER_MATCH * (newCombo >= COMBO_THRESHOLD ? 2 : 1);
      bonusRef.current += stars;
      setBonusStars(bonusRef.current);
      if (newCombo >= COMBO_THRESHOLD) {
        sfx.combo();
        setComboFlash(true);
        setTimeout(() => setComboFlash(false), 900);
      }

      setPopping(p => new Set([...p, c1.key]));
      setTimeout(() => {
        setPopping(p => { const n = new Set(p); n.delete(c1.key); return n; });
        matchedRef.current = new Set([...matchedRef.current, c1.key]);
        setMatched(new Set(matchedRef.current));
        setSelected([]);
        if (!checkDone()) setIsLocked(false);
      }, 550);
    } else {
      // ✗ Wrong — increment wrong counts for both pair keys
      sfx.wrong();
      setCombo(0);
      wrongRef.current[c1.key] = (wrongRef.current[c1.key] || 0) + 1;
      wrongRef.current[c2.key] = (wrongRef.current[c2.key] || 0) + 1;

      const willDismiss = [c1.key, c2.key]
        .filter((k, i, a) => a.indexOf(k) === i) // unique keys
        .filter(k => wrongRef.current[k] >= WRONG_LIMIT);

      setTimeout(() => {
        setSelected([]);

        if (willDismiss.length === 0) {
          // Just flip back
          setIsLocked(false);
        } else {
          // Reveal and dismiss each pair sequentially
          let i = 0;
          const next = () => {
            if (i >= willDismiss.length) {
              if (!checkDone()) setIsLocked(false);
              return;
            }
            dismissPair(willDismiss[i++], next);
          };
          next();
        }
      }, FLIP_BACK_MS);
    }
  }, [selected, isLocked, revealKey, combo, deck, gameWords]);

  const t = isSwahili ? {
    title:      "Flip Cards!",
    subtitle:   "Find the word that matches the picture!",
    bonusLabel: "stars",
    combo:      (n: number) => `${n}x Combo! 🔥`,
  } : {
    title:      "Pindua Kadi!",
    subtitle:   "Tafuta neno linalolingana na picha!",
    bonusLabel: "nyota",
    combo:      (n: number) => `Mfululizo ${n}x! 🔥`,
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <style>{`
        .fc-inner {
          position: relative; width: 100%; height: 100%;
          transform-style: preserve-3d;
          transition: transform 0.36s ease-in-out;
        }
        .fc-inner.face-up { transform: rotateY(180deg); }
        .fc-back, .fc-front {
          position: absolute; inset: 0;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center; padding: 6px;
        }
        .fc-front { transform: rotateY(180deg); }
        @keyframes fcPop {
          0%  { transform: scale(1);    opacity: 1; }
          45% { transform: scale(1.28); opacity: 1; }
          100%{ transform: scale(0);    opacity: 0; }
        }
        .fc-popping { animation: fcPop 0.52s ease-out forwards; }
        @keyframes fcRevealPulse {
          0%  { box-shadow: 0 0 0 0    rgba(34,197,94,0.8); }
          35% { box-shadow: 0 0 0 10px rgba(34,197,94,0.4); }
          75% { box-shadow: 0 0 0 16px rgba(34,197,94,0.1); }
          100%{ box-shadow: 0 0 0 20px rgba(34,197,94,0);   }
        }
        @keyframes fcCombo {
          0%  { transform: translateY(0)    scale(0.7); opacity: 0; }
          30% { transform: translateY(-10px) scale(1.3); opacity: 1; }
          70% { transform: translateY(-18px) scale(1.1); opacity: 1; }
          100%{ transform: translateY(-26px) scale(1);   opacity: 0; }
        }
      `}</style>

      {/* Header */}
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
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px", position: "relative" }}>
        <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: "999px", padding: "5px 18px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <span style={{ fontSize: "13px", fontWeight: 800, color: "#FDE68A" }}>⭐ {bonusStars} {t.bonusLabel}</span>
        </div>
        {comboFlash && (
          <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", fontFamily: "'Baloo 2', cursive", fontSize: "17px", fontWeight: 800, color: "#FB923C", animation: "fcCombo 0.9s ease-out forwards", pointerEvents: "none", whiteSpace: "nowrap" }}>
            {t.combo(combo)}
          </div>
        )}
      </div>

      {/* 4-column card grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", maxWidth: "380px", margin: "0 auto", width: "100%" }}>
        {deck.map(card => {
          const isSelected  = selected.includes(card.id);
          const isMatched   = matched.has(card.key);
          const isDismissed = dismissed.has(card.key);
          const isRevealing = revealKey === card.key;
          const isPopping   = popping.has(card.key);
          const isFaceUp    = isSelected || isMatched || isRevealing || isPopping;
          const gone        = (isMatched && !isPopping) || isDismissed;
          const color       = WORD_COLORS[card.colorIdx % WORD_COLORS.length];

          return (
            <div
              key={card.id}
              className={isPopping ? "fc-popping" : ""}
              onClick={() => !gone && !isMatched && handleTap(card)}
              style={{
                height:       "96px",
                borderRadius: "14px",
                cursor:       gone || isMatched ? "default" : "pointer",
                opacity:      gone ? 0 : 1,
                pointerEvents:gone ? "none" : "auto",
                touchAction:  "manipulation",
                transition:   "opacity 0.25s",
                perspective:  "600px",
              }}
            >
              <div className={`fc-inner${isFaceUp ? " face-up" : ""}`}>
                {/* Back face */}
                <div
                  className="fc-back"
                  style={{
                    background: "linear-gradient(135deg, rgba(30,58,138,0.7) 0%, rgba(15,23,70,0.85) 100%)",
                    border:     `2px solid ${isSelected ? "rgba(253,230,138,0.5)" : "rgba(255,255,255,0.1)"}`,
                    boxShadow:  isSelected ? "0 0 0 2px rgba(253,230,138,0.25), 0 4px 12px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.25)",
                  }}
                >
                  <span style={{ fontSize: "22px", color: "rgba(255,255,255,0.2)" }}>✦</span>
                </div>

                {/* Front face */}
                <div
                  className="fc-front"
                  style={{
                    background: card.type === "word"
                      ? (isRevealing ? "#22C55E" : color)
                      : (isRevealing ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.1)"),
                    border: `2px solid ${isRevealing ? "#22C55E" : card.type === "word" ? color : "rgba(255,255,255,0.18)"}`,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                    animation: isRevealing ? `fcRevealPulse ${REVEAL_MS}ms ease-out` : "none",
                  }}
                >
                  {card.type === "word" ? (
                    <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: "14px", fontWeight: 800, color: "white", textAlign: "center", lineHeight: 1.2, wordBreak: "break-word" }}>
                      {card.word.text}
                    </span>
                  ) : (
                    <LottieEmoji emoji={card.word.emoji} size={44} />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
