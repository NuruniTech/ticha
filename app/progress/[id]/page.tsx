"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Child, Session } from "@/types";

const GAME_LABELS: Record<string, string> = {
  animals: "🦁 Animals",
  numbers: "🔢 Numbers",
  colors:  "🎨 Colors",
  body:    "🫀 Body Parts",
  people:  "👨‍👩‍👧‍👦 People",
};

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

  const [child, setChild]       = useState<Child | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: kid }, { data: sesh }] = await Promise.all([
        supabase.from("children").select("*").eq("id", childId).single(),
        supabase.from("sessions").select("*").eq("child_id", childId).order("created_at", { ascending: false }).limit(20),
      ]);
      if (!kid) { router.push("/dashboard"); return; }
      setChild(kid);
      setSessions(sesh || []);
      setLoading(false);
    }
    load();
  }, [childId, router]);

  if (loading || !child) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFBF0" }}>
      <div style={{ fontSize: "48px" }} className="animate-bounce-soft">📊</div>
    </div>
  );

  const totalSessions = sessions.length;
  const totalMinutes  = Math.round(sessions.reduce((s, x) => s + (x.duration_seconds || 0), 0) / 60);
  const allWords      = [...new Set(sessions.flatMap((s) => s.words_practiced || []))];

  return (
    <div style={{ minHeight: "100vh", background: "#FFFBF0" }}>
      <header style={{ background: "white", borderBottom: "1px solid #E5E7EB", padding: "0 24px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", height: "64px", display: "flex", alignItems: "center", gap: "16px" }}>
          <button onClick={() => router.push("/dashboard")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#9CA3AF" }}>
            ← Dashboard
          </button>
          <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "20px", fontWeight: 800, color: "#1E3A5F" }}>
            {child.avatar} {child.name}&apos;s Progress
          </h1>
        </div>
      </header>

      <main style={{ maxWidth: "800px", margin: "0 auto", padding: "28px 24px" }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "14px", marginBottom: "28px" }}>
          <StatCard emoji="⭐" value={child.xp} label="Total Stars" color="#F59E0B" />
          <StatCard emoji="🔥" value={child.streak} label="Day Streak" color="#EF4444" />
          <StatCard emoji="📚" value={totalSessions} label="Sessions" color="#8B5CF6" />
          <StatCard emoji="⏱️" value={`${totalMinutes}m`} label="Practice Time" color="#10B981" />
          <StatCard emoji="🔤" value={allWords.length} label="Words Learned" color="#1E3A5F" />
        </div>

        {/* Level progress */}
        <div className="card" style={{ padding: "24px", marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div>
              <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "16px", fontWeight: 800, color: "#1E3A5F" }}>
                {child.xp < 50 ? "🌱 Mwanafunzi" : child.xp < 150 ? "⭐ Msomi" : child.xp < 300 ? "🌟 Hodari" : "🏆 Bingwa"}
              </p>
              <p style={{ fontSize: "12px", color: "#9CA3AF" }}>⭐ {child.xp} Stars · Next level at {child.xp < 50 ? 50 : child.xp < 150 ? 150 : child.xp < 300 ? 300 : "MAX"} Stars</p>
            </div>
            <span style={{ fontSize: "32px" }}>{child.xp < 50 ? "🌱" : child.xp < 150 ? "⭐" : child.xp < 300 ? "🌟" : "🏆"}</span>
          </div>
          <div style={{ height: "10px", background: "#E5E7EB", borderRadius: "9999px", overflow: "hidden" }}>
            <div style={{
              height: "100%", background: "linear-gradient(90deg, #F59E0B, #D97706)",
              borderRadius: "9999px",
              width: `${Math.min(100, child.xp < 50 ? (child.xp / 50) * 100 : child.xp < 150 ? ((child.xp - 50) / 100) * 100 : child.xp < 300 ? ((child.xp - 150) / 150) * 100 : 100)}%`,
              transition: "width 1s ease",
            }} />
          </div>
        </div>

        {/* Words learned */}
        {allWords.length > 0 && (
          <div className="card" style={{ padding: "24px", marginBottom: "20px" }}>
            <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "17px", fontWeight: 800, color: "#1E3A5F", marginBottom: "14px" }}>
              🔤 Words Practiced
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {allWords.map((word) => (
                <span key={word} style={{ background: "#EFF6FF", color: "#1E3A5F", borderRadius: "9999px", padding: "4px 14px", fontSize: "13px", fontWeight: 700 }}>
                  {word}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Session history */}
        <div className="card" style={{ padding: "24px" }}>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "17px", fontWeight: 800, color: "#1E3A5F", marginBottom: "16px" }}>
            📅 Recent Sessions
          </h2>
          {sessions.length === 0 ? (
            <p style={{ color: "#9CA3AF", fontSize: "14px", textAlign: "center", padding: "20px 0" }}>
              No sessions yet — start one from the dashboard!
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {sessions.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 16px", background: "#F9FAFB", borderRadius: "12px" }}>
                  <span style={{ fontSize: "24px" }}>{GAME_LABELS[s.game]?.split(" ")[0] || "🎓"}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: "14px", color: "#1E3A5F" }}>{GAME_LABELS[s.game] || s.game}</p>
                    <p style={{ fontSize: "12px", color: "#9CA3AF" }}>
                      {new Date(s.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      {" · "}{Math.round((s.duration_seconds || 0) / 60)}min
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "16px", fontWeight: 800, color: "#F59E0B" }}>⭐ +{s.xp_earned}</p>
                    {(s.words_practiced?.length || 0) > 0 && (
                      <p style={{ fontSize: "11px", color: "#9CA3AF" }}>{s.words_practiced.length} words</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
