"use client";

import { useRouter } from "next/navigation";
import { useAccessibility } from "@/context/AccessibilityContext";
import { useLanguage } from "@/context/LanguageContext";
import { T } from "@/lib/translations";
import { Theme, FontSize, VoiceName } from "@/types";

const VOICE_NAMES: VoiceName[] = ["Aoede", "Kore"];
const VOICE_ICONS = ["👩🏾", "👩🏿"];
const THEME_IDS: Theme[] = ["default", "high-contrast", "colorblind"];

export default function SettingsPage() {
  const router = useRouter();
  const { settings, updateSetting } = useAccessibility();
  const { lang, setLang } = useLanguage();
  const t = T[lang].settings;

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

  const TOGGLE_ICONS = ["🐢", "👁️", "🌗", "✋"];

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
        </div>

        <p style={{ textAlign: "center", fontSize: "12px", color: "#9CA3AF", lineHeight: 1.7 }}>
          {t.footer.split("\n").map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
        </p>
      </main>
    </div>
  );
}
