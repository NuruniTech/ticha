"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import TichaAvatar from "@/components/TichaAvatar";
import { supabase } from "@/lib/supabase";
import { Child } from "@/types";
import { useLanguage } from "@/context/LanguageContext";
import { T } from "@/lib/translations";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { usePostHog } from "posthog-js/react";

const CHILDREN_CACHE_KEY = "ticha_children_cache";
const PARENT_NAME_KEY    = "ticha_parent_name";

const AVATARS = ["🦁", "🐘", "🦒", "🦓", "🐆", "🦏", "🦋", "🌺", "⭐", "🌍", "🎵", "🚀"];

const LEVEL = (xp: number) => {
  if (xp < 50)  return { label: "Mwanafunzi", emoji: "🌱", color: "#22C55E", bg: "#F0FDF4" };
  if (xp < 150) return { label: "Msomi",      emoji: "⭐", color: "#F59E0B", bg: "#FFFBEB" };
  if (xp < 300) return { label: "Hodari",     emoji: "🌟", color: "#8B5CF6", bg: "#F5F3FF" };
  return              { label: "Bingwa",      emoji: "🏆", color: "#EF4444", bg: "#FEF2F2" };
};

const CARD_GRADIENTS = [
  "linear-gradient(135deg, #FF8C00 0%, #FFB347 100%)",
  "linear-gradient(135deg, #9B59F5 0%, #C084FC 100%)",
  "linear-gradient(135deg, #4B8BF5 0%, #60A5FA 100%)",
  "linear-gradient(135deg, #22C55E 0%, #4ADE80 100%)",
  "linear-gradient(135deg, #EF4444 0%, #F87171 100%)",
  "linear-gradient(135deg, #0D9488 0%, #2DD4BF 100%)",
];

export default function DashboardPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const t        = T[lang].dashboard;
  const tOffline = T[lang].offline;
  const isOnline = useOnlineStatus();
  const posthog  = usePostHog();

  const [children, setChildren]       = useState<Child[]>([]);
  const [loading, setLoading]         = useState(true);
  const [parentName, setParentName]   = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [hasError, setHasError]       = useState(false);
  const [usingCache, setUsingCache]   = useState(false);
  const [milestoneAlerts, setMilestoneAlerts] = useState<{ key: string; msg: string; msgSw: string; childName: string }[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const [newName, setNewName]     = useState("");
  const [newAge, setNewAge]       = useState("");
  const [newAvatar, setNewAvatar] = useState("🦁");
  const [newLang, setNewLang]     = useState<"sw" | "en">("sw");
  const [adding, setAdding]       = useState(false);
  const [addError, setAddError]   = useState("");

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      const name = profile?.full_name || user.user_metadata?.full_name ||
        user.user_metadata?.name || user.email?.split("@")[0] || "Parent";
      setParentName(name);
      posthog?.identify(user.id, { name, email: user.email });
      const { data: kids } = await supabase.from("children").select("*").eq("parent_id", user.id).order("created_at");
      setChildren(kids || []);
      // Persist to device storage for offline use
      try {
        localStorage.setItem(CHILDREN_CACHE_KEY, JSON.stringify(kids || []));
        localStorage.setItem(PARENT_NAME_KEY, name);
        // Detect unseen milestone alerts across all children
        const alerts: { key: string; msg: string; msgSw: string; childName: string }[] = [];
        for (const child of (kids || [])) {
          const checks = [
            { key: `ms_${child.id}_xp50`,  cond: child.xp >= 50,   msg: `🌟 ${child.name} reached Level 2!`,        msgSw: `🌟 ${child.name} amefika Kiwango 2!`        },
            { key: `ms_${child.id}_xp150`, cond: child.xp >= 150,  msg: `🌟 ${child.name} reached Level 3!`,        msgSw: `🌟 ${child.name} amefika Kiwango 3!`        },
            { key: `ms_${child.id}_xp300`, cond: child.xp >= 300,  msg: `🏆 ${child.name} reached the top level!`, msgSw: `🏆 ${child.name} amefika kiwango cha juu!` },
            { key: `ms_${child.id}_str3`,  cond: child.streak >= 3, msg: `🔥 ${child.name} is on a 3-day streak!`,  msgSw: `🔥 ${child.name} ana mfululizo wa siku 3!`  },
            { key: `ms_${child.id}_str7`,  cond: child.streak >= 7, msg: `🔥 ${child.name} is on a 7-day streak!`,  msgSw: `🔥 ${child.name} ana mfululizo wa siku 7!`  },
          ];
          for (const c of checks) {
            if (c.cond && !localStorage.getItem(c.key)) {
              alerts.push({ ...c, childName: child.name });
            }
          }
        }
        setMilestoneAlerts(alerts);
      } catch { /* ignore */ }
      setLoading(false);
    } catch {
      // Try device cache when offline
      try {
        const cachedKids = localStorage.getItem(CHILDREN_CACHE_KEY);
        const cachedName = localStorage.getItem(PARENT_NAME_KEY);
        if (cachedKids) {
          setChildren(JSON.parse(cachedKids));
          setParentName(cachedName || "");
          setUsingCache(true);
          setLoading(false);
          return;
        }
      } catch { /* ignore */ }
      setHasError(true);
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  async function addChild() {
    if (!newName.trim()) return;
    setAdding(true); setAddError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAddError(t.notLoggedIn); setAdding(false); return; }
    await supabase.from("profiles").upsert({ id: user.id, email: user.email ?? "", full_name: user.user_metadata?.full_name ?? "" }, { onConflict: "id" });
    const { data, error } = await supabase.from("children").insert({
      parent_id: user.id, name: newName.trim(),
      age: newAge ? parseInt(newAge) : null, avatar: newAvatar, primary_language: newLang,
    }).select().single();
    if (error) { setAddError(error.message); setAdding(false); return; }
    if (data) { setChildren((prev) => [...prev, data]); setShowAddForm(false); setNewName(""); setNewAge(""); setNewAvatar("🦁"); setNewLang("sw"); }
    setAdding(false);
  }

  async function deleteChild(id: string) {
    if (!confirm(t.removeConfirm)) return;
    await supabase.from("children").delete().eq("id", id);
    setChildren((prev) => prev.filter((c) => c.id !== id));
  }

  function dismissAlert(key: string) {
    try { localStorage.setItem(key, "1"); } catch { /* ignore */ }
    setMilestoneAlerts(prev => prev.filter(a => a.key !== key));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg, #C4D8F8 0%, #D4C4F8 50%, #C4F0E8 100%)" }}>
      <div style={{ textAlign: "center" }}>
        <TichaAvatar state="connecting" size={80} />
        <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", color: "#1E3A8A" }}>{t.loading}</p>
      </div>
    </div>
  );

  if (hasError) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg, #C4D8F8 0%, #D4C4F8 50%, #C4F0E8 100%)", padding: "24px" }}>
      <div style={{ textAlign: "center", maxWidth: "360px" }}>
        <div style={{ fontSize: "48px", marginBottom: "12px" }}>📡</div>
        <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", fontWeight: 800, color: "#1E3A8A", marginBottom: "8px" }}>{t.connectionProblem}</p>
        <p style={{ fontSize: "14px", color: "#6B7280", marginBottom: "20px" }}>{t.connectionError}</p>
        <button onClick={() => { setHasError(false); setLoading(true); loadData(); }}
          style={{ padding: "12px 28px", background: "#FF8C00", color: "white", border: "none", borderRadius: "12px", fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "15px", cursor: "pointer", boxShadow: "0 3px 0 #CC6A00" }}>
          {t.tryAgain}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FB", fontFamily: "'Nunito', sans-serif" }}>

      {/* ── Top gradient header ── */}
      <div style={{ background: "linear-gradient(160deg, #C4D8F8 0%, #D4C4F8 50%, #C4F0E8 100%)", padding: "20px 20px 52px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          {/* Nav row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <TichaAvatar state="idle" size={32} />
              <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: "20px", fontWeight: 800, color: "#1E3A8A" }}>Ticha</span>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {/* Bell */}
              <button
                onClick={() => setShowNotifications(true)}
                style={{ position: "relative", background: "rgba(255,255,255,0.7)", border: "none", borderRadius: "50%", width: "38px", height: "38px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px" }}
              >
                🔔
                {milestoneAlerts.length > 0 && (
                  <span style={{ position: "absolute", top: "4px", right: "4px", width: "14px", height: "14px", background: "#EF4444", borderRadius: "50%", fontSize: "8px", fontWeight: 800, color: "white", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid white" }}>
                    {milestoneAlerts.length}
                  </span>
                )}
              </button>
              <button onClick={() => router.push("/settings")} style={{ background: "rgba(255,255,255,0.7)", border: "none", borderRadius: "9999px", padding: "8px 16px", cursor: "pointer", fontSize: "13px", fontWeight: 700, color: "#6B7280" }}>
                {t.settings}
              </button>
              <button onClick={handleLogout} style={{ background: "rgba(255,255,255,0.5)", border: "none", borderRadius: "9999px", padding: "8px 14px", cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "#9CA3AF" }}>
                {t.logout}
              </button>
            </div>
          </div>

          {/* Welcome */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ width: "56px", height: "56px", background: "rgba(255,255,255,0.8)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px", border: "2px solid rgba(255,255,255,0.9)", flexShrink: 0 }}>
              👋
            </div>
            <div>
              <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "22px", fontWeight: 800, color: "#1E3A8A", margin: 0 }}>
                {t.welcome(parentName)}
              </h1>
              <p style={{ fontSize: "13px", color: "#6B7280", margin: 0 }}>
                {children.length === 0 ? t.noChildren : t.childProfiles(children.length)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── White panel ── */}
      <div style={{ background: "white", borderRadius: "28px 28px 0 0", marginTop: "-24px", minHeight: "calc(100vh - 160px)", padding: "28px 20px 48px", position: "relative", zIndex: 5 }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>

          {/* Offline / cached data notice */}
          {(usingCache || !isOnline) && (
            <div style={{ background: "#FFF7ED", border: "1.5px solid #FED7AA", borderRadius: "12px", padding: "10px 14px", marginBottom: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>📡</span>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "#92400E", margin: 0 }}>{tOffline.cachedData}</p>
            </div>
          )}

          {/* Section label */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
            <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "17px", fontWeight: 800, color: "#1E3A8A", margin: 0 }}>
              {t.childrenSection}
            </h2>
          </div>

          {/* Children grid */}
          {children.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px", marginBottom: "20px" }}>
              {children.map((child, i) => {
                const lvl = LEVEL(child.xp);
                const grad = CARD_GRADIENTS[i % CARD_GRADIENTS.length];
                return (
                  <div key={child.id} style={{ borderRadius: "20px", overflow: "hidden", cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", transition: "transform 0.15s", position: "relative" }}
                    onClick={() => router.push(`/child/${child.id}`)}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-4px)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                  >
                    {/* Colored top */}
                    <div style={{ background: grad, padding: "20px 18px 24px", position: "relative" }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteChild(child.id); }}
                        style={{ position: "absolute", top: "10px", right: "10px", background: "rgba(255,255,255,0.25)", border: "none", borderRadius: "50%", width: "26px", height: "26px", cursor: "pointer", fontSize: "14px", color: "white", lineHeight: "26px", textAlign: "center" }}
                        aria-label="Remove"
                      >×</button>
                      <div style={{ width: "56px", height: "56px", background: "rgba(255,255,255,0.25)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", marginBottom: "10px", border: "2px solid rgba(255,255,255,0.4)" }}>
                        {child.avatar}
                      </div>
                      <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "20px", fontWeight: 800, color: "white", margin: 0 }}>{child.name}</p>
                      {child.age && <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.75)", margin: "2px 0 0" }}>{t.age(child.age)}</p>}
                    </div>
                    {/* White bottom */}
                    <div style={{ background: "white", padding: "14px 18px 18px" }}>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
                        <span style={{ background: "#EEF2FF", color: "#4338CA", borderRadius: "9999px", padding: "3px 10px", fontSize: "11px", fontWeight: 700 }}>
                          {child.primary_language === "sw" ? "🇹🇿 Kiswahili" : "🇺🇸 English"}
                        </span>
                        {child.streak > 0 && (
                          <span style={{ background: "#FEF3C7", color: "#D97706", borderRadius: "9999px", padding: "3px 10px", fontSize: "11px", fontWeight: 700 }}>
                            🔥 {child.streak}d
                          </span>
                        )}
                        <span style={{ background: lvl.bg, color: lvl.color, borderRadius: "9999px", padding: "3px 10px", fontSize: "11px", fontWeight: 700 }}>
                          {lvl.emoji} {lvl.label}
                        </span>
                      </div>
                      <div style={{ marginBottom: "14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#9CA3AF" }}>{t.stars}</span>
                          <span style={{ fontSize: "11px", fontWeight: 800, color: "#374151" }}>⭐ {child.xp}</span>
                        </div>
                        <div style={{ height: "6px", background: "#F3F4F6", borderRadius: "9999px", overflow: "hidden" }}>
                          <div style={{ height: "100%", background: lvl.color, borderRadius: "9999px", width: `${child.xp < 50 ? (child.xp / 50) * 100 : child.xp < 150 ? ((child.xp - 50) / 100) * 100 : child.xp < 300 ? ((child.xp - 150) / 150) * 100 : 100}%`, transition: "width 0.5s" }} />
                        </div>
                      </div>
                      <button style={{ width: "100%", padding: "10px", background: "#FF8C00", color: "white", border: "none", borderRadius: "12px", fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "14px", cursor: "pointer", boxShadow: "0 3px 0 #CC6A00" }}
                        onClick={(e) => { e.stopPropagation(); router.push(`/child/${child.id}`); }}
                      >
                        {t.startSession}
                      </button>
                      <button
                        style={{ width: "100%", marginTop: "8px", padding: "8px", background: "none", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: "12px", fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
                        onClick={(e) => { e.stopPropagation(); router.push(`/progress/${child.id}`); }}
                      >
                        {t.progress}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Family Leaderboard (2+ children only) ── */}
          {children.length >= 2 && (() => {
            const ranked = [...children].sort((a, b) => b.xp - a.xp || b.streak - a.streak);
            const medals = ["🥇", "🥈", "🥉"];
            return (
              <div style={{ marginBottom: "24px" }}>
                <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "17px", fontWeight: 800, color: "#1E3A8A", margin: "0 0 14px" }}>
                  {t.leaderboardTitle}
                </h2>
                <div style={{ background: "white", borderRadius: "20px", border: "1px solid #F3F4F6", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                  {ranked.map((child, i) => {
                    const lvl = LEVEL(child.xp);
                    const isFirst = i === 0;
                    return (
                      <div
                        key={child.id}
                        onClick={() => router.push(`/child/${child.id}`)}
                        style={{
                          display: "flex", alignItems: "center", gap: "14px",
                          padding: "14px 18px",
                          background: isFirst ? "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)" : "white",
                          borderBottom: i < ranked.length - 1 ? "1px solid #F3F4F6" : "none",
                          cursor: "pointer",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => { if (!isFirst) e.currentTarget.style.background = "#F9FAFB"; }}
                        onMouseLeave={(e) => { if (!isFirst) e.currentTarget.style.background = "white"; }}
                      >
                        {/* Rank medal */}
                        <div style={{ width: "32px", textAlign: "center", flexShrink: 0 }}>
                          {i < 3
                            ? <span style={{ fontSize: "22px" }}>{medals[i]}</span>
                            : <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: "14px", fontWeight: 800, color: "#9CA3AF" }}>#{i + 1}</span>}
                        </div>

                        {/* Avatar */}
                        <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: isFirst ? "#FEF3C7" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", border: isFirst ? "2px solid #F59E0B" : "2px solid transparent", flexShrink: 0 }}>
                          {child.avatar}
                        </div>

                        {/* Name + level */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "15px", fontWeight: 800, color: "#1E3A5F", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {child.name}
                            {isFirst && <span style={{ marginLeft: "6px", fontSize: "12px" }}>👑</span>}
                          </p>
                          <p style={{ fontSize: "11px", color: lvl.color, fontWeight: 700, margin: 0 }}>{lvl.emoji} {lvl.label}</p>
                        </div>

                        {/* Stats */}
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "15px", fontWeight: 800, color: "#F59E0B", margin: 0 }}>⭐ {child.xp}</p>
                          {child.streak > 0 && (
                            <p style={{ fontSize: "11px", color: "#EF4444", fontWeight: 700, margin: 0 }}>🔥 {child.streak}d</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Add child */}
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              style={{ display: "flex", alignItems: "center", gap: "12px", padding: "18px 22px", border: "2px dashed #D1D5DB", borderRadius: "20px", background: "transparent", cursor: "pointer", transition: "border-color 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#FF8C00")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#D1D5DB")}
            >
              <div style={{ width: "44px", height: "44px", background: "#FFF7ED", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>➕</div>
              <div style={{ textAlign: "left" }}>
                <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "15px", fontWeight: 800, color: "#1E3A8A", margin: 0 }}>{t.addChildBtn}</p>
                <p style={{ fontSize: "12px", color: "#9CA3AF", margin: 0 }}>{t.addChildSub}</p>
              </div>
            </button>
          ) : (
            <div style={{ background: "#FAFAFA", borderRadius: "20px", padding: "24px", maxWidth: "480px", border: "1px solid #F3F4F6" }}>
              <h3 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", fontWeight: 800, color: "#1E3A8A", marginBottom: "18px" }}>
                {t.addChildTitle}
              </h3>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#374151", marginBottom: "8px" }}>{t.chooseAvatar}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "18px" }}>
                {AVATARS.map((a) => (
                  <button key={a} onClick={() => setNewAvatar(a)}
                    style={{ width: "42px", height: "42px", borderRadius: "10px", border: `2px solid ${newAvatar === a ? "#FF8C00" : "#E5E7EB"}`, background: newAvatar === a ? "#FFF7ED" : "white", fontSize: "20px", cursor: "pointer" }}
                  >{a}</button>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "#374151", display: "block", marginBottom: "6px" }}>{t.nameLabel}</label>
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Amani"
                    style={{ width: "100%", border: "2px solid #E5E7EB", borderRadius: "10px", padding: "10px 12px", fontSize: "14px", fontFamily: "'Nunito', sans-serif", outline: "none" }}
                    onFocus={(e) => e.target.style.borderColor = "#FF8C00"}
                    onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "#374151", display: "block", marginBottom: "6px" }}>{t.ageLabel}</label>
                  <input value={newAge} onChange={(e) => setNewAge(e.target.value)} placeholder="e.g. 6" type="number" min="2" max="18"
                    style={{ width: "100%", border: "2px solid #E5E7EB", borderRadius: "10px", padding: "10px 12px", fontSize: "14px", fontFamily: "'Nunito', sans-serif", outline: "none" }}
                    onFocus={(e) => e.target.style.borderColor = "#FF8C00"}
                    onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
                  />
                </div>
              </div>
              <div style={{ marginBottom: "18px" }}>
                <label style={{ fontSize: "13px", fontWeight: 700, color: "#374151", display: "block", marginBottom: "8px" }}>{t.learningDirection}</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {([["sw", "🇹🇿 Swahili → English"], ["en", "🇺🇸 English → Swahili"]] as const).map(([code, label]) => (
                    <button key={code} onClick={() => setNewLang(code)}
                      style={{ flex: 1, padding: "10px", border: `2px solid ${newLang === code ? "#FF8C00" : "#E5E7EB"}`, borderRadius: "10px", background: newLang === code ? "#FFF7ED" : "white", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "#1E3A8A" }}
                    >{label}</button>
                  ))}
                </div>
              </div>
              {addError && (
                <div style={{ background: "#FEE2E2", borderRadius: "10px", padding: "10px 14px", marginBottom: "12px" }}>
                  <p style={{ color: "#B91C1C", fontSize: "13px", fontWeight: 600 }}>{addError}</p>
                </div>
              )}
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => { setShowAddForm(false); setAddError(""); }}
                  style={{ flex: 1, padding: "11px", border: "2px solid #E5E7EB", borderRadius: "9999px", background: "white", cursor: "pointer", fontWeight: 700, color: "#6B7280", fontSize: "14px" }}>
                  {t.cancel}
                </button>
                <button onClick={addChild} disabled={adding || !newName.trim()}
                  style={{ flex: 2, padding: "11px", background: "#FF8C00", color: "white", border: "none", borderRadius: "9999px", cursor: (!newName.trim() || adding) ? "not-allowed" : "pointer", fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "14px", opacity: (!newName.trim() || adding) ? 0.5 : 1, boxShadow: "0 3px 0 #CC6A00" }}>
                  {adding ? t.adding : t.addChild}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Notification modal (centered overlay) ── */}
      {showNotifications && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowNotifications(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, backdropFilter: "blur(3px)" }}
          />
          {/* Centered card */}
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 101, background: "white", borderRadius: "20px", width: "min(560px, calc(100vw - 32px))", maxHeight: "82vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: "1px solid #F3F4F6", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "34px", height: "34px", background: "#FEF3C7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px" }}>🔔</div>
                <div>
                  <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "15px", fontWeight: 800, color: "#1E3A8A", margin: 0 }}>
                    {lang === "sw" ? "Taarifa" : "Notifications"}
                  </p>
                  <p style={{ fontSize: "11px", color: "#9CA3AF", margin: 0 }}>
                    {milestoneAlerts.length === 0
                      ? (lang === "sw" ? "Hakuna taarifa mpya" : "No new notifications")
                      : lang === "sw" ? `Taarifa ${milestoneAlerts.length} mpya` : `${milestoneAlerts.length} new update${milestoneAlerts.length > 1 ? "s" : ""}`}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {milestoneAlerts.length > 0 && (
                  <button
                    onClick={() => { milestoneAlerts.forEach(a => dismissAlert(a.key)); }}
                    style={{ fontSize: "11px", fontWeight: 700, color: "#6B7280", background: "#F3F4F6", border: "none", borderRadius: "9999px", padding: "5px 12px", cursor: "pointer" }}
                  >
                    {lang === "sw" ? "Futa zote" : "Clear all"}
                  </button>
                )}
                <button
                  onClick={() => setShowNotifications(false)}
                  style={{ width: "28px", height: "28px", background: "#F3F4F6", border: "none", borderRadius: "50%", cursor: "pointer", fontSize: "16px", color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center" }}
                >×</button>
              </div>
            </div>
            {/* Notifications list — grouped by child, scrollable */}
            <div style={{ padding: "16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
              {milestoneAlerts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: "40px", marginBottom: "10px" }}>🎉</div>
                  <p style={{ fontSize: "14px", color: "#9CA3AF", fontWeight: 600 }}>
                    {lang === "sw" ? "Umesoma taarifa zote!" : "You're all caught up!"}
                  </p>
                </div>
              ) : (() => {
                // Group alerts by child name
                const groups: Record<string, typeof milestoneAlerts> = {};
                milestoneAlerts.forEach(a => {
                  if (!groups[a.childName]) groups[a.childName] = [];
                  groups[a.childName].push(a);
                });
                return Object.entries(groups).map(([childName, alerts]) => (
                  <div key={childName} style={{ marginBottom: "8px" }}>
                    {/* Child name divider */}
                    <p style={{ fontSize: "11px", fontWeight: 800, color: "#9CA3AF", letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 6px 4px" }}>
                      {childName}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {alerts.map(alert => {
                        const icon = alert.msg.startsWith("🔥") ? "🔥" : alert.msg.startsWith("🏆") ? "🏆" : "🌟";
                        return (
                          <div key={alert.key} style={{ display: "flex", alignItems: "center", gap: "12px", background: "#FAFAFA", border: "1px solid #F3F4F6", borderLeft: "3px solid #F59E0B", borderRadius: "10px", padding: "11px 12px" }}>
                            <span style={{ fontSize: "18px", flexShrink: 0 }}>{icon}</span>
                            <p style={{ flex: 1, fontSize: "13px", fontWeight: 600, color: "#374151", margin: 0, lineHeight: 1.4 }}>
                              {lang === "sw" ? alert.msgSw : alert.msg}
                            </p>
                            <button
                              onClick={() => dismissAlert(alert.key)}
                              style={{ background: "none", border: "none", borderRadius: "50%", width: "24px", height: "24px", cursor: "pointer", fontSize: "16px", color: "#9CA3AF", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                            >×</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
