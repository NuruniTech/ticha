"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import TichaAvatar from "@/components/TichaAvatar";
import { supabase } from "@/lib/supabase";
import { Child } from "@/types";

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
  const [children, setChildren]       = useState<Child[]>([]);
  const [loading, setLoading]         = useState(true);
  const [parentName, setParentName]   = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const [newName, setNewName]     = useState("");
  const [newAge, setNewAge]       = useState("");
  const [newAvatar, setNewAvatar] = useState("🦁");
  const [newLang, setNewLang]     = useState<"sw" | "en">("sw");
  const [adding, setAdding]       = useState(false);
  const [addError, setAddError]   = useState("");

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    setParentName(
      profile?.full_name || user.user_metadata?.full_name ||
      user.user_metadata?.name || user.email?.split("@")[0] || "Parent"
    );
    const { data: kids } = await supabase.from("children").select("*").eq("parent_id", user.id).order("created_at");
    setChildren(kids || []);
    setLoading(false);
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  async function addChild() {
    if (!newName.trim()) return;
    setAdding(true); setAddError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAddError("Not logged in."); setAdding(false); return; }
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
    if (!confirm("Remove this child profile?")) return;
    await supabase.from("children").delete().eq("id", id);
    setChildren((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg, #C4D8F8 0%, #D4C4F8 50%, #C4F0E8 100%)" }}>
      <div style={{ textAlign: "center" }}>
        <TichaAvatar state="connecting" size={80} />
        <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", color: "#1E3A8A" }}>Loading...</p>
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
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => router.push("/settings")} style={{ background: "rgba(255,255,255,0.7)", border: "none", borderRadius: "9999px", padding: "8px 16px", cursor: "pointer", fontSize: "13px", fontWeight: 700, color: "#6B7280" }}>
                ⚙️ Settings
              </button>
              <button onClick={handleLogout} style={{ background: "rgba(255,255,255,0.5)", border: "none", borderRadius: "9999px", padding: "8px 14px", cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "#9CA3AF" }}>
                Log out
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
                Karibu, {parentName}!
              </h1>
              <p style={{ fontSize: "13px", color: "#6B7280", margin: 0 }}>
                {children.length === 0 ? "Add your first child to get started." : `${children.length} child profile${children.length !== 1 ? "s" : ""} — tap to start a session`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── White panel ── */}
      <div style={{ background: "white", borderRadius: "28px 28px 0 0", marginTop: "-24px", minHeight: "calc(100vh - 160px)", padding: "28px 20px 48px", position: "relative", zIndex: 5 }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>

          {/* Section label */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
            <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "17px", fontWeight: 800, color: "#1E3A8A", margin: 0 }}>
              👦 Children
            </h2>
            {children.length > 0 && (
              <button onClick={() => router.push(`/progress/${children[0].id}`)} style={{ fontSize: "12px", color: "#6B7280", background: "none", border: "1px solid #E5E7EB", borderRadius: "9999px", padding: "5px 14px", cursor: "pointer", fontWeight: 700 }}>
                📊 Progress
              </button>
            )}
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
                      {child.age && <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.75)", margin: "2px 0 0" }}>Age {child.age}</p>}
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
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#9CA3AF" }}>Stars</span>
                          <span style={{ fontSize: "11px", fontWeight: 800, color: "#374151" }}>⭐ {child.xp}</span>
                        </div>
                        <div style={{ height: "6px", background: "#F3F4F6", borderRadius: "9999px", overflow: "hidden" }}>
                          <div style={{ height: "100%", background: lvl.color, borderRadius: "9999px", width: `${Math.min(100, (child.xp % 150) / 1.5)}%`, transition: "width 0.5s" }} />
                        </div>
                      </div>
                      <button style={{ width: "100%", padding: "10px", background: "#FF8C00", color: "white", border: "none", borderRadius: "12px", fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "14px", cursor: "pointer", boxShadow: "0 3px 0 #CC6A00" }}
                        onClick={(e) => { e.stopPropagation(); router.push(`/child/${child.id}`); }}
                      >
                        ▶ Start Session
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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
                <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "15px", fontWeight: 800, color: "#1E3A8A", margin: 0 }}>Add a child</p>
                <p style={{ fontSize: "12px", color: "#9CA3AF", margin: 0 }}>Create a new profile</p>
              </div>
            </button>
          ) : (
            <div style={{ background: "#FAFAFA", borderRadius: "20px", padding: "24px", maxWidth: "480px", border: "1px solid #F3F4F6" }}>
              <h3 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", fontWeight: 800, color: "#1E3A8A", marginBottom: "18px" }}>
                Add a child 👦
              </h3>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#374151", marginBottom: "8px" }}>Choose an avatar</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "18px" }}>
                {AVATARS.map((a) => (
                  <button key={a} onClick={() => setNewAvatar(a)}
                    style={{ width: "42px", height: "42px", borderRadius: "10px", border: `2px solid ${newAvatar === a ? "#FF8C00" : "#E5E7EB"}`, background: newAvatar === a ? "#FFF7ED" : "white", fontSize: "20px", cursor: "pointer" }}
                  >{a}</button>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "#374151", display: "block", marginBottom: "6px" }}>Name *</label>
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Amani"
                    style={{ width: "100%", border: "2px solid #E5E7EB", borderRadius: "10px", padding: "10px 12px", fontSize: "14px", fontFamily: "'Nunito', sans-serif", outline: "none" }}
                    onFocus={(e) => e.target.style.borderColor = "#FF8C00"}
                    onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "#374151", display: "block", marginBottom: "6px" }}>Age (optional)</label>
                  <input value={newAge} onChange={(e) => setNewAge(e.target.value)} placeholder="e.g. 6" type="number" min="2" max="18"
                    style={{ width: "100%", border: "2px solid #E5E7EB", borderRadius: "10px", padding: "10px 12px", fontSize: "14px", fontFamily: "'Nunito', sans-serif", outline: "none" }}
                    onFocus={(e) => e.target.style.borderColor = "#FF8C00"}
                    onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
                  />
                </div>
              </div>
              <div style={{ marginBottom: "18px" }}>
                <label style={{ fontSize: "13px", fontWeight: 700, color: "#374151", display: "block", marginBottom: "8px" }}>Learning direction</label>
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
                  Cancel
                </button>
                <button onClick={addChild} disabled={adding || !newName.trim()}
                  style={{ flex: 2, padding: "11px", background: "#FF8C00", color: "white", border: "none", borderRadius: "9999px", cursor: (!newName.trim() || adding) ? "not-allowed" : "pointer", fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "14px", opacity: (!newName.trim() || adding) ? 0.5 : 1, boxShadow: "0 3px 0 #CC6A00" }}>
                  {adding ? "Adding..." : "➕ Add Child"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
