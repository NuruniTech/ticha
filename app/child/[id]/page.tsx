"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Child } from "@/types";
import TichaAvatar from "@/components/TichaAvatar";
import QuizOverlay from "@/components/QuizOverlay";
import LottieEmoji from "@/components/LottieEmoji";
import { WORD_LISTS } from "@/lib/wordLists";
import { useLanguage } from "@/context/LanguageContext";
import { T } from "@/lib/translations";

const GAMES = [
  { id: "animals",   labelEn: "Animals",    labelSw: "Wanyama",   emoji: "🦁", bg: "#FF8C00", shadow: "rgba(255,140,0,0.35)"   },
  { id: "colors",    labelEn: "Colors",     labelSw: "Rangi",     emoji: "🎨", bg: "#9B59F5", shadow: "rgba(155,89,245,0.35)"  },
  { id: "numbers",   labelEn: "Numbers",    labelSw: "Nambari",   emoji: "🔢", bg: "#4B8BF5", shadow: "rgba(75,139,245,0.35)"  },
  { id: "body",      labelEn: "Body Parts", labelSw: "Mwili",     emoji: "🫀", bg: "#EF4444", shadow: "rgba(239,68,68,0.35)"   },
  { id: "people",    labelEn: "People",     labelSw: "Watu",      emoji: "👨‍👩‍👧‍👦", bg: "#22C55E", shadow: "rgba(34,197,94,0.35)"   },
  { id: "chakula",   labelEn: "Food",       labelSw: "Chakula",   emoji: "🍽️", bg: "#F97316", shadow: "rgba(249,115,22,0.35)"  },
  { id: "vitenzi",   labelEn: "Verbs",      labelSw: "Vitenzi",   emoji: "🏃", bg: "#0EA5E9", shadow: "rgba(14,165,233,0.35)"  },
  { id: "shule",     labelEn: "School",     labelSw: "Shule",     emoji: "📚", bg: "#8B5CF6", shadow: "rgba(139,92,246,0.35)"  },
  { id: "hisia",     labelEn: "Feelings",   labelSw: "Hisia",     emoji: "❤️", bg: "#EC4899", shadow: "rgba(236,72,153,0.35)"  },
  { id: "mazingira", labelEn: "Nature",     labelSw: "Mazingira", emoji: "🌿", bg: "#16A34A", shadow: "rgba(22,163,74,0.35)"   },
];

// ── Curriculum ─────────────────────────────────────────────────────────────
const CURRICULUM: string[][] = [
  ["numbers", "colors", "animals"],
  ["body", "people", "chakula"],
  ["shule", "mazingira"],
  ["vitenzi", "hisia"],
];

const CURRICULUM_LABELS = [
  { en: "Level 1 — Beginner",     sw: "Kiwango 1 — Mwanzo" },
  { en: "Level 2 — Elementary",   sw: "Kiwango 2 — Msingi"  },
  { en: "Level 3 — Intermediate", sw: "Kiwango 3 — Kati"    },
  { en: "Level 4 — Advanced",     sw: "Kiwango 4 — Juu"     },
];

function levelUnlocked(lvlIdx: number, done: Set<string>): boolean {
  if (lvlIdx === 0) return true;
  return CURRICULUM[lvlIdx - 1].every(g => done.has(g));
}
function gameUnlocked(gameId: string, done: Set<string>): boolean {
  const lvl = CURRICULUM.findIndex(l => l.includes(gameId));
  return lvl === -1 || levelUnlocked(lvl, done);
}

type View = "dashboard" | "topics" | "quiz" | "room";

export default function ChildPage() {
  const router  = useRouter();
  const params  = useParams();
  const childId = params.id as string;
  const { lang } = useLanguage();
  const t = T[lang].child;

  const [child,         setChild]         = useState<Child | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [game,          setGame]          = useState("numbers");
  const [completedGames, setCompletedGames] = useState<Set<string>>(new Set());
  const [view,          setView]          = useState<View>("dashboard");
  const [lockedTapped,  setLockedTapped]  = useState<string | null>(null);
  const lockedHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [todayStars,    setTodayStars]    = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [quizCooldown,  setQuizCooldown]  = useState(false);
  const [isStarting,    setIsStarting]    = useState(false);
  const [hasError,      setHasError]      = useState(false);
  const [showLevelUp,   setShowLevelUp]   = useState(false);
  const [newLevel,      setNewLevel]      = useState(0);
  const [lockedBadge,   setLockedBadge]   = useState<null | { emoji: string; nameEn: string; nameSw: string; descEn: string; descSw: string; color: string; hintEn: string; hintSw: string }>(null);
  const [lockedDecor,   setLockedDecor]   = useState<null | { emoji: string; nameEn: string; nameSw: string; unlockEn: string; unlockSw: string }>(null);
  const [siblings,      setSiblings]      = useState<{ id: string; name: string; avatar: string; xp: number }[]>([]);

  const QUIZ_LIMIT = 3;

  function getQuizCount(): number {
    try {
      const key = `quiz_${childId}_${new Date().toDateString()}`;
      return parseInt(localStorage.getItem(key) || "0", 10);
    } catch { return 0; }
  }

  function incrementQuizCount() {
    try {
      const key = `quiz_${childId}_${new Date().toDateString()}`;
      localStorage.setItem(key, String(getQuizCount() + 1));
    } catch { /* localStorage unavailable */ }
  }

  function checkQuizCooldown() {
    setQuizCooldown(getQuizCount() >= QUIZ_LIMIT);
  }

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data } = await supabase
        .from("children")
        .select("*")
        .eq("id", childId)
        .eq("parent_id", user.id)
        .single();
      if (!data) { router.push("/dashboard"); return; }
      setChild(data);

      // Detect level-up since last visit
      const currentLevel = data.xp < 50 ? 1 : data.xp < 150 ? 2 : data.xp < 300 ? 3 : 4;
      const levelKey = `ticha_level_${childId}`;
      try {
        const storedLevel = parseInt(localStorage.getItem(levelKey) || "0", 10);
        if (storedLevel > 0 && currentLevel > storedLevel) {
          setNewLevel(currentLevel);
          setShowLevelUp(true);
        }
        localStorage.setItem(levelKey, String(currentLevel));
      } catch { /* localStorage unavailable */ }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const [{ data: sessions }, { count: sessionCount }, { data: sibs }, { data: gameSessions }] = await Promise.all([
        supabase.from("sessions").select("xp_earned").eq("child_id", childId).gte("created_at", todayStart.toISOString()),
        supabase.from("sessions").select("id", { count: "exact", head: true }).eq("child_id", childId),
        supabase.from("children").select("id, name, avatar, xp").eq("parent_id", user.id).order("xp", { ascending: false }),
        supabase.from("sessions").select("game").eq("child_id", childId),
      ]);
      setSiblings((sibs || []).filter(s => s.id !== childId));
      const earned = (sessions || []).reduce((s: number, r: { xp_earned?: number }) => s + (r.xp_earned || 0), 0);
      setTodayStars(earned);
      setTotalSessions(sessionCount ?? 0);

      const done = new Set((gameSessions || []).map((s: { game: string }) => s.game));
      const recommended = CURRICULUM.flat().find(g => {
        const lvl = CURRICULUM.findIndex(l => l.includes(g));
        return levelUnlocked(lvl, done) && !done.has(g);
      }) ?? "numbers";
      setGame(recommended);
      setCompletedGames(done);

      setLoading(false);
    } catch (err) {
      console.error("Child page load failed:", err);
      setHasError(true);
      setLoading(false);
    }
  }, [childId, router]);

  useEffect(() => { loadData(); checkQuizCooldown(); }, [loadData]); // eslint-disable-line react-hooks/exhaustive-deps

  async function startSession() {
    if (!child || isStarting || !gameUnlocked(game, completedGames)) return;
    setIsStarting(true);
    let prevSessions = 0;
    try {
      const { count } = await supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("child_id", child.id)
        .eq("game", game);
      prevSessions = count ?? 0;
    } catch { /* use default 0 */ }
    const p = new URLSearchParams({
      name: child.name, lang: child.primary_language, game, childId: child.id,
      prev: String(prevSessions),
      ...(child.age ? { age: String(child.age) } : {}),
      ...(child.xp  ? { xp:  String(child.xp)  } : {}),
    });
    router.push(`/session?${p.toString()}`);
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #A4C4F8 0%, #D4B4F8 50%, #F8B4D4 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <TichaAvatar state="connecting" size={90} />
    </div>
  );

  if (hasError) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #A4C4F8 0%, #D4B4F8 50%, #F8B4D4 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ textAlign: "center", maxWidth: "340px" }}>
        <div style={{ fontSize: "48px", marginBottom: "12px" }}>📡</div>
        <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", fontWeight: 800, color: "white", marginBottom: "8px" }}>{t.connectionProblem}</p>
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)", marginBottom: "20px" }}>{t.connectionError}</p>
        <button onClick={() => { setHasError(false); setLoading(true); loadData(); }}
          style={{ padding: "12px 28px", background: "white", color: "#4B8BF5", border: "none", borderRadius: "12px", fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "15px", cursor: "pointer" }}>
          {t.tryAgain}
        </button>
      </div>
    </div>
  );

  if (!child) return null;

  // ── Quiz view ──────────────────────────────────────────────────────────────
  if (view === "quiz") {
    if (quizCooldown) {
      return (
        <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #A4C4F8 0%, #D4B4F8 50%, #F8B4D4 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px", fontFamily: "'Nunito', sans-serif" }}>
          <div style={{ fontSize: "72px", marginBottom: "16px" }}>🌙</div>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "24px", fontWeight: 800, color: "white", textAlign: "center", marginBottom: "10px" }}>{t.cooldownTitle}</h2>
          <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.85)", textAlign: "center", maxWidth: "300px", lineHeight: 1.6, marginBottom: "28px" }}>
            {t.cooldownDesc(QUIZ_LIMIT)}
          </p>
          <button onClick={() => setView("dashboard")} style={{ background: "white", color: "#4B8BF5", fontFamily: "'Baloo 2', cursive", fontSize: "16px", fontWeight: 800, padding: "13px 32px", borderRadius: "16px", border: "none", cursor: "pointer" }}>
            {t.backHome}
          </button>
        </div>
      );
    }

    const quizWords = [...(WORD_LISTS[game] || WORD_LISTS.animals)].sort(() => Math.random() - 0.5).slice(0, 5);
    return (
      <QuizOverlay
        words={quizWords}
        language={child.primary_language}
        childId={child.id}
        sessionStars={todayStars}
        onComplete={() => {
          incrementQuizCount();
          checkQuizCooldown();
          setView("dashboard");
          loadData();
        }}
      />
    );
  }

  // ── Computed stats ─────────────────────────────────────────────────────────
  const LEVEL_THRESHOLDS = [0, 50, 150, 300];
  const levelNum    = child.xp < 50 ? 1 : child.xp < 150 ? 2 : child.xp < 300 ? 3 : 4;
  const nextLevelXp = levelNum < 4 ? LEVEL_THRESHOLDS[levelNum] : null;
  const starsToNext = nextLevelXp !== null ? nextLevelXp - child.xp : null;
  const todayPct   = Math.min(100, Math.round((todayStars / 50) * 100));
  const wordsGoal  = 5;
  const wordsDone  = Math.min(wordsGoal, Math.floor(todayStars / 10));
  const langLabel  = child.primary_language === "sw" ? t.swahili : t.english;

  // ── Daily challenge ────────────────────────────────────────────────────────
  const CHALLENGES = [
    {
      id: "stars",
      emoji: "⭐", gradient: "linear-gradient(135deg, #FF9500 0%, #FFD700 100%)",
      titleEn: "Star Power!",        titleSw: "Nguvu ya Nyota!",
      descEn:  `Earn 30 stars today`,      descSw: `Pata nyota 30 leo`,
      startEn: "Start a session to earn stars! ⚡",  startSw: "Anza somo kupata nyota! ⚡",
      doneEn:  "You crushed it! ⭐🎉",    doneSw:  "Umefanya vizuri! ⭐🎉",
      progEn:  (v: number, g: number) => `${v} of ${g} stars — keep going! ⚡`,
      progSw:  (v: number, g: number) => `Nyota ${v} kati ya ${g} — endelea! ⚡`,
      target: 30, value: todayStars,
    },
    {
      id: "words",
      emoji: "📝", gradient: "linear-gradient(135deg, #4B8BF5 0%, #9B59F5 100%)",
      titleEn: "Word Collector!",    titleSw: "Mkusanyaji wa Maneno!",
      descEn:  `Learn 5 new words today`,  descSw: `Jifunza maneno 5 mapya leo`,
      startEn: "Talk with Ticha to collect words! ⚡", startSw: "Zungumza na Ticha kukusanya maneno! ⚡",
      doneEn:  "All words learned! 📝🎉",  doneSw:  "Maneno yote yamejifunzwa! 📝🎉",
      progEn:  (v: number, g: number) => `${v} of ${g} words — almost there! ⚡`,
      progSw:  (v: number, g: number) => `Maneno ${v} kati ya ${g} — karibu! ⚡`,
      target: 5, value: wordsDone,
    },
    {
      id: "quiz",
      emoji: "🎮", gradient: "linear-gradient(135deg, #22C55E 0%, #0D9488 100%)",
      titleEn: "Quiz Champion!",     titleSw: "Bingwa wa Mchezo!",
      descEn:  "Complete 2 word games today",  descSw: "Maliza michezo 2 ya maneno leo",
      startEn: "Tap Word Games below to play! ⚡",   startSw: "Gonga Michezo ya Maneno ucheze! ⚡",
      doneEn:  "Quiz champion! 🎮🏆",    doneSw:  "Bingwa wa mchezo! 🎮🏆",
      progEn:  (v: number, g: number) => `${v} of ${g} games done — play more! ⚡`,
      progSw:  (v: number, g: number) => `Michezo ${v} kati ya ${g} — cheza zaidi! ⚡`,
      target: 2, value: getQuizCount(),
    },
    {
      id: "animals",
      emoji: "🦁", gradient: "linear-gradient(135deg, #FF8C00 0%, #22C55E 100%)",
      titleEn: "Animal Expert!",     titleSw: "Mtaalamu wa Wanyama!",
      descEn:  "Learn animal names in your lesson",  descSw: "Jifunza majina ya wanyama leo",
      startEn: "Start a lesson and explore Animals! ⚡", startSw: "Anza somo uchunguze Wanyama! ⚡",
      doneEn:  "Animal expert! Roar! 🦁🎉",   doneSw:  "Mtaalamu wa wanyama! 🦁🎉",
      progEn:  () => "You're learning — great job! 🦁",
      progSw:  () => "Unajifunza vizuri sana! 🦁",
      target: 1, value: todayStars > 0 ? 1 : 0,
    },
    {
      id: "colors",
      emoji: "🎨", gradient: "linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)",
      titleEn: "Color Explorer!",    titleSw: "Mtafutaji wa Rangi!",
      descEn:  "Explore colors in your lesson today",  descSw: "Chunguza rangi katika somo lako leo",
      startEn: "Pick Colors topic and start! ⚡",   startSw: "Chagua Rangi uanze somo! ⚡",
      doneEn:  "Color master! So colorful! 🎨🎉",  doneSw:  "Bingwa wa rangi! 🎨🎉",
      progEn:  () => "Painting the world with colors! 🎨",
      progSw:  () => "Unamaliza rangi zote! 🎨",
      target: 1, value: todayStars > 0 ? 1 : 0,
    },
    {
      id: "numbers",
      emoji: "🔢", gradient: "linear-gradient(135deg, #0EA5E9 0%, #4B8BF5 100%)",
      titleEn: "Number Genius!",     titleSw: "Bingwa wa Nambari!",
      descEn:  "Learn numbers in your lesson today",  descSw: "Jifunza nambari leo",
      startEn: "Pick Numbers topic and start! ⚡",  startSw: "Chagua Nambari uanze somo! ⚡",
      doneEn:  "Number genius! 1-2-3! 🔢🎉",     doneSw:  "Bingwa wa nambari! 1-2-3! 🔢🎉",
      progEn:  () => "Counting to the top! 🔢",
      progSw:  () => "Unahesabu vizuri! 🔢",
      target: 1, value: todayStars > 0 ? 1 : 0,
    },
    {
      id: "streak",
      emoji: "🔥", gradient: "linear-gradient(135deg, #EF4444 0%, #F97316 100%)",
      titleEn: "Streak Day!",        titleSw: "Siku ya Mfululizo!",
      descEn:  `Keep your ${child.streak + 1}-day streak alive!`,
      descSw:  `Dumisha mfululizo wa siku ${child.streak + 1}!`,
      startEn: "Do one lesson today and keep the fire! ⚡", startSw: "Fanya somo moja leo uendelee! ⚡",
      doneEn:  `${child.streak + 1}-day streak! On fire! 🔥`, doneSw: `Siku ${child.streak + 1}! Unawaka! 🔥`,
      progEn:  () => "Streak alive — you showed up! 🔥",
      progSw:  () => "Mfululizo unaendelea! 🔥",
      target: 1, value: todayStars > 0 ? 1 : 0,
    },
  ];
  const dayIndex      = new Date().getDate() + new Date().getMonth() * 31 + (child.name.charCodeAt(0) || 0);
  const challenge     = CHALLENGES[dayIndex % CHALLENGES.length];
  const challengeDone = challenge.value >= challenge.target;
  const challengePct  = Math.min(100, Math.round((challenge.value / challenge.target) * 100));

  // ── Badges ─────────────────────────────────────────────────────────────────
  const BADGES = [
    { emoji: "🌱", color: "#22C55E", nameEn: "First Steps",    nameSw: "Hatua za Kwanza",  hintEn: "Finish your very first lesson with Ticha!",  hintSw: "Maliza somo lako la kwanza na Ticha!",     descEn: "Complete 1 session",   descSw: "Maliza somo 1",   unlocked: totalSessions >= 1  },
    { emoji: "🔥", color: "#F97316", nameEn: "On Fire",        nameSw: "Mwako",            hintEn: "Come back 3 days in a row to unlock this!",   hintSw: "Rudi siku 3 mfululizo ili kufungua hii!",  descEn: "3-day streak",         descSw: "Siku 3 mfululizo", unlocked: child.streak >= 3   },
    { emoji: "⭐", color: "#F59E0B", nameEn: "Star Collector", nameSw: "Mkusanyaji",       hintEn: "Earn 50 stars across your lessons!",          hintSw: "Pata nyota 50 katika masomo yako!",        descEn: "Earn 50 stars",        descSw: "Nyota 50",         unlocked: child.xp >= 50      },
    { emoji: "📚", color: "#8B5CF6", nameEn: "Bookworm",       nameSw: "Msomaji",          hintEn: "Complete 5 lessons to prove you love learning!",hintSw: "Maliza masomo 5 kuonyesha upendo wa kujifunza!", descEn: "Complete 5 sessions",  descSw: "Masomo 5",        unlocked: totalSessions >= 5  },
    { emoji: "🌟", color: "#3B82F6", nameEn: "Rising Star",    nameSw: "Nyota Mpya",       hintEn: "Reach 150 stars — you're a superstar!",       hintSw: "Fikia nyota 150 — wewe ni nyota!",         descEn: "Earn 150 stars",       descSw: "Nyota 150",        unlocked: child.xp >= 150     },
    { emoji: "🎯", color: "#EF4444", nameEn: "Streak Master",  nameSw: "Bingwa wa Siku",   hintEn: "7 days in a row? You're unstoppable!",        hintSw: "Siku 7 mfululizo? Huwezi kusimamishwa!",   descEn: "7-day streak",         descSw: "Siku 7 mfululizo", unlocked: child.streak >= 7   },
    { emoji: "💪", color: "#0D9488", nameEn: "Word Master",    nameSw: "Bingwa wa Maneno", hintEn: "Complete 20 lessons to master this badge!",   hintSw: "Maliza masomo 20 kushinda beji hii!",       descEn: "Complete 20 sessions", descSw: "Masomo 20",        unlocked: totalSessions >= 20 },
    { emoji: "🏆", color: "#D97706", nameEn: "Champion",       nameSw: "Bingwa",           hintEn: "Reach the top level — the ultimate champion!", hintSw: "Fikia kiwango cha juu — bingwa mkubwa!",   descEn: "Reach max level",      descSw: "Kiwango cha juu",  unlocked: child.xp >= 300     },
  ];

  // ── Topics view ────────────────────────────────────────────────────────────
  if (view === "topics") {
    return (
      <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Nunito', sans-serif" }}>
        <div style={{ background: "linear-gradient(160deg, #A4C4F8 0%, #D4B4F8 50%, #F8B4D4 100%)", padding: "20px 20px 44px", flexShrink: 0 }}>
          <div className="app-page" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <button onClick={() => setView("dashboard")} style={{ width: "40px", height: "40px", borderRadius: "12px", background: "rgba(255,255,255,0.8)", border: "none", cursor: "pointer", fontSize: "18px" }}>←</button>
            <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "20px", fontWeight: 800, color: "#1E3A8A" }}>{t.chooseTopicTitle}</h1>
            <div style={{ width: "40px" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <TichaAvatar state="idle" size={100} />
            <div style={{ background: "white", borderRadius: "20px", padding: "10px 20px", marginTop: "10px", boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#374151" }}>{t.chooseTopicPrompt(child.name)}</span>
            </div>
          </div>
        </div>
        <div style={{ background: "white", flex: 1, borderRadius: "28px 28px 0 0", marginTop: "-24px", padding: "24px 20px 40px", zIndex: 5, position: "relative" }}>
          <div className="app-page">
            {CURRICULUM.map((levelGames, lvlIdx) => {
              const isUnlocked = levelUnlocked(lvlIdx, completedGames);
              const completedCount = levelGames.filter(g => completedGames.has(g)).length;
              const allDone = completedCount === levelGames.length;
              return (
                <div key={lvlIdx} style={{ marginBottom: "22px" }}>
                  {/* Level header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                    <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: "13px", fontWeight: 800, color: isUnlocked ? "#1E3A8A" : "#9CA3AF" }}>
                      {!isUnlocked && "🔒 "}{lang === "sw" ? CURRICULUM_LABELS[lvlIdx].sw : CURRICULUM_LABELS[lvlIdx].en}
                    </span>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: allDone ? "#22C55E" : "#9CA3AF" }}>
                      {completedCount}/{levelGames.length}{allDone ? " ✓" : ""}
                    </span>
                  </div>

                  {/* Game cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    {levelGames.map(gameId => {
                      const g = GAMES.find(x => x.id === gameId)!;
                      const isLocked    = !isUnlocked;
                      const isCompleted = completedGames.has(gameId);
                      const isSelected  = game === gameId;
                      return (
                        <button
                          key={g.id}
                          onClick={() => {
                            if (isLocked) {
                              setLockedTapped(g.id);
                              if (lockedHintTimer.current) clearTimeout(lockedHintTimer.current);
                              lockedHintTimer.current = setTimeout(() => setLockedTapped(null), 2500);
                            } else {
                              setGame(g.id);
                            }
                          }}
                          style={{
                            background: g.bg,
                            borderRadius: "20px", padding: "20px 12px 16px",
                            border: isSelected && !isLocked ? "3px solid white" : "3px solid transparent",
                            cursor: isLocked ? "not-allowed" : "pointer",
                            display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                            boxShadow: isLocked ? "none" : isSelected
                              ? `0 8px 28px ${g.shadow}, inset 0 1px 0 rgba(255,255,255,0.3)`
                              : `0 4px 12px ${g.shadow}`,
                            transform: isSelected && !isLocked ? "scale(1.04)" : "scale(1)",
                            transition: "all 0.18s ease", position: "relative",
                            filter: isLocked ? "grayscale(1)" : "none",
                            opacity: isLocked ? 0.72 : 1,
                          }}
                        >
                          <span style={{ fontSize: "40px", lineHeight: 1 }}>{g.emoji}</span>
                          <div style={{ textAlign: "center" }}>
                            <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "15px", fontWeight: 800, color: "white", margin: 0, lineHeight: 1.2 }}>
                              {lang === "sw" ? g.labelSw : g.labelEn}
                            </p>
                            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.8)", margin: 0 }}>
                              {lang === "sw" ? g.labelEn : g.labelSw}
                            </p>
                          </div>
                          {/* Selected indicator */}
                          {isSelected && !isLocked && (
                            <div style={{ position: "absolute", top: "10px", right: "10px", width: "22px", height: "22px", background: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px" }}>✓</div>
                          )}
                          {/* Completed badge */}
                          {isCompleted && !isLocked && !isSelected && (
                            <div style={{ position: "absolute", top: "10px", right: "10px", width: "22px", height: "22px", background: "#22C55E", borderRadius: "50%", border: "2px solid white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "white", fontWeight: 900 }}>✓</div>
                          )}
                          {/* Lock badge (default) */}
                          {isLocked && lockedTapped !== g.id && (
                            <div style={{ position: "absolute", top: "10px", right: "10px", width: "24px", height: "24px", background: "rgba(0,0,0,0.25)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>🔒</div>
                          )}
                          {/* On-card hint overlay when tapped */}
                          {isLocked && lockedTapped === g.id && (
                            <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.82)", borderRadius: "17px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px", gap: "6px" }}>
                              <span style={{ fontSize: "20px" }}>🔒</span>
                              <p style={{ fontSize: "11px", fontWeight: 800, color: "white", textAlign: "center", margin: 0, lineHeight: 1.4, fontFamily: "'Nunito', sans-serif" }}>
                                {lang === "sw"
                                  ? `Maliza Kiwango ${lvlIdx} kwanza`
                                  : `Finish Level ${lvlIdx} to unlock`}
                              </p>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                </div>
              );
            })}

            <button
              onClick={startSession}
              disabled={isStarting || !gameUnlocked(game, completedGames)}
              style={{ width: "100%", padding: "16px", background: (isStarting || !gameUnlocked(game, completedGames)) ? "#CC9944" : "#FF8C00", border: "none", borderRadius: "16px", color: "white", fontSize: "18px", fontWeight: 800, fontFamily: "'Baloo 2', cursive", cursor: (isStarting || !gameUnlocked(game, completedGames)) ? "default" : "pointer", boxShadow: (isStarting || !gameUnlocked(game, completedGames)) ? "none" : "0 5px 0 #CC6A00, 0 8px 20px rgba(255,140,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "background 0.2s" }}
            >
              {isStarting ? t.gettingReady : t.startWithTicha}
            </button>
          </div>
        </div>

      </main>
    );
  }

  // ── Room view ──────────────────────────────────────────────────────────────
  if (view === "room") {
    const plant  = { id: "plant",  emoji: "🌱", nameEn: "Potted Plant",   nameSw: "Mmea wa Sufuria",  unlockEn: "Finish your first lesson!",            unlockSw: "Maliza somo lako la kwanza!",           unlocked: totalSessions >= 1  };
    const poster = { id: "poster", emoji: "🌈", nameEn: "Rainbow Poster", nameSw: "Poster ya Upinde", unlockEn: "Earn 50 stars to hang this poster!",    unlockSw: "Pata nyota 50 kuning'iniza poster hii!", unlocked: child.xp >= 50      };
    const books  = { id: "books",  emoji: "📚", nameEn: "Book Collection", nameSw: "Mkusanyiko wa Vitabu", unlockEn: "Complete 5 lessons!",              unlockSw: "Maliza masomo 5!",                      unlocked: totalSessions >= 5  };
    const canvas = { id: "canvas", emoji: "🎨", nameEn: "Art Canvas",     nameSw: "Turubai la Sanaa", unlockEn: "Come back 3 days in a row!",            unlockSw: "Rudi siku 3 mfululizo!",                unlocked: child.streak >= 3   };
    const trophy = { id: "trophy", emoji: "🏆", nameEn: "Gold Trophy",    nameSw: "Kombe la Dhahabu", unlockEn: "Reach 150 stars!",                      unlockSw: "Fikia nyota 150!",                      unlocked: child.xp >= 150     };
    const mobile = { id: "mobile", emoji: "🌟", nameEn: "Star Mobile",    nameSw: "Mapambo ya Nyota", unlockEn: "Keep a 7-day streak — you're amazing!", unlockSw: "Siku 7 mfululizo — wewe ni bora!",      unlocked: child.streak >= 7   };
    const music  = { id: "music",  emoji: "🎵", nameEn: "Music Player",   nameSw: "Mchezaji Muziki",  unlockEn: "Complete 20 lessons!",                  unlockSw: "Maliza masomo 20!",                     unlocked: totalSessions >= 20 };
    const crown  = { id: "crown",  emoji: "👑", nameEn: "Champion Crown", nameSw: "Taji la Bingwa",   unlockEn: "Reach 300 stars — ultimate champion!",  unlockSw: "Fikia nyota 300 — bingwa mkubwa!",     unlocked: child.xp >= 300     };
    const DECORATIONS = [plant, poster, books, canvas, trophy, mobile, music, crown];
    const unlockedCount = DECORATIONS.filter(d => d.unlocked).length;
    type Decor = typeof plant;

    /* Render a decoration slot — shows emoji if unlocked, dashed slot if locked */
    const slot = (decor: Decor, sz: number, extra: React.CSSProperties = {}) => {
      if (decor.unlocked) {
        const anim: Record<string, string> = {
          plant: "plantSway 3s ease-in-out infinite",
          star: "starSpin 8s linear infinite",
          trophy: "trophyPulse 2.5s ease-in-out infinite",
          music: "musicBounce 1.8s ease-in-out infinite",
          crown: "crownGlow 2s ease-in-out infinite",
          canvas: "plantSway 4s ease-in-out infinite",
        };
        return (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", ...extra }}>
            <span style={{ fontSize: sz, lineHeight: 1, filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.28))", animation: anim[decor.id] || "none", display: "block" }}>
              {decor.emoji}
            </span>
          </div>
        );
      }
      return (
        <button onClick={() => setLockedDecor(decor)} style={{ background: "rgba(255,255,255,0.28)", border: "2px dashed rgba(0,0,0,0.18)", borderRadius: "8px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1px", ...extra }}>
          <span style={{ fontSize: sz * 0.6, lineHeight: 1, filter: "grayscale(1) opacity(0.18)" }}>{decor.emoji}</span>
          <span style={{ fontSize: sz * 0.35, lineHeight: 1 }}>🔒</span>
        </button>
      );
    };

    return (
      <main style={{ minHeight: "100vh", background: "#FFFBF0", display: "flex", flexDirection: "column", fontFamily: "'Nunito', sans-serif" }}>
        <style>{`
          @keyframes plantSway    { 0%,100%{transform:rotate(-2.5deg) translateX(0)} 50%{transform:rotate(2.5deg) translateX(1px)} }
          @keyframes starSpin     { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
          @keyframes trophyPulse  { 0%,100%{filter:drop-shadow(0 3px 6px rgba(0,0,0,0.28)) brightness(1)} 50%{filter:drop-shadow(0 3px 12px rgba(245,158,11,0.7)) brightness(1.15)} }
          @keyframes musicBounce  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
          @keyframes crownGlow    { 0%,100%{filter:drop-shadow(0 3px 6px rgba(0,0,0,0.28)) drop-shadow(0 0 0px #F59E0B)} 50%{filter:drop-shadow(0 3px 6px rgba(0,0,0,0.28)) drop-shadow(0 0 8px #F59E0B)} }
          @keyframes decorPop     { 0%{transform:translate(-50%,-50%) scale(0.6);opacity:0} 70%{transform:translate(-50%,-50%) scale(1.05)} 100%{transform:translate(-50%,-50%) scale(1);opacity:1} }
          @keyframes badgePop     { 0%{transform:scale(0.7);opacity:0} 70%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
          @keyframes badgeGlow    { 0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,0.6)} 50%{box-shadow:0 0 0 6px rgba(255,255,255,0)} }
        `}</style>

        {/* Header */}
        <div style={{ background: "white", borderBottom: "1px solid #F3F4F6", padding: "0 20px" }}>
          <div className="app-page" style={{ height: "60px", display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={() => setView("dashboard")} style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#F3F4F6", border: "none", cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
            <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "20px", fontWeight: 800, color: "#1E3A5F", flex: 1 }}>🏫 {t.myRoomTitle}</h1>
            <span style={{ background: "#EFF6FF", color: "#1E3A8A", borderRadius: "9999px", padding: "4px 12px", fontSize: "12px", fontWeight: 700 }}>
              {unlockedCount}/{DECORATIONS.length} ✨
            </span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          <div className="app-page">

            {/* ══ THE DOLLHOUSE ROOM ══ */}
            <div style={{ position: "relative", width: "100%", paddingBottom: "72%", borderRadius: "20px", overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", marginBottom: "24px" }}>
              <div style={{ position: "absolute", inset: 0 }}>

                {/* ── WALL ── */}
                <div style={{ position: "absolute", inset: "0 0 30% 0", background: "#FFF0D0" }} />
                {/* Subtle wallpaper dots */}
                <div style={{ position: "absolute", inset: "0 0 30% 0", backgroundImage: "radial-gradient(circle, rgba(180,140,80,0.12) 1.5px, transparent 1.5px)", backgroundSize: "18px 18px" }} />

                {/* ── FLOOR ── */}
                <div style={{ position: "absolute", inset: "70% 0 0 0", background: "repeating-linear-gradient(90deg, #C49050 0, #C49050 55px, #B07840 55px, #B07840 57px)" }} />
                {/* Baseboard */}
                <div style={{ position: "absolute", bottom: "30%", left: 0, right: 0, height: "14px", background: "#8B5E2A" }} />
                <div style={{ position: "absolute", bottom: "30%", left: 0, right: 0, height: "3px", background: "#6B4410", marginBottom: "14px" }} />

                {/* ── CEILING LIGHT (decorative, always shown) ── */}
                <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "2px", height: "10%", background: "#C4A882" }} />
                <div style={{ position: "absolute", top: "9%", left: "50%", transform: "translateX(-50%)", width: "9%", height: "5%", background: "#FEF3C7", border: "2px solid #D4A820", borderRadius: "0 0 40% 40%", boxShadow: "0 0 14px 6px rgba(255,230,100,0.35)" }} />

                {/* ── WINDOW (top-left) ── */}
                <div style={{ position: "absolute", top: "6%", left: "3%", width: "18%", height: "38%", background: "#B8DEFF", border: "4px solid #8B5E2A", borderRadius: "3px", overflow: "hidden" }}>
                  {/* Sky gradient */}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #87CEEB 0%, #C8E8FF 100%)" }} />
                  {/* Sun */}
                  <div style={{ position: "absolute", top: "10%", right: "15%", width: "20%", aspectRatio: "1", background: "#FFD700", borderRadius: "50%", boxShadow: "0 0 8px 3px rgba(255,215,0,0.4)" }} />
                  {/* Cross dividers */}
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: "3px", background: "#8B5E2A", transform: "translateX(-50%)", zIndex: 1 }} />
                  <div style={{ position: "absolute", left: 0, right: 0, top: "48%", height: "3px", background: "#8B5E2A", zIndex: 1 }} />
                  {/* Curtains */}
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "18%", background: "rgba(255,100,100,0.45)", zIndex: 2 }} />
                  <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "18%", background: "rgba(255,100,100,0.45)", zIndex: 2 }} />
                </div>
                {/* Windowsill */}
                <div style={{ position: "absolute", top: "44%", left: "2%", width: "21%", height: "3%", background: "#8B5E2A", borderRadius: "0 0 4px 4px", boxShadow: "0 3px 6px rgba(0,0,0,0.2)" }} />
                {/* 🌱 PLANT — on windowsill */}
                {slot(plant, 28, { position: "absolute", top: "28%", left: "4%", width: "16%", height: "17%" })}

                {/* ── POSTER FRAME (wall, left-center) ── */}
                <div style={{ position: "absolute", top: "6%", left: "24%", width: "12%", height: "22%", background: "#F5F0E8", border: "3px solid #8B5E2A", borderRadius: "2px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "2px 2px 6px rgba(0,0,0,0.15)" }}>
                  {/* Inner mat */}
                  <div style={{ position: "absolute", inset: "4px", border: "1.5px solid #D4C4A0", borderRadius: "1px" }} />
                  {!poster.unlocked && <span style={{ fontSize: "8px", color: "#C4A882", fontWeight: 700 }}>?</span>}
                </div>
                {/* 🌈 POSTER — inside frame */}
                {slot(poster, 22, { position: "absolute", top: "7%", left: "24.5%", width: "11%", height: "20%" })}

                {/* ── CHALKBOARD (center wall) ── */}
                <div style={{ position: "absolute", top: "5%", left: "39%", width: "26%", height: "32%", background: "#2D5A27", border: "5px solid #8B5E2A", borderRadius: "3px", boxShadow: "inset 0 0 10px rgba(0,0,0,0.3), 2px 3px 10px rgba(0,0,0,0.2)" }}>
                  {/* Chalk tray */}
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "12%", background: "#6B3E10" }} />
                  {/* Chalk writing */}
                  <div style={{ position: "absolute", inset: "10% 8% 16%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px" }}>
                    <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "7px", fontFamily: "'Baloo 2', cursive", fontWeight: 700, letterSpacing: "2px" }}>A B C</span>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "5px", fontFamily: "'Baloo 2', cursive" }}>1 2 3</span>
                  </div>
                </div>
                {/* 👑 CROWN — above chalkboard, hanging from ceiling */}
                <div style={{ position: "absolute", top: 0, left: "47%", width: "8%", height: "6%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: "1px", height: "60%", background: "#C4A882" }} />
                </div>
                {slot(crown, 22, { position: "absolute", top: "2%", left: "44%", width: "14%", height: "10%" })}

                {/* ── STAR MOBILE (ceiling, right) ── */}
                <div style={{ position: "absolute", top: 0, left: "70%", width: "2px", height: "8%", background: "#C4A882", marginLeft: "3%" }} />
                {slot(mobile, 26, { position: "absolute", top: "3%", left: "67%", width: "10%", height: "20%" })}

                {/* ── WALL SHELF (right side) ── */}
                <div style={{ position: "absolute", top: "24%", right: "3%", width: "22%", height: "4%", background: "#8B5E2A", borderRadius: "2px", boxShadow: "0 4px 8px rgba(0,0,0,0.25)" }} />
                <div style={{ position: "absolute", top: "28%", right: "3%", width: "22%", height: "1.5%", background: "#6B3E10" }} />
                {/* Shelf brackets */}
                <div style={{ position: "absolute", top: "24%", right: "5%", width: "1.5%", height: "8%", background: "#6B3E10", borderRadius: "0 0 2px 2px" }} />
                <div style={{ position: "absolute", top: "24%", right: "21%", width: "1.5%", height: "8%", background: "#6B3E10", borderRadius: "0 0 2px 2px" }} />
                {/* 🏆 TROPHY — on shelf */}
                {slot(trophy, 28, { position: "absolute", top: "10%", right: "5%", width: "18%", height: "15%" })}

                {/* ── BOOKCASE (right wall, floor-standing) ── */}
                <div style={{ position: "absolute", top: "34%", right: "3%", width: "20%", height: "37%", background: "#A0724A", border: "3px solid #7B4F28", borderRadius: "3px 3px 0 0", boxShadow: "inset 0 0 6px rgba(0,0,0,0.2)" }}>
                  {/* Internal shelves */}
                  <div style={{ position: "absolute", top: "33%", left: 0, right: 0, height: "3px", background: "#7B4F28" }} />
                  <div style={{ position: "absolute", top: "66%", left: 0, right: 0, height: "3px", background: "#7B4F28" }} />
                  {/* Back panel */}
                  <div style={{ position: "absolute", inset: "3px", background: "#C4956A" }} />
                  {/* Shelf dividers */}
                  <div style={{ position: "absolute", top: "33%", left: 0, right: 0, height: "3px", background: "#7B4F28", zIndex: 1 }} />
                  <div style={{ position: "absolute", top: "66%", left: 0, right: 0, height: "3px", background: "#7B4F28", zIndex: 1 }} />
                </div>
                {/* 📚 BOOKS — inside bookcase */}
                {books.unlocked ? (
                  <div style={{ position: "absolute", top: "36%", right: "4%", width: "17%", height: "34%", display: "flex", alignItems: "flex-end", gap: "1px", padding: "2px 3px 3px" }}>
                    {["#EF4444","#3B82F6","#22C55E","#F59E0B","#8B5CF6","#EC4899"].map((c, i) => (
                      <div key={i} style={{ flex: 1, height: `${65 + (i % 3) * 12}%`, background: c, borderRadius: "1px 1px 0 0", opacity: 0.85 }} />
                    ))}
                  </div>
                ) : (
                  <button onClick={() => setLockedDecor(books)} style={{ position: "absolute", top: "36%", right: "4%", width: "17%", height: "34%", background: "rgba(255,255,255,0.2)", border: "2px dashed rgba(0,0,0,0.15)", borderRadius: "4px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1px" }}>
                    <span style={{ fontSize: "14px", filter: "grayscale(1) opacity(0.2)" }}>📚</span>
                    <span style={{ fontSize: "10px" }}>🔒</span>
                  </button>
                )}

                {/* ── DESK (floor, center) ── */}
                {/* Desk surface */}
                <div style={{ position: "absolute", bottom: "29%", left: "25%", width: "42%", height: "5%", background: "#C49A6C", border: "2px solid #8B6338", borderRadius: "3px 3px 0 0", boxShadow: "0 3px 0 #8B6338, inset 0 1px 0 rgba(255,255,255,0.3)" }} />
                {/* Desk front panel */}
                <div style={{ position: "absolute", bottom: "30%", left: "25.5%", width: "41%", height: "0", borderBottom: "calc(100% * 0.07) solid #A0724A", transform: "translateY(100%)" }}>
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, bottom: 0, background: "#A0724A", border: "2px solid #7B4F28", borderTop: "none", borderRadius: "0 0 3px 3px" }} />
                </div>
                {/* Desk front panel (simpler approach) */}
                <div style={{ position: "absolute", bottom: "30%", left: "25%", width: "42%", height: "14%", background: "#A0724A", border: "2px solid #7B4F28", borderTop: "none", borderRadius: "0 0 3px 3px", transform: "translateY(100%)" }} />
                {/* Desk legs */}
                <div style={{ position: "absolute", bottom: "30%", left: "26%", width: "2%", height: "14%", background: "#7B4F28", transform: "translateY(100%)" }} />
                <div style={{ position: "absolute", bottom: "30%", right: "33%", width: "2%", height: "14%", background: "#7B4F28", transform: "translateY(100%)" }} />
                {/* 🎵 MUSIC — on desk */}
                {slot(music, 26, { position: "absolute", bottom: "33%", left: "27%", width: "14%", height: "12%" })}
                {/* Pencil holder (decorative, always shown) */}
                <div style={{ position: "absolute", bottom: "34%", left: "52%", width: "4%", height: "7%", background: "#EF4444", borderRadius: "2px 2px 0 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: "30%", height: "90%", background: "#FBBF24", borderRadius: "1px" }} />
                </div>

                {/* ── EASEL (floor, left) ── */}
                {/* Canvas frame */}
                <div style={{ position: "absolute", bottom: "34%", left: "5%", width: "15%", height: "22%", background: "#FFFBF0", border: "3px solid #8B5E2A", borderRadius: "2px", boxShadow: "2px 2px 6px rgba(0,0,0,0.15)" }} />
                {/* Easel left leg */}
                <div style={{ position: "absolute", bottom: "30%", left: "6.5%", width: "2px", height: "16%", background: "#8B5E2A", transform: "rotate(-12deg)", transformOrigin: "top center" }} />
                {/* Easel right leg */}
                <div style={{ position: "absolute", bottom: "30%", left: "17%", width: "2px", height: "16%", background: "#8B5E2A", transform: "rotate(12deg)", transformOrigin: "top center" }} />
                {/* Easel center support */}
                <div style={{ position: "absolute", bottom: "36%", left: "9%", width: "7%", height: "2px", background: "#8B5E2A" }} />
                {/* 🎨 CANVAS — on easel */}
                {slot(canvas, 26, { position: "absolute", bottom: "35%", left: "5%", width: "15%", height: "22%" })}

                {/* Child avatar (decorative, always shown) */}
                <div style={{ position: "absolute", bottom: "30%", left: "42%", fontSize: "28px", lineHeight: 1 }}>
                  {child.avatar}
                </div>

              </div>
            </div>

            {/* ── DECORATION CHECKLIST ── */}
            <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "16px", fontWeight: 800, color: "#1E3A5F", marginBottom: "12px" }}>
              {lang === "sw" ? "Mapambo yote" : "All Decorations"}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingBottom: "32px" }}>
              {DECORATIONS.map((d) => (
                <div key={d.id} onClick={() => !d.unlocked && setLockedDecor(d)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", background: d.unlocked ? "#F0FDF4" : "white", borderRadius: "14px", border: `1.5px solid ${d.unlocked ? "#86EFAC" : "#F3F4F6"}`, cursor: d.unlocked ? "default" : "pointer" }}>
                  <span style={{ fontSize: "26px", filter: d.unlocked ? "none" : "grayscale(1) opacity(0.35)" }}>{d.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "14px", fontWeight: 800, color: d.unlocked ? "#15803D" : "#374151", margin: 0 }}>
                      {lang === "sw" ? d.nameSw : d.nameEn}
                    </p>
                    <p style={{ fontSize: "12px", color: "#9CA3AF", margin: 0 }}>
                      {lang === "sw" ? d.unlockSw : d.unlockEn}
                    </p>
                  </div>
                  {d.unlocked
                    ? <div style={{ width: "26px", height: "26px", background: "#22C55E", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ color: "white", fontSize: "13px", fontWeight: 900 }}>✓</span></div>
                    : <span style={{ fontSize: "16px", flexShrink: 0 }}>🔒</span>}
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Locked decoration popup */}
        {lockedDecor && (
          <>
            <div onClick={() => setLockedDecor(null)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} />
            <div style={{ position: "fixed", top: "50%", left: "50%", zIndex: 201, width: "min(300px, calc(100vw - 48px))", background: "white", borderRadius: "24px", padding: "32px 24px 24px", textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,0.3)", animation: "decorPop 0.35s ease-out forwards" }}>
              <div style={{ width: "72px", height: "72px", background: "#F3F4F6", borderRadius: "16px", border: "2px dashed #D1D5DB", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", gap: "2px" }}>
                <span style={{ fontSize: "28px", filter: "grayscale(1) opacity(0.3)" }}>{lockedDecor.emoji}</span>
                <span style={{ fontSize: "14px" }}>🔒</span>
              </div>
              <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", fontWeight: 800, color: "#1E3A8A", margin: "0 0 8px" }}>
                {lang === "sw" ? lockedDecor.nameSw : lockedDecor.nameEn}
              </p>
              <p style={{ fontSize: "14px", color: "#6B7280", lineHeight: 1.6, margin: "0 0 20px" }}>
                {lang === "sw" ? lockedDecor.unlockSw : lockedDecor.unlockEn}
              </p>
              <button onClick={() => setLockedDecor(null)} style={{ background: "#FF8C00", color: "white", border: "none", borderRadius: "9999px", padding: "13px 32px", fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "15px", cursor: "pointer", boxShadow: "0 4px 0 #CC6A00", width: "100%" }}>
                {t.myRoomLockedBtn}
              </button>
            </div>
          </>
        )}
      </main>
    );
  }

  // ── Dashboard view ─────────────────────────────────────────────────────────
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(160deg, #A4C4F8 0%, #D4B4F8 50%, #F8B4D4 100%)", fontFamily: "'Nunito', sans-serif", overflowX: "hidden" }}>

      {/* Header */}
      <div className="app-page" style={{ padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => router.push("/dashboard")} style={{ width: "44px", height: "44px", borderRadius: "50%", background: "rgba(255,255,255,0.85)", border: "none", cursor: "pointer", fontSize: "20px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>
            🏠
          </button>
          <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "22px", fontWeight: 800, color: "white", textShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>
            {t.hello(child.name)}
          </h1>
          <button onClick={() => router.push(`/progress/${child.id}`)} style={{ width: "44px", height: "44px", borderRadius: "50%", background: "rgba(255,255,255,0.85)", border: "none", cursor: "pointer", fontSize: "20px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>
            🏆
          </button>
        </div>
      </div>

      {/* Badge grid — 4 × 2 round medals */}
      <style>{`
        @keyframes badgeGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.6); } 50% { box-shadow: 0 0 0 6px rgba(255,255,255,0); } }
        @keyframes badgePop  { 0% { transform: scale(0.7); opacity: 0; } 70% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
      `}</style>
      <div className="app-page" style={{ padding: "16px 20px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
          {BADGES.map((badge) => (
            <button
              key={badge.nameEn}
              onClick={() => !badge.unlocked && setLockedBadge(badge)}
              style={{ background: "none", border: "none", cursor: badge.unlocked ? "default" : "pointer", padding: 0 }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "7px" }}>
                {/* Medal circle */}
                <div style={{
                  width: "58px", height: "58px", borderRadius: "50%", position: "relative",
                  background: badge.unlocked
                    ? `radial-gradient(circle at 35% 35%, ${badge.color}EE, ${badge.color}99)`
                    : "rgba(255,255,255,0.15)",
                  border: badge.unlocked ? `3px solid ${badge.color}` : "2.5px dashed rgba(255,255,255,0.3)",
                  boxShadow: badge.unlocked ? `0 4px 16px ${badge.color}55, inset 0 1px 0 rgba(255,255,255,0.35)` : "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  animation: badge.unlocked ? "badgeGlow 2.5s ease-in-out infinite" : "none",
                }}>
                  {badge.unlocked ? (
                    <LottieEmoji emoji={badge.emoji} size={34} />
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1px" }}>
                      <span style={{ fontSize: "18px", lineHeight: 1, filter: "grayscale(1) opacity(0.4)" }}>{badge.emoji}</span>
                      <span style={{ fontSize: "10px", lineHeight: 1 }}>🔒</span>
                    </div>
                  )}
                  {/* Green checkmark for unlocked */}
                  {badge.unlocked && (
                    <div style={{ position: "absolute", bottom: "-2px", right: "-2px", width: "18px", height: "18px", background: "#22C55E", borderRadius: "50%", border: "2px solid white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: "9px", color: "white", fontWeight: 900, lineHeight: 1 }}>✓</span>
                    </div>
                  )}
                </div>
                {/* Name */}
                <p style={{
                  fontFamily: "'Baloo 2', cursive", fontSize: "9px", fontWeight: 800,
                  color: badge.unlocked ? "white" : "rgba(255,255,255,0.4)",
                  margin: 0, textAlign: "center", lineHeight: 1.2,
                  width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  textShadow: badge.unlocked ? "0 1px 3px rgba(0,0,0,0.2)" : "none",
                }}>
                  {lang === "sw" ? badge.nameSw : badge.nameEn}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Locked badge popup */}
      {lockedBadge && (
        <>
          <div onClick={() => setLockedBadge(null)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 201, width: "min(300px, calc(100vw - 48px))", background: "white", borderRadius: "24px", padding: "28px 24px 24px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", animation: "badgePop 0.35s ease-out forwards" }}>
            {/* Greyed medal */}
            <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "#F3F4F6", border: "3px dashed #D1D5DB", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", gap: "2px" }}>
              <span style={{ fontSize: "24px", filter: "grayscale(1) opacity(0.4)" }}>{lockedBadge.emoji}</span>
              <span style={{ fontSize: "14px" }}>🔒</span>
            </div>
            <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", fontWeight: 800, color: "#1E3A8A", margin: "0 0 8px" }}>
              {lang === "sw" ? lockedBadge.nameSw : lockedBadge.nameEn}
            </p>
            <p style={{ fontSize: "14px", color: "#6B7280", lineHeight: 1.6, margin: "0 0 20px" }}>
              {lang === "sw" ? lockedBadge.hintSw : lockedBadge.hintEn}
            </p>
            <button
              onClick={() => setLockedBadge(null)}
              style={{ background: "#FF8C00", color: "white", border: "none", borderRadius: "9999px", padding: "12px 32px", fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "15px", cursor: "pointer", boxShadow: "0 4px 0 #CC6A00", width: "100%" }}
            >
              {lang === "sw" ? "Sawa! Nitajaribu! 💪" : "Got it! Let's go! 💪"}
            </button>
          </div>
        </>
      )}

      {/* Stats cards row */}
      <div className="app-page" style={{ padding: "24px 20px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
          {/* Day Streak */}
          <div style={{ background: "white", borderRadius: "20px", padding: "18px 12px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
            <div style={{ width: "42px", height: "42px", background: "#FF8C00", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", marginBottom: "10px" }}>🔥</div>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#9CA3AF", margin: "0 0 4px", letterSpacing: "0.03em" }}>{t.dayStreak}</p>
            <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "14px", fontWeight: 800, color: "#FF8C00", margin: 0 }}>
              {child.streak > 0 ? t.streakDays(child.streak) : t.startToday}
            </p>
          </div>

          {/* Your Level */}
          <div style={{ background: "white", borderRadius: "20px", padding: "18px 12px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
            <div style={{ width: "42px", height: "42px", background: "#22C55E", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", marginBottom: "10px" }}>✨</div>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#9CA3AF", margin: "0 0 4px", letterSpacing: "0.03em" }}>{t.yourLevel}</p>
            <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "14px", fontWeight: 800, color: "#22C55E", margin: "0 0 4px" }}>
              {t.level(levelNum)}
            </p>
            <p style={{ fontSize: "10px", fontWeight: 700, color: starsToNext === null ? "#F59E0B" : "#9CA3AF", margin: 0, lineHeight: 1.3 }}>
              {starsToNext === null ? t.maxLevel : t.starsToNext(starsToNext)}
            </p>
          </div>

          {/* Today */}
          <div style={{ background: "white", borderRadius: "20px", padding: "18px 12px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
            <div style={{ width: "42px", height: "42px", background: "#4B8BF5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", marginBottom: "10px" }}>🏆</div>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#9CA3AF", margin: "0 0 5px", letterSpacing: "0.03em" }}>{t.today}</p>
            <div style={{ height: "6px", background: "#F3F4F6", borderRadius: "9999px", overflow: "hidden", marginBottom: "5px" }}>
              <div style={{ height: "100%", background: "#4B8BF5", borderRadius: "9999px", width: `${todayPct}%`, transition: "width 0.5s" }} />
            </div>
            <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "12px", fontWeight: 800, color: "#4B8BF5", margin: 0 }}>{t.pctDone(todayPct)}</p>
          </div>
        </div>
      </div>

      {/* Family rank widget (siblings only) */}
      {siblings.length > 0 && (() => {
        const allChildren = [...siblings, { id: childId, name: child.name, avatar: child.avatar, xp: child.xp }]
          .sort((a, b) => b.xp - a.xp);
        const myRank = allChildren.findIndex(c => c.id === childId);
        const leader = myRank > 0 ? allChildren[0] : null;
        const gap    = leader ? leader.xp - child.xp : 0;
        return (
          <div className="app-page" style={{ padding: "18px 20px 0" }}>
            <div style={{ background: myRank === 0 ? "linear-gradient(135deg, #FEF3C7, #FDE68A)" : "rgba(255,255,255,0.85)", borderRadius: "18px", padding: "14px 18px", display: "flex", alignItems: "center", gap: "14px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
              <span style={{ fontSize: "28px" }}>{myRank === 0 ? "🏆" : ["🥇","🥈","🥉"][myRank] || `#${myRank+1}`}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "13px", fontWeight: 800, color: "#1E3A5F", margin: 0 }}>
                  {myRank === 0 ? t.familyRank1 : t.familyRankN(leader!.name, gap)}
                </p>
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                {allChildren.map((s, i) => (
                  <div key={s.id} title={s.name} style={{ width: "28px", height: "28px", borderRadius: "50%", background: s.id === childId ? "#FF8C00" : "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", border: s.id === childId ? "2px solid #CC6A00" : "2px solid rgba(255,255,255,0.5)", position: "relative" }}>
                    {s.avatar}
                    {i === 0 && <span style={{ position: "absolute", top: "-6px", right: "-4px", fontSize: "10px" }}>👑</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Daily challenge banner */}
      <div className="app-page" style={{ padding: "18px 20px 0" }}>
        <div style={{ background: challenge.gradient, borderRadius: "24px", padding: "20px 20px 22px", boxShadow: "0 8px 28px rgba(0,0,0,0.2)", position: "relative", overflow: "hidden" }}>
          {/* Subtle shine overlay */}
          <div style={{ position: "absolute", top: "-30%", right: "-10%", width: "50%", aspectRatio: "1", background: "rgba(255,255,255,0.12)", borderRadius: "50%" }} />

          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <div style={{ width: "38px", height: "38px", background: "rgba(255,255,255,0.25)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>
              {challengeDone ? "✅" : challenge.emoji}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.75)", margin: 0, letterSpacing: "0.05em", textTransform: "uppercase" }}>{lang === "sw" ? "Changamoto ya Leo!" : "Today's Challenge!"}</p>
              <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "17px", fontWeight: 800, color: "white", margin: 0 }}>
                {lang === "sw" ? challenge.titleSw : challenge.titleEn}
              </p>
            </div>
            {challengeDone && (
              <div style={{ background: "rgba(255,255,255,0.25)", borderRadius: "9999px", padding: "4px 10px" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "white" }}>DONE!</span>
              </div>
            )}
          </div>

          {/* Body card */}
          <div style={{ background: "rgba(255,255,255,0.18)", borderRadius: "14px", padding: "13px 15px" }}>
            <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "14px", fontWeight: 800, color: "white", margin: "0 0 5px" }}>
              {challengeDone
                ? (lang === "sw" ? challenge.doneSw : challenge.doneEn)
                : (lang === "sw" ? challenge.descSw : challenge.descEn)}
            </p>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.85)", margin: "0 0 10px" }}>
              {challengeDone
                ? (lang === "sw" ? "Siku njema! Rudi kesho kwa changamoto mpya! 🌟" : "Come back tomorrow for a new challenge! 🌟")
                : challenge.value === 0
                  ? (lang === "sw" ? challenge.startSw : challenge.startEn)
                  : (lang === "sw"
                      ? (challenge.progSw as (v: number, g: number) => string)(challenge.value, challenge.target)
                      : (challenge.progEn as (v: number, g: number) => string)(challenge.value, challenge.target))}
            </p>
            <div style={{ height: "8px", background: "rgba(255,255,255,0.25)", borderRadius: "9999px", overflow: "hidden" }}>
              <div style={{ height: "100%", background: challengeDone ? "rgba(255,255,255,0.95)" : "white", borderRadius: "9999px", width: `${challengePct}%`, transition: "width 0.6s ease" }} />
            </div>
            {!challengeDone && challenge.target > 1 && (
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.65)", margin: "5px 0 0", textAlign: "right" }}>{challenge.value} / {challenge.target}</p>
            )}
          </div>
        </div>
      </div>

      {/* Let's Play & Learn */}
      <div className="app-page" style={{ padding: "22px 20px 48px" }}>
        <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "20px", fontWeight: 800, color: "white", marginBottom: "16px", textShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>
          {t.letsPlay}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          {/* Learn with Ticha */}
          <button onClick={() => setView("topics")} style={{ background: "white", borderRadius: "22px", padding: "24px 18px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.09)", transition: "transform 0.15s, box-shadow 0.15s", textAlign: "left" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 10px 28px rgba(0,0,0,0.14)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.09)"; }}
          >
            <div style={{ width: "56px", height: "56px", background: "#4B8BF5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 0 #2563EB" }}>
              <svg viewBox="0 0 24 24" fill="none" width="26" height="26">
                <rect x="9" y="2" width="6" height="11" rx="3" fill="white"/>
                <path d="M5 11a7 7 0 0 0 14 0" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                <line x1="12" y1="18" x2="12" y2="22" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                <line x1="8" y1="22" x2="16" y2="22" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "15px", fontWeight: 800, color: "#4B8BF5", margin: "0 0 4px" }}>{t.learnWithTicha}</p>
              <p style={{ fontSize: "12px", color: "#9CA3AF", margin: 0 }}>{t.learnWithTichaSub}</p>
            </div>
          </button>

          {/* Word Games */}
          <button onClick={() => setView("quiz")} disabled={quizCooldown} style={{ background: quizCooldown ? "#F3F4F6" : "white", borderRadius: "22px", padding: "24px 18px", border: "none", cursor: quizCooldown ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.09)", transition: "transform 0.15s, box-shadow 0.15s", textAlign: "left", opacity: quizCooldown ? 0.6 : 1 }}
            onMouseEnter={(e) => { if (!quizCooldown) { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 10px 28px rgba(0,0,0,0.14)"; } }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.09)"; }}
          >
            <div style={{ width: "56px", height: "56px", background: "#22C55E", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 0 #16A34A" }}>
              <svg viewBox="0 0 24 24" fill="none" width="26" height="26">
                <rect x="2" y="6" width="20" height="12" rx="4" stroke="white" strokeWidth="2.2"/>
                <circle cx="8" cy="12" r="2" fill="white"/>
                <line x1="16" y1="10" x2="16" y2="14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                <line x1="14" y1="12" x2="18" y2="12" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "15px", fontWeight: 800, color: "#22C55E", margin: "0 0 4px" }}>{t.wordGames}</p>
              <p style={{ fontSize: "12px", color: "#9CA3AF", margin: 0 }}>{t.wordGamesSub}</p>
            </div>
          </button>
        </div>

        {/* My Room button */}
          <button onClick={() => setView("room")} style={{ width: "100%", marginTop: "14px", background: "white", borderRadius: "22px", padding: "18px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.09)", transition: "transform 0.15s, box-shadow 0.15s", textAlign: "left" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 10px 28px rgba(0,0,0,0.14)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.09)"; }}
          >
            <div style={{ width: "56px", height: "56px", background: "#F59E0B", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 0 #D97706", fontSize: "28px" }}>
              🏫
            </div>
            <div>
              <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "15px", fontWeight: 800, color: "#F59E0B", margin: "0 0 4px" }}>{t.myRoom}</p>
              <p style={{ fontSize: "12px", color: "#9CA3AF", margin: 0 }}>{t.myRoomSub}</p>
            </div>
          </button>

        {/* Quick stats footer */}
        <div style={{ marginTop: "14px", background: "rgba(255,255,255,0.45)", borderRadius: "16px", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "32px", height: "32px", background: "#FEF3C7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", border: "2px solid #F59E0B" }}>
              {child.avatar}
            </div>
            <div>
              <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "12px", fontWeight: 800, color: "#1E3A8A", margin: 0 }}>{child.name}</p>
              <p style={{ fontSize: "10px", color: "#6B7280", margin: 0 }}>{t.stars(child.xp)}</p>
            </div>
          </div>
          <button onClick={() => router.push(`/progress/${child.id}`)} style={{ fontSize: "11px", fontWeight: 700, color: "#6B7280", background: "rgba(255,255,255,0.7)", border: "none", borderRadius: "9999px", padding: "5px 12px", cursor: "pointer" }}>
            {t.progress}
          </button>
        </div>
      </div>

      {/* ── Level-Up Celebration Modal ── */}
      {showLevelUp && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px" }}>
          {/* Backdrop */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, #047857 0%, #1E3A8A 100%)", opacity: 0.97 }} />

          {/* Confetti layer */}
          <style>{`
            @keyframes confettiFall {
              0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
              100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
            }
            @keyframes levelUpPop {
              0%   { transform: scale(0.5); opacity: 0; }
              60%  { transform: scale(1.12); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
          `}</style>
          {[...Array(30)].map((_, i) => (
            <div key={i} style={{
              position: "absolute",
              top: "-20px",
              left: `${(i * 3.4) % 100}%`,
              width: `${8 + (i % 5) * 3}px`,
              height: `${8 + (i % 5) * 3}px`,
              background: ["#FCD34D","#34D399","#60A5FA","#F87171","#A78BFA","#FB923C","#F472B6"][i % 7],
              borderRadius: i % 3 === 0 ? "50%" : "2px",
              animation: `confettiFall ${1.8 + (i % 6) * 0.25}s ${(i % 8) * 0.15}s ease-in both`,
              pointerEvents: "none",
            }} />
          ))}

          {/* Card */}
          <div style={{ position: "relative", textAlign: "center", maxWidth: "340px", width: "100%", animation: "levelUpPop 0.5s ease-out forwards" }}>
            <div style={{ fontSize: "80px", marginBottom: "8px", lineHeight: 1 }}>🏆</div>
            <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "32px", fontWeight: 800, color: "#FCD34D", marginBottom: "8px", textShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
              {t.levelUpTitle(newLevel)}
            </h1>
            <p style={{ fontSize: "18px", color: "white", marginBottom: "8px", fontWeight: 700 }}>
              {child.name}! 🌟
            </p>
            <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.8)", marginBottom: "32px", lineHeight: 1.6 }}>
              {t.levelUpDesc}
            </p>
            <button
              onClick={() => setShowLevelUp(false)}
              style={{ background: "#FF8C00", color: "white", border: "none", borderRadius: "9999px", padding: "16px 48px", fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "18px", cursor: "pointer", boxShadow: "0 6px 0 #CC6A00, 0 10px 28px rgba(255,140,0,0.4)" }}
            >
              {t.levelUpBtn}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
