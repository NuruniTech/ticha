"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Child } from "@/types";
import TichaAvatar from "@/components/TichaAvatar";
import QuizOverlay from "@/components/QuizOverlay";
import type { QuizWord } from "@/components/QuizOverlay";

// Shared word lists (kept in sync with VoiceSession)
const WORD_LISTS: Record<string, QuizWord[]> = {
  animals: [
    { sw: "simba",   en: "lion"     }, { sw: "tembo",   en: "elephant" },
    { sw: "twiga",   en: "giraffe"  }, { sw: "mbwa",    en: "dog"      },
    { sw: "paka",    en: "cat"      }, { sw: "ndege",   en: "bird"     },
    { sw: "mbuzi",   en: "goat"     }, { sw: "ng'ombe", en: "cow"      },
    { sw: "punda",   en: "donkey"   }, { sw: "farasi",  en: "horse"    },
    { sw: "kondoo",  en: "sheep"    }, { sw: "kuku",    en: "chicken"  },
    { sw: "bata",    en: "duck"     }, { sw: "kasuku",  en: "parrot"   },
  ],
  numbers: [
    { sw: "moja",  en: "one"   }, { sw: "mbili", en: "two"   },
    { sw: "tatu",  en: "three" }, { sw: "nne",   en: "four"  },
    { sw: "tano",  en: "five"  }, { sw: "sita",  en: "six"   },
    { sw: "saba",  en: "seven" }, { sw: "nane",  en: "eight" },
    { sw: "tisa",  en: "nine"  }, { sw: "kumi",  en: "ten"   },
  ],
  colors: [
    { sw: "nyekundu",  en: "red"    }, { sw: "bluu",     en: "blue"   },
    { sw: "njano",     en: "yellow" }, { sw: "kijani",   en: "green"  },
    { sw: "nyeupe",    en: "white"  }, { sw: "nyeusi",   en: "black"  },
    { sw: "waridi",    en: "pink"   }, { sw: "zambarau", en: "purple" },
    { sw: "kahawia",   en: "brown"  }, { sw: "kijivu",   en: "gray"   },
  ],
  body: [
    { sw: "kichwa",  en: "head"    }, { sw: "jicho",   en: "eye"     },
    { sw: "masikio", en: "ears"    }, { sw: "pua",     en: "nose"    },
    { sw: "mdomo",   en: "mouth"   }, { sw: "mkono",   en: "hand"    },
    { sw: "kidole",  en: "finger"  }, { sw: "tumbo",   en: "stomach" },
    { sw: "mguu",    en: "leg"     }, { sw: "mgongo",  en: "back"    },
  ],
  people: [
    // Level 1 — immediate family
    { sw: "mama",       en: "mother"        }, { sw: "baba",       en: "father"        },
    { sw: "kaka",       en: "brother"       }, { sw: "dada",       en: "sister"        },
    { sw: "bibi",       en: "grandmother"   },
    // Level 2 — extended family + close community
    { sw: "babu",       en: "grandfather"   }, { sw: "mtoto",      en: "child / baby"  },
    { sw: "rafiki",     en: "friend"        }, { sw: "mjomba",     en: "uncle"         },
    { sw: "shangazi",   en: "aunt"          },
    // Level 3 — school, health, church
    { sw: "binamu",     en: "cousin"        }, { sw: "jirani",     en: "neighbor"      },
    { sw: "mwalimu",    en: "teacher"       }, { sw: "mwanafunzi", en: "student"       },
    { sw: "daktari",    en: "doctor"        },
    // Level 4 — community professionals
    { sw: "muuguzi",    en: "nurse"         }, { sw: "kasisi",     en: "pastor / priest"},
    { sw: "polisi",     en: "police officer"}, { sw: "mkulima",    en: "farmer"        },
    { sw: "dereva",     en: "driver"        },
  ],
};

const GAMES = [
  { id: "animals", label: "Animals",    sub: "Wanyama", emoji: "🦁", bg: "#FF8C00", shadow: "rgba(255,140,0,0.35)"  },
  { id: "colors",  label: "Colors",     sub: "Rangi",   emoji: "🎨", bg: "#9B59F5", shadow: "rgba(155,89,245,0.35)" },
  { id: "numbers", label: "Numbers",    sub: "Nambari", emoji: "🔢", bg: "#4B8BF5", shadow: "rgba(75,139,245,0.35)" },
  { id: "body",    label: "Body Parts", sub: "Mwili",   emoji: "🫀", bg: "#EF4444", shadow: "rgba(239,68,68,0.35)"  },
  { id: "people",  label: "People",     sub: "Watu",    emoji: "👨‍👩‍👧‍👦", bg: "#22C55E", shadow: "rgba(34,197,94,0.35)"  },
];

type View = "dashboard" | "topics" | "quiz";

export default function ChildPage() {
  const router  = useRouter();
  const params  = useParams();
  const childId = params.id as string;

  const [child,    setChild]    = useState<Child | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [game,     setGame]     = useState("animals");
  const [view,     setView]     = useState<View>("dashboard");
  const [todayStars, setTodayStars] = useState(0);

  const loadData = useCallback(async () => {
    const { data } = await supabase.from("children").select("*").eq("id", childId).single();
    if (!data) { router.push("/dashboard"); return; }
    setChild(data);

    // Today's earned Stars
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: sessions } = await supabase
      .from("sessions").select("xp_earned")
      .eq("child_id", childId)
      .gte("created_at", todayStart.toISOString());
    const earned = (sessions || []).reduce((s: number, r: { xp_earned?: number }) => s + (r.xp_earned || 0), 0);
    setTodayStars(earned);
    setLoading(false);
  }, [childId, router]);

  useEffect(() => { loadData(); }, [loadData]);

  function startSession() {
    if (!child) return;
    const p = new URLSearchParams({
      name: child.name, lang: child.primary_language, game, childId: child.id,
      ...(child.age ? { age: String(child.age) } : {}),
      ...(child.xp  ? { xp:  String(child.xp)  } : {}),
    });
    router.push(`/session?${p.toString()}`);
  }

  if (loading || !child) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #A4C4F8 0%, #D4B4F8 50%, #F8B4D4 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <TichaAvatar state="connecting" size={90} />
    </div>
  );

  // ── Quiz view ──────────────────────────────────────────────────────────────
  if (view === "quiz") {
    const quizWords = (WORD_LISTS[game] || WORD_LISTS.animals).slice(0, 5);
    return (
      <QuizOverlay
        words={quizWords}
        language={child.primary_language}
        childId={child.id}
        sessionStars={0}
        onComplete={() => { setView("dashboard"); loadData(); }}
      />
    );
  }

  // ── Computed stats ─────────────────────────────────────────────────────────
  const levelNum   = child.xp < 50 ? 1 : child.xp < 150 ? 2 : child.xp < 300 ? 3 : 4;
  const todayPct   = Math.min(100, Math.round((todayStars / 50) * 100));
  const wordsGoal  = 5;
  const wordsDone  = Math.min(wordsGoal, Math.floor(todayStars / 10));
  const langLabel  = child.primary_language === "sw" ? "Swahili" : "English";

  // ── Topics view ────────────────────────────────────────────────────────────
  if (view === "topics") {
    return (
      <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Nunito', sans-serif" }}>
        <div style={{ background: "linear-gradient(160deg, #A4C4F8 0%, #D4B4F8 50%, #F8B4D4 100%)", padding: "20px 20px 44px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: "480px", margin: "0 auto", marginBottom: "16px" }}>
            <button onClick={() => setView("dashboard")} style={{ width: "40px", height: "40px", borderRadius: "12px", background: "rgba(255,255,255,0.8)", border: "none", cursor: "pointer", fontSize: "18px" }}>←</button>
            <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "20px", fontWeight: 800, color: "#1E3A8A" }}>Choose a Topic! ⭐</h1>
            <div style={{ width: "40px" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <TichaAvatar state="idle" size={100} />
            <div style={{ background: "white", borderRadius: "20px", padding: "10px 20px", marginTop: "10px", boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#374151" }}>What shall we learn today, {child.name}? 🎯</span>
            </div>
          </div>
        </div>
        <div style={{ background: "white", flex: 1, borderRadius: "28px 28px 0 0", marginTop: "-24px", padding: "24px 20px 40px", zIndex: 5, position: "relative" }}>
          <div style={{ maxWidth: "480px", margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
              {GAMES.map((g) => (
                <button key={g.id} onClick={() => setGame(g.id)} style={{
                  background: g.bg, borderRadius: "20px", padding: "22px 14px 18px",
                  border: game === g.id ? "3px solid white" : "3px solid transparent", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "8px",
                  boxShadow: game === g.id ? `0 8px 28px ${g.shadow}, inset 0 1px 0 rgba(255,255,255,0.3)` : `0 4px 12px ${g.shadow}`,
                  transform: game === g.id ? "scale(1.04)" : "scale(1)", transition: "all 0.18s ease", position: "relative",
                }}>
                  <span style={{ fontSize: "44px", lineHeight: 1 }}>{g.emoji}</span>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "16px", fontWeight: 800, color: "white", margin: 0, lineHeight: 1.2 }}>{g.label}</p>
                    <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)", margin: 0 }}>{g.sub}</p>
                  </div>
                  {game === g.id && (
                    <div style={{ position: "absolute", top: "10px", right: "10px", width: "22px", height: "22px", background: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px" }}>✓</div>
                  )}
                </button>
              ))}
            </div>
            <button onClick={startSession} style={{ width: "100%", padding: "16px", background: "#FF8C00", border: "none", borderRadius: "16px", color: "white", fontSize: "18px", fontWeight: 800, fontFamily: "'Baloo 2', cursive", cursor: "pointer", boxShadow: "0 5px 0 #CC6A00, 0 8px 20px rgba(255,140,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              🚀 Start with Ticha!
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Dashboard view (Figma) ─────────────────────────────────────────────────
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(160deg, #A4C4F8 0%, #D4B4F8 50%, #F8B4D4 100%)", fontFamily: "'Nunito', sans-serif", overflowX: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "20px 20px 0", maxWidth: "640px", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => router.push("/dashboard")} style={{ width: "44px", height: "44px", borderRadius: "50%", background: "rgba(255,255,255,0.85)", border: "none", cursor: "pointer", fontSize: "20px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>
            🏠
          </button>
          <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "22px", fontWeight: 800, color: "white", textShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>
            Hello, {child.name}! 👋
          </h1>
          <button onClick={() => router.push(`/progress/${child.id}`)} style={{ width: "44px", height: "44px", borderRadius: "50%", background: "rgba(255,255,255,0.85)", border: "none", cursor: "pointer", fontSize: "20px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>
            🏆
          </button>
        </div>
      </div>

      {/* Stats cards row */}
      <div style={{ padding: "20px 20px 0", maxWidth: "640px", margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
          {/* Day Streak */}
          <div style={{ background: "white", borderRadius: "18px", padding: "14px 10px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
            <div style={{ width: "36px", height: "36px", background: "#FF8C00", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", marginBottom: "8px" }}>🔥</div>
            <p style={{ fontSize: "10px", fontWeight: 700, color: "#9CA3AF", margin: "0 0 3px", letterSpacing: "0.03em" }}>Day Streak</p>
            <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "13px", fontWeight: 800, color: "#FF8C00", margin: 0 }}>
              {child.streak > 0 ? `${child.streak} Days! 🔥` : "Start today!"}
            </p>
          </div>

          {/* Your Level */}
          <div style={{ background: "white", borderRadius: "18px", padding: "14px 10px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
            <div style={{ width: "36px", height: "36px", background: "#22C55E", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", marginBottom: "8px" }}>✨</div>
            <p style={{ fontSize: "10px", fontWeight: 700, color: "#9CA3AF", margin: "0 0 3px", letterSpacing: "0.03em" }}>Your Level</p>
            <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "13px", fontWeight: 800, color: "#22C55E", margin: 0 }}>
              Level {levelNum} ⭐
            </p>
          </div>

          {/* Today */}
          <div style={{ background: "white", borderRadius: "18px", padding: "14px 10px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
            <div style={{ width: "36px", height: "36px", background: "#4B8BF5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", marginBottom: "8px" }}>🏆</div>
            <p style={{ fontSize: "10px", fontWeight: 700, color: "#9CA3AF", margin: "0 0 4px", letterSpacing: "0.03em" }}>Today</p>
            <div style={{ height: "5px", background: "#F3F4F6", borderRadius: "9999px", overflow: "hidden", marginBottom: "4px" }}>
              <div style={{ height: "100%", background: "#4B8BF5", borderRadius: "9999px", width: `${todayPct}%`, transition: "width 0.5s" }} />
            </div>
            <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "11px", fontWeight: 800, color: "#4B8BF5", margin: 0 }}>{todayPct}% Done!</p>
          </div>
        </div>
      </div>

      {/* Today's Mission banner */}
      <div style={{ padding: "16px 20px 0", maxWidth: "640px", margin: "0 auto" }}>
        <div style={{ background: "linear-gradient(135deg, #FF9500 0%, #FF3878 100%)", borderRadius: "22px", padding: "20px 20px 22px", boxShadow: "0 6px 24px rgba(255,80,100,0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
            <div style={{ width: "40px", height: "40px", background: "rgba(255,255,255,0.25)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>✨</div>
            <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", fontWeight: 800, color: "white", margin: 0 }}>Today&apos;s Mission!</p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.18)", borderRadius: "14px", padding: "14px 16px" }}>
            <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "15px", fontWeight: 800, color: "white", margin: "0 0 4px" }}>
              Learn {wordsGoal} New Words in {langLabel}
            </p>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.85)", margin: "0 0 10px" }}>
              {todayStars === 0
                ? "Start a session to begin your mission! ⚡"
                : `You've learned ${wordsDone} out of ${wordsGoal} words! Keep going! ⚡`}
            </p>
            <div style={{ height: "8px", background: "rgba(255,255,255,0.25)", borderRadius: "9999px", overflow: "hidden" }}>
              <div style={{ height: "100%", background: "white", borderRadius: "9999px", width: `${(wordsDone / wordsGoal) * 100}%`, transition: "width 0.6s" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Let's Play & Learn */}
      <div style={{ padding: "22px 20px 48px", maxWidth: "640px", margin: "0 auto" }}>
        <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", fontWeight: 800, color: "white", marginBottom: "14px", textShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>
          Let&apos;s Play &amp; Learn!
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {/* Chat with AI */}
          <button onClick={() => setView("topics")} style={{ background: "white", borderRadius: "20px", padding: "20px 16px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "14px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", transition: "transform 0.15s, box-shadow 0.15s", textAlign: "left" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.13)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; }}
          >
            <div style={{ width: "50px", height: "50px", background: "#4B8BF5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" width="24" height="24">
                <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "14px", fontWeight: 800, color: "#4B8BF5", margin: "0 0 3px" }}>Chat with AI</p>
              <p style={{ fontSize: "11px", color: "#9CA3AF", margin: 0 }}>Talk and learn together!</p>
            </div>
          </button>

          {/* Word Games */}
          <button onClick={() => setView("quiz")} style={{ background: "white", borderRadius: "20px", padding: "20px 16px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "14px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", transition: "transform 0.15s, box-shadow 0.15s", textAlign: "left" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.13)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; }}
          >
            <div style={{ width: "50px", height: "50px", background: "#22C55E", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" width="24" height="24">
                <rect x="2" y="6" width="20" height="12" rx="4" stroke="white" strokeWidth="2"/>
                <circle cx="8" cy="12" r="2" fill="white"/>
                <line x1="16" y1="10" x2="16" y2="14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <line x1="14" y1="12" x2="18" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "14px", fontWeight: 800, color: "#22C55E", margin: "0 0 3px" }}>Word Games</p>
              <p style={{ fontSize: "11px", color: "#9CA3AF", margin: 0 }}>Match pictures and words!</p>
            </div>
          </button>
        </div>

        {/* Quick stats footer */}
        <div style={{ marginTop: "14px", background: "rgba(255,255,255,0.45)", borderRadius: "16px", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "32px", height: "32px", background: "#FEF3C7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", border: "2px solid #F59E0B" }}>
              {child.avatar}
            </div>
            <div>
              <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "12px", fontWeight: 800, color: "#1E3A8A", margin: 0 }}>{child.name}</p>
              <p style={{ fontSize: "10px", color: "#6B7280", margin: 0 }}>⭐ {child.xp} Stars</p>
            </div>
          </div>
          <button onClick={() => router.push(`/progress/${child.id}`)} style={{ fontSize: "11px", fontWeight: 700, color: "#6B7280", background: "rgba(255,255,255,0.7)", border: "none", borderRadius: "9999px", padding: "5px 12px", cursor: "pointer" }}>
            📊 Progress
          </button>
        </div>
      </div>
    </main>
  );
}
