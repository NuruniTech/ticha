"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Child, Session } from "@/types";
import { useLanguage } from "@/context/LanguageContext";
import { T } from "@/lib/translations";
import { getLevel, nextLevelXp, levelProgressPct, LEVEL_META } from "@/lib/levels";

function StatCard({ emoji, value, label, color }: { emoji: string; value: string | number; label: string; color: string }) {
  return (
    <div style={{ background: "white", borderRadius: "16px", padding: "20px", textAlign: "center", boxShadow: "0 2px 12px rgba(30,58,95,0.06)" }}>
      <div style={{ fontSize: "28px", marginBottom: "6px" }}>{emoji}</div>
      <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "24px", fontWeight: 800, color }}>{value}</p>
      <p style={{ fontSize: "12px", color: "#9CA3AF", fontWeight: 600 }}>{label}</p>
    </div>
  );
}

export default function ProgressPage() {
  const router  = useRouter();
  const params  = useParams();
  const childId = params.id as string;
  const { lang } = useLanguage();
  const t = T[lang].progress;

  const [child, setChild]       = useState<Child | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [masteredWords, setMasteredWords] = useState<Set<string>>(new Set());
  const [loading, setLoading]   = useState(true);
  const [hasError, setHasError] = useState(false);
  // Which session's transcript is expanded (parent trust: see exactly what
  // Ticha and the child talked about in any lesson)
  const [openTranscript, setOpenTranscript] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/login"); return; }
        const [{ data: kid }, { data: sesh }, { data: prog }] = await Promise.all([
          supabase.from("children").select("*").eq("id", childId).eq("parent_id", user.id).single(),
          supabase.from("sessions").select("*").eq("child_id", childId).order("created_at", { ascending: false }).limit(20),
          supabase.from("progress").select("word, correct_count").eq("child_id", childId),
        ]);
        if (!kid) { router.push("/dashboard"); return; }
        setChild(kid);
        setSessions(sesh || []);
        // A word is "mastered" when answered correctly at least twice in quizzes
        const mastered = new Set<string>(
          (prog || []).filter(r => (r.correct_count || 0) >= 2).map(r => r.word)
        );
        setMasteredWords(mastered);
        setLoading(false);
      } catch (err) {
        console.error("Progress load failed:", err);
        setHasError(true);
        setLoading(false);
      }
    }
    load();
  }, [childId, router]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFBF0" }}>
      <div style={{ fontSize: "48px" }} className="animate-bounce-soft">📊</div>
    </div>
  );

  if (hasError) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFBF0", padding: "24px" }}>
      <div style={{ textAlign: "center", maxWidth: "340px" }}>
        <div style={{ fontSize: "48px", marginBottom: "12px" }}>📡</div>
        <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", fontWeight: 800, color: "#1E3A5F", marginBottom: "8px" }}>{t.connectionProblem}</p>
        <p style={{ fontSize: "14px", color: "#6B7280", marginBottom: "20px" }}>{t.connectionError}</p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button onClick={() => router.back()}
            style={{ padding: "10px 20px", background: "white", color: "#6B7280", border: "2px solid #E5E7EB", borderRadius: "12px", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>
            {t.back}
          </button>
          <button onClick={() => window.location.reload()}
            style={{ padding: "10px 20px", background: "#FF8C00", color: "white", border: "none", borderRadius: "12px", fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "14px", cursor: "pointer", boxShadow: "0 3px 0 #CC6A00" }}>
            {t.tryAgain}
          </button>
        </div>
      </div>
    </div>
  );

  if (!child) return null;

  const totalSessions = sessions.length;
  const totalMinutes  = Math.round(sessions.reduce((s, x) => s + (x.duration_seconds || 0), 0) / 60);
  const allWords      = [...new Set(sessions.flatMap((s) => s.words_practiced || []))];
  const meta          = LEVEL_META[getLevel(child.xp)];
  const nextLevel     = nextLevelXp(child.xp) ?? "MAX";
  const levelLabel    = `${meta.emoji} ${meta.label}`;

  return (
    <div style={{ minHeight: "100vh", background: "#FFFBF0" }}>
      <header style={{ background: "white", borderBottom: "1px solid #E5E7EB", padding: "0 24px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", height: "64px", display: "flex", alignItems: "center", gap: "16px" }}>
          <button onClick={() => router.push("/dashboard")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#9CA3AF" }}>
            {t.backDashboard}
          </button>
          <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "20px", fontWeight: 800, color: "#1E3A5F" }}>
            {child.avatar} {t.title(child.name)}
          </h1>
        </div>
      </header>

      <main style={{ maxWidth: "800px", margin: "0 auto", padding: "28px 24px" }}>

        {/* Share progress button */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
          <button
            onClick={() => {
              const text = lang === "sw"
                ? `${child.avatar} ${child.name} amepata nyota ${child.xp} na mfululizo wa siku ${child.streak} na Ticha! 🎉 Jifunze Kiingereza kwa mazungumzo — ticha.app`
                : `${child.avatar} ${child.name} has earned ${child.xp} stars and a ${child.streak}-day streak with Ticha! 🎉 Learn English through live conversation — ticha.app`;
              if (navigator.share) {
                navigator.share({ text });
              } else {
                navigator.clipboard.writeText(text).then(() => alert(lang === "sw" ? "Imenakiliwa! Bandika kwenye ujumbe wako." : "Copied! Paste it in your message."));
              }
            }}
            style={{ display: "flex", alignItems: "center", gap: "6px", background: "#1E3A8A", color: "white", border: "none", borderRadius: "9999px", padding: "10px 20px", fontFamily: "'Baloo 2', cursive", fontWeight: 700, fontSize: "14px", cursor: "pointer", boxShadow: "0 3px 0 #0D1F5C" }}
          >
            📤 {lang === "sw" ? "Shiriki Maendeleo" : "Share Progress"}
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "14px", marginBottom: "28px" }}>
          <StatCard emoji="⭐" value={child.xp}           label={t.totalStars}   color="#F59E0B" />
          <StatCard emoji="🔥" value={child.streak}        label={t.dayStreak}    color="#EF4444" />
          <StatCard emoji="📚" value={totalSessions}       label={t.sessions}     color="#8B5CF6" />
          <StatCard emoji="⏱️" value={t.min(totalMinutes)} label={t.practiceTime} color="#10B981" />
          <StatCard emoji="🔤" value={allWords.length}     label={t.wordsLearned} color="#1E3A5F" />
        </div>

        {/* Level progress */}
        <div className="card" style={{ padding: "24px", marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div>
              <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "16px", fontWeight: 800, color: "#1E3A5F" }}>
                {levelLabel}
              </p>
              <p style={{ fontSize: "12px", color: "#9CA3AF" }}>{t.levelInfo(child.xp, nextLevel)}</p>
            </div>
            <span style={{ fontSize: "32px" }}>{meta.emoji}</span>
          </div>
          <div style={{ height: "10px", background: "#E5E7EB", borderRadius: "9999px", overflow: "hidden" }}>
            <div style={{
              height: "100%", background: "linear-gradient(90deg, #F59E0B, #D97706)",
              borderRadius: "9999px",
              width: `${levelProgressPct(child.xp)}%`,
              transition: "width 1s ease",
            }} />
          </div>
        </div>

        {/* Words learned */}
        {allWords.length > 0 && (
          <div className="card" style={{ padding: "24px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "17px", fontWeight: 800, color: "#1E3A5F" }}>
                {t.wordsPracticed}
              </h2>
              {masteredWords.size > 0 && (
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#16A34A", background: "#DCFCE7", borderRadius: "9999px", padding: "3px 10px" }}>
                  ✓ {masteredWords.size} {lang === "sw" ? "yaliyosimamishwa" : "mastered"}
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {allWords.map((word) => {
                const isMastered = masteredWords.has(word);
                return (
                  <span key={word} style={{
                    background: isMastered ? "#DCFCE7" : "#EFF6FF",
                    color: isMastered ? "#15803D" : "#1E3A5F",
                    border: isMastered ? "1.5px solid #86EFAC" : "1.5px solid transparent",
                    borderRadius: "9999px", padding: "4px 14px",
                    fontSize: "13px", fontWeight: 700,
                    display: "inline-flex", alignItems: "center", gap: "4px",
                  }}>
                    {isMastered && <span style={{ fontSize: "10px" }}>✓</span>}
                    {word}
                  </span>
                );
              })}
            </div>
            <p style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "10px", marginBottom: 0 }}>
              {lang === "sw"
                ? "✓ Maneno ya kijani yamesimamishwa kwa mazoezi ya mchezo"
                : "✓ Green words are mastered through quiz practice"}
            </p>
          </div>
        )}

        {/* Session history */}
        <div className="card" style={{ padding: "24px" }}>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "17px", fontWeight: 800, color: "#1E3A5F", marginBottom: "16px" }}>
            {t.recentSessions}
          </h2>
          {sessions.length === 0 ? (
            <p style={{ color: "#9CA3AF", fontSize: "14px", textAlign: "center", padding: "20px 0" }}>
              {t.noSessions}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {sessions.map((s) => {
                const gameLabel = t.gameLabels[s.game] || `🎓 ${s.game}`;
                const gameEmoji = gameLabel.split(" ")[0];
                const hasTranscript = (s.transcript?.length || 0) > 0;
                const isOpen = openTranscript === s.id;
                return (
                  <div key={s.id} style={{ background: "#F9FAFB", borderRadius: "12px", overflow: "hidden" }}>
                    <div
                      onClick={() => hasTranscript && setOpenTranscript(isOpen ? null : s.id)}
                      style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 16px", cursor: hasTranscript ? "pointer" : "default" }}
                    >
                      <span style={{ fontSize: "24px" }}>{gameEmoji}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700, fontSize: "14px", color: "#1E3A5F" }}>{gameLabel}</p>
                        <p style={{ fontSize: "12px", color: "#9CA3AF" }}>
                          {new Date(s.created_at).toLocaleDateString(lang === "sw" ? "sw-TZ" : "en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          {" · "}{t.min(Math.round((s.duration_seconds || 0) / 60))}
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "16px", fontWeight: 800, color: "#F59E0B" }}>⭐ +{s.xp_earned}</p>
                        {(s.words_practiced?.length || 0) > 0 && (
                          <p style={{ fontSize: "11px", color: "#9CA3AF" }}>{t.words(s.words_practiced.length)}</p>
                        )}
                      </div>
                      {hasTranscript && (
                        <span style={{ fontSize: "12px", color: "#9CA3AF", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
                      )}
                    </div>

                    {/* Lesson transcript — what Ticha and the child actually said */}
                    {isOpen && hasTranscript && (
                      <div style={{ borderTop: "1px solid #E5E7EB", padding: "14px 16px", maxHeight: "320px", overflowY: "auto" }}>
                        <p style={{ fontSize: "11px", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>
                          {lang === "sw"
                            ? `Mazungumzo ya Ticha na ${child.name}`
                            : `What Ticha and ${child.name} talked about`}
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {s.transcript.map((entry, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: entry.role === "child" ? "flex-end" : "flex-start" }}>
                              <div style={{
                                maxWidth: "82%",
                                padding: "8px 12px",
                                borderRadius: entry.role === "child" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                                background: entry.role === "child" ? "#DBEAFE" : "white",
                                border: entry.role === "child" ? "1px solid #BFDBFE" : "1px solid #E5E7EB",
                              }}>
                                <p style={{ fontSize: "10px", fontWeight: 800, color: entry.role === "child" ? "#2563EB" : "#F59E0B", margin: "0 0 2px" }}>
                                  {entry.role === "child" ? child.name : "Ticha"}
                                </p>
                                <p style={{ fontSize: "13px", color: "#374151", margin: 0, lineHeight: 1.5 }}>{entry.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
