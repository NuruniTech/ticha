"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccessibility } from "@/context/AccessibilityContext";
import { useLanguage } from "@/context/LanguageContext";
import { T } from "@/lib/translations";
import { Theme, FontSize, VoiceName } from "@/types";
import ParentGate from "@/components/ParentGate";
import { supabase } from "@/lib/supabase";
import { hashPin, markPinUnlocked } from "@/lib/pin";

const VOICE_NAMES: VoiceName[] = ["Aoede", "Kore"];
const VOICE_ICONS = ["👩🏾", "👩🏿"];
const THEME_IDS: Theme[] = ["default", "high-contrast", "colorblind"];
const TOGGLE_ICONS = ["🐢", "👁️", "🌗", "✋", "🔊"];

// Module scope — defining components inside another component recreates them
// on every render and resets their internal state.
function Toggle({ label, desc, checked, onChange, icon }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void; icon: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderBottom: "1px solid #F3F4F6" }}>
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
        <span style={{ fontSize: "22px" }}>{icon}</span>
        <div>
          <p style={{ fontWeight: 700, fontSize: "15px", color: "#1E3A5F" }}>{label}</p>
          <p style={{ fontSize: "13px", color: "#9CA3AF", marginTop: "2px" }}>{desc}</p>
        </div>
      </div>
      <button
        role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        style={{ width: "48px", height: "26px", borderRadius: "9999px", background: checked ? "#10B981" : "#D1D5DB", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
      >
        <span style={{ position: "absolute", top: "3px", left: checked ? "25px" : "3px", width: "20px", height: "20px", borderRadius: "50%", background: "white", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
      </button>
    </div>
  );
}

function SettingsInner() {
  const router = useRouter();
  const { settings, updateSetting } = useAccessibility();
  const { lang, setLang } = useLanguage();
  const t = T[lang].settings;
  const sw = lang === "sw";

  // ── Parent PIN management ──────────────────────────────────────────────────
  const [pinSet,     setPinSet]     = useState<boolean | null>(null); // null = loading
  const [pinEditing, setPinEditing] = useState(false);
  const [pinDraft,   setPinDraft]   = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError,   setPinError]   = useState("");
  const [pinBusy,    setPinBusy]    = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("profiles").select("parent_pin_hash").eq("id", user.id).single();
        if (!cancelled) setPinSet(Boolean(data?.parent_pin_hash));
      } catch { if (!cancelled) setPinSet(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  async function savePin() {
    setPinError("");
    if (!/^\d{4}$/.test(pinDraft)) { setPinError(sw ? "PIN lazima iwe tarakimu 4" : "PIN must be exactly 4 digits"); return; }
    if (pinDraft !== pinConfirm)   { setPinError(sw ? "PIN hazifanani" : "PINs don't match"); return; }
    setPinBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("no user");
      const hash = await hashPin(pinDraft, user.id);
      const { error } = await supabase.from("profiles").update({ parent_pin_hash: hash }).eq("id", user.id);
      if (error) throw error;
      markPinUnlocked(); // don't lock the parent out of the page they're on
      setPinSet(true); setPinEditing(false); setPinDraft(""); setPinConfirm("");
    } catch {
      setPinError(sw ? "Imeshindikana — jaribu tena" : "Could not save — try again");
    } finally { setPinBusy(false); }
  }

  async function removePin() {
    setPinBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("no user");
      const { error } = await supabase.from("profiles").update({ parent_pin_hash: null }).eq("id", user.id);
      if (error) throw error;
      setPinSet(false); setPinEditing(false); setPinDraft(""); setPinConfirm("");
    } catch {
      setPinError(sw ? "Imeshindikana — jaribu tena" : "Could not remove — try again");
    } finally { setPinBusy(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FFFBF0" }}>
      <header style={{ background: "white", borderBottom: "1px solid #E5E7EB", padding: "0 24px" }}>
        <div style={{ maxWidth: "680px", margin: "0 auto", height: "64px", display: "flex", alignItems: "center", gap: "16px" }}>
          <button onClick={() => router.push("/dashboard")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#9CA3AF" }}>
            {t.back}
          </button>
          <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "20px", fontWeight: 800, color: "#1E3A5F" }}>{t.title}</h1>
        </div>
      </header>

      <main style={{ maxWidth: "680px", margin: "0 auto", padding: "28px 24px" }}>

        {/* Language toggle */}
        <div className="card" style={{ padding: "24px", marginBottom: "20px" }}>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", fontWeight: 800, color: "#1E3A5F", marginBottom: "16px" }}>
            🌍 {lang === "sw" ? "Lugha ya Programu" : "App Language"}
          </h2>
          <div style={{ display: "flex", gap: "10px" }}>
            {(["en", "sw"] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)}
                style={{ flex: 1, padding: "14px", border: `2px solid ${lang === l ? "#F59E0B" : "#E5E7EB"}`, borderRadius: "12px", background: lang === l ? "#FEF3C7" : "white", cursor: "pointer", fontFamily: "'Baloo 2', cursive", fontWeight: 700, fontSize: "15px", color: "#1E3A5F", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
              >
                {l === "en" ? "🇬🇧 English" : "🇹🇿 Kiswahili"}
                {lang === l && <span style={{ fontSize: "16px" }}>✅</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Voice selection */}
        <div className="card" style={{ padding: "24px", marginBottom: "20px" }}>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", fontWeight: 800, color: "#1E3A5F", marginBottom: "16px" }}>
            {t.voiceTitle}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {VOICE_NAMES.map((name, i) => (
              <button key={name} onClick={() => updateSetting("voice", name)}
                style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", border: `2px solid ${settings.voice === name ? "#F59E0B" : "#E5E7EB"}`, borderRadius: "12px", background: settings.voice === name ? "#FEF3C7" : "white", cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ fontSize: "24px" }}>{VOICE_ICONS[i]}</span>
                <div>
                  <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "15px", fontWeight: 700, color: "#1E3A5F" }}>{name}</p>
                  <p style={{ fontSize: "12px", color: "#9CA3AF" }}>{t.voiceDescs[i]}</p>
                </div>
                {settings.voice === name && <span style={{ marginLeft: "auto", fontSize: "18px" }}>✅</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Font size */}
        <div className="card" style={{ padding: "24px", marginBottom: "20px" }}>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", fontWeight: 800, color: "#1E3A5F", marginBottom: "16px" }}>
            {t.textSizeTitle}
          </h2>
          <div style={{ display: "flex", gap: "10px" }}>
            {(["normal", "large", "xlarge"] as FontSize[]).map((size) => (
              <button key={size} onClick={() => updateSetting("fontSize", size)}
                style={{ flex: 1, padding: "14px", border: `2px solid ${settings.fontSize === size ? "#F59E0B" : "#E5E7EB"}`, borderRadius: "12px", background: settings.fontSize === size ? "#FEF3C7" : "white", cursor: "pointer", fontFamily: "'Baloo 2', cursive", fontWeight: 700, fontSize: size === "normal" ? "14px" : size === "large" ? "16px" : "18px", color: "#1E3A5F" }}
              >
                {t.textSizes[size]}
              </button>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div className="card" style={{ padding: "24px", marginBottom: "20px" }}>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", fontWeight: 800, color: "#1E3A5F", marginBottom: "16px" }}>
            {t.themeTitle}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {THEME_IDS.map((id, i) => (
              <button key={id} onClick={() => updateSetting("theme", id)}
                style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", border: `2px solid ${settings.theme === id ? "#F59E0B" : "#E5E7EB"}`, borderRadius: "12px", background: settings.theme === id ? "#FEF3C7" : "white", cursor: "pointer", textAlign: "left" }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "15px", fontWeight: 700, color: "#1E3A5F" }}>{t.themes[i].label}</p>
                  <p style={{ fontSize: "12px", color: "#9CA3AF" }}>{t.themes[i].desc}</p>
                </div>
                {settings.theme === id && <span style={{ fontSize: "18px" }}>✅</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Accessibility toggles */}
        <div className="card" style={{ padding: "24px", marginBottom: "20px" }}>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", fontWeight: 800, color: "#1E3A5F", marginBottom: "8px" }}>
            {t.accessibilityTitle}
          </h2>
          <Toggle
            icon={TOGGLE_ICONS[0]} label={t.toggles[0].label} desc={t.toggles[0].desc}
            checked={settings.slowSpeech} onChange={(v) => updateSetting("slowSpeech", v)}
          />
          <Toggle
            icon={TOGGLE_ICONS[1]} label={t.toggles[1].label} desc={t.toggles[1].desc}
            checked={settings.visualMode} onChange={(v) => updateSetting("visualMode", v)}
          />
          <Toggle
            icon={TOGGLE_ICONS[2]} label={t.toggles[2].label} desc={t.toggles[2].desc}
            checked={settings.highContrast} onChange={(v) => updateSetting("highContrast", v)}
          />
          <Toggle
            icon={TOGGLE_ICONS[3]} label={t.toggles[3].label} desc={t.toggles[3].desc}
            checked={settings.reduceMotion} onChange={(v) => updateSetting("reduceMotion", v)}
          />
          <Toggle
            icon={TOGGLE_ICONS[4]} label={t.toggles[4].label} desc={t.toggles[4].desc}
            checked={settings.soundEffects} onChange={(v) => updateSetting("soundEffects", v)}
          />
        </div>

        {/* Parent PIN */}
        <div className="card" style={{ padding: "24px", marginBottom: "20px" }}>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", fontWeight: 800, color: "#1E3A5F", marginBottom: "6px" }}>
            🔐 {sw ? "PIN ya Mzazi" : "Parent PIN"}
          </h2>
          <p style={{ fontSize: "13px", color: "#9CA3AF", marginBottom: "16px" }}>
            {sw
              ? "Ikiwashwa, kurasa za wazazi (dashibodi, mipangilio, maendeleo) zitahitaji PIN — mtoto anabaki kwenye masomo yake tu."
              : "When on, grown-up pages (dashboard, settings, progress) ask for a PIN — your child stays in their learning space."}
          </p>

          {pinSet === null ? (
            <p style={{ fontSize: "13px", color: "#9CA3AF" }}>…</p>
          ) : pinSet && !pinEditing ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span style={{ background: "#DCFCE7", color: "#15803D", borderRadius: "9999px", padding: "6px 14px", fontSize: "13px", fontWeight: 800 }}>
                ✅ {sw ? "PIN imewekwa" : "PIN is on"}
              </span>
              <button onClick={() => { setPinEditing(true); setPinError(""); }} disabled={pinBusy}
                style={{ padding: "9px 18px", border: "2px solid #E5E7EB", borderRadius: "12px", background: "white", fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "13px", color: "#1E3A5F", cursor: "pointer" }}>
                {sw ? "Badilisha PIN" : "Change PIN"}
              </button>
              <button onClick={removePin} disabled={pinBusy}
                style={{ padding: "9px 18px", border: "2px solid #FCA5A5", borderRadius: "12px", background: "#FFF1F2", fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "13px", color: "#EF4444", cursor: "pointer" }}>
                {sw ? "Ondoa PIN" : "Remove PIN"}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "300px" }}>
              <input
                type="password" inputMode="numeric" maxLength={4} value={pinDraft}
                onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, ""))}
                placeholder={sw ? "PIN mpya (tarakimu 4)" : "New PIN (4 digits)"}
                style={{ padding: "12px 16px", border: "2px solid #E5E7EB", borderRadius: "12px", fontSize: "16px", letterSpacing: "0.3em", fontWeight: 800 }}
              />
              <input
                type="password" inputMode="numeric" maxLength={4} value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
                placeholder={sw ? "Rudia PIN" : "Repeat PIN"}
                style={{ padding: "12px 16px", border: "2px solid #E5E7EB", borderRadius: "12px", fontSize: "16px", letterSpacing: "0.3em", fontWeight: 800 }}
              />
              {pinError && <p style={{ fontSize: "12px", fontWeight: 700, color: "#EF4444", margin: 0 }}>{pinError}</p>}
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={savePin} disabled={pinBusy}
                  style={{ flex: 1, padding: "12px", background: pinBusy ? "#9CA3AF" : "#FF8C00", color: "white", border: "none", borderRadius: "12px", fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "14px", cursor: pinBusy ? "default" : "pointer", boxShadow: pinBusy ? "none" : "0 3px 0 #CC6A00" }}>
                  {pinBusy ? "…" : sw ? "Hifadhi PIN" : "Save PIN"}
                </button>
                {pinSet && (
                  <button onClick={() => { setPinEditing(false); setPinDraft(""); setPinConfirm(""); setPinError(""); }} disabled={pinBusy}
                    style={{ padding: "12px 18px", background: "#F3F4F6", color: "#374151", border: "none", borderRadius: "12px", fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "14px", cursor: "pointer" }}>
                    {sw ? "Ghairi" : "Cancel"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: "12px", color: "#9CA3AF", lineHeight: 1.7 }}>
          {t.footer.split("\n").map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
        </p>
      </main>
    </div>
  );
}

// PIN-gated: these pages are for grown-ups. The gate only engages when the
// parent has set a PIN in Settings.
export default function SettingsPage() {
  return (
    <ParentGate>
      <SettingsInner />
    </ParentGate>
  );
}
