"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/context/LanguageContext";
import TichaAvatar from "@/components/TichaAvatar";

const AVATARS = ["🦁", "🐘", "🦒", "🦓", "🐬", "🦅", "🌺", "⭐"];

export default function OnboardingPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const sw = lang === "sw";

  const [step, setStep] = useState(1); // 1 = welcome, 2 = add child, 3 = ready
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("");
  const [direction, setDirection] = useState<"sw" | "en">("sw"); // sw = child learns English
  const [avatar, setAvatar] = useState("🦁");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const t = {
    step1Title:   sw ? "Karibu Ticha! 🎉" : "Welcome to Ticha! 🎉",
    step1Sub:     sw ? "Ticha ni mwalimu wa sauti wa mtoto wako. Hebu tuanze kwa hatua chache rahisi." : "Ticha is your child's personal voice tutor. Let's set things up in just a few steps.",
    step1Btn:     sw ? "Anza Sasa →" : "Get Started →",
    step2Title:   sw ? "Mwambie Ticha kuhusu mtoto wako 👦" : "Tell Ticha about your child 👦",
    namePlaceholder: sw ? "Jina la mtoto" : "Child's name",
    agePlaceholder:  sw ? "Umri (si lazima)" : "Age (optional)",
    dirLabel:        sw ? "Mtoto wako anajifunza:" : "Your child is learning:",
    dirEn:           sw ? "Kiingereza (kutoka Kiswahili)" : "English (from Swahili)",
    dirSw:           sw ? "Kiswahili (kutoka Kiingereza)" : "Swahili (from English)",
    avatarLabel:     sw ? "Chagua picha" : "Pick an avatar",
    step2Btn:        sw ? "Endelea →" : "Continue →",
    step2Skip:       sw ? "Ruka kwa sasa" : "Skip for now",
    step3Title:   sw ? "Mmoja! Ticha yuko tayari! 🚀" : "All set! Ticha is ready! 🚀",
    step3Sub:     sw ? (childName ? `${childName} yuko tayari kuanza darasa lake la kwanza na Ticha!` : "Mtoto wako yuko tayari kuanza darasa lake la kwanza na Ticha!")
                     : (childName ? `${childName} is ready to start their first lesson with Ticha!` : "Your child is ready to start their first lesson with Ticha!"),
    step3Btn:     sw ? "Nenda kwenye Dashibodi 🏠" : "Go to Dashboard 🏠",
    nameRequired: sw ? "Tafadhali weka jina la mtoto." : "Please enter your child's name.",
    savingError:  sw ? "Hitilafu — jaribu tena." : "Something went wrong — please try again.",
  };

  async function saveChild() {
    if (!childName.trim()) { setError(t.nameRequired); return; }
    setSaving(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      await supabase.from("children").insert({
        parent_id: user.id,
        name: childName.trim(),
        age: childAge ? parseInt(childAge) : null,
        avatar,
        primary_language: direction,
        xp: 0,
        streak: 0,
      });
      setStep(3);
    } catch {
      setError(t.savingError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(160deg, #047857 0%, #10B981 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "'Nunito', sans-serif" }}>

      {/* Progress dots */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "32px" }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{ width: s === step ? "24px" : "8px", height: "8px", borderRadius: "9999px", background: s <= step ? "white" : "rgba(255,255,255,0.3)", transition: "all 0.3s" }} />
        ))}
      </div>

      <div style={{ background: "white", borderRadius: "28px", padding: "32px 28px", maxWidth: "420px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>

        {/* ── Step 1: Welcome ── */}
        {step === 1 && (
          <div style={{ textAlign: "center" }}>
            <TichaAvatar state="celebrating" size={160} />
            <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "26px", fontWeight: 800, color: "#1E3A5F", marginTop: "16px", marginBottom: "10px" }}>
              {t.step1Title}
            </h1>
            <p style={{ fontSize: "15px", color: "#6B7280", lineHeight: 1.6, marginBottom: "28px" }}>
              {t.step1Sub}
            </p>
            <button className="btn-primary" onClick={() => setStep(2)} style={{ width: "100%", padding: "15px", fontSize: "17px" }}>
              {t.step1Btn}
            </button>
          </div>
        )}

        {/* ── Step 2: Add child ── */}
        {step === 2 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <Image src="/images/ticha-logo-v2.PNG" alt="Ticha" width={60} height={40} style={{ objectFit: "contain" }} />
              <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "20px", fontWeight: 800, color: "#1E3A5F", marginTop: "10px" }}>
                {t.step2Title}
              </h2>
            </div>

            {/* Avatar picker */}
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#6B7280", marginBottom: "8px" }}>{t.avatarLabel}</p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
              {AVATARS.map(a => (
                <button key={a} onClick={() => setAvatar(a)}
                  style={{ width: "44px", height: "44px", borderRadius: "12px", border: `2.5px solid ${avatar === a ? "#10B981" : "#E5E7EB"}`, background: avatar === a ? "#F0FDF4" : "white", fontSize: "22px", cursor: "pointer", transition: "all 0.2s" }}>
                  {a}
                </button>
              ))}
            </div>

            {/* Name */}
            <input
              type="text"
              placeholder={t.namePlaceholder}
              value={childName}
              onChange={e => { setChildName(e.target.value); setError(""); }}
              style={{ width: "100%", padding: "13px 16px", borderRadius: "14px", border: "2px solid #E5E7EB", fontSize: "15px", fontFamily: "'Nunito', sans-serif", marginBottom: "10px", outline: "none", boxSizing: "border-box" }}
            />

            {/* Age */}
            <input
              type="number"
              placeholder={t.agePlaceholder}
              value={childAge}
              onChange={e => setChildAge(e.target.value)}
              min={3} max={18}
              style={{ width: "100%", padding: "13px 16px", borderRadius: "14px", border: "2px solid #E5E7EB", fontSize: "15px", fontFamily: "'Nunito', sans-serif", marginBottom: "16px", outline: "none", boxSizing: "border-box" }}
            />

            {/* Learning direction */}
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#6B7280", marginBottom: "8px" }}>{t.dirLabel}</p>
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
              {(["sw", "en"] as const).map(d => (
                <button key={d} onClick={() => setDirection(d)}
                  style={{ flex: 1, padding: "11px", borderRadius: "12px", border: `2px solid ${direction === d ? "#10B981" : "#E5E7EB"}`, background: direction === d ? "#F0FDF4" : "white", fontSize: "13px", fontWeight: 700, color: direction === d ? "#047857" : "#6B7280", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>
                  {d === "sw" ? t.dirEn : t.dirSw}
                </button>
              ))}
            </div>

            {error && <p style={{ color: "#EF4444", fontSize: "13px", marginBottom: "10px", textAlign: "center" }}>{error}</p>}

            <button className="btn-primary" onClick={saveChild} disabled={saving} style={{ width: "100%", padding: "15px", fontSize: "16px", marginBottom: "10px" }}>
              {saving ? "..." : t.step2Btn}
            </button>
            <button onClick={() => router.push("/dashboard")} style={{ width: "100%", padding: "11px", background: "none", border: "none", color: "#9CA3AF", fontSize: "14px", cursor: "pointer", fontWeight: 600 }}>
              {t.step2Skip}
            </button>
          </div>
        )}

        {/* ── Step 3: Ready ── */}
        {step === 3 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "64px", marginBottom: "8px" }}>{avatar}</div>
            <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "26px", fontWeight: 800, color: "#1E3A5F", marginBottom: "10px" }}>
              {t.step3Title}
            </h1>
            <p style={{ fontSize: "15px", color: "#6B7280", lineHeight: 1.6, marginBottom: "28px" }}>
              {t.step3Sub}
            </p>
            <button className="btn-primary" onClick={() => router.push("/dashboard")} style={{ width: "100%", padding: "15px", fontSize: "17px" }}>
              {t.step3Btn}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
