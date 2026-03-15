"use client";

import { useRouter } from "next/navigation";
import { useAccessibility } from "@/context/AccessibilityContext";
import { Theme, FontSize, VoiceName } from "@/types";

const VOICES: { name: VoiceName; label: string; desc: string }[] = [
  { name: "Aoede",  label: "Aoede 👩🏾",  desc: "Warm, friendly female voice" },
  { name: "Kore",   label: "Kore 👩🏿",   desc: "Clear, energetic female voice" },
  { name: "Puck",   label: "Puck 👦🏾",   desc: "Playful, enthusiastic male voice" },
  { name: "Zephyr", label: "Zephyr 👨🏽", desc: "Calm, steady male voice" },
  { name: "Charon", label: "Charon 👴🏾", desc: "Deep, warm male voice" },
];

export default function SettingsPage() {
  const router = useRouter();
  const { settings, updateSetting } = useAccessibility();

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

  return (
    <div style={{ minHeight: "100vh", background: "#FFFBF0" }}>
      <header style={{ background: "white", borderBottom: "1px solid #E5E7EB", padding: "0 24px" }}>
        <div style={{ maxWidth: "680px", margin: "0 auto", height: "64px", display: "flex", alignItems: "center", gap: "16px" }}>
          <button onClick={() => router.push("/dashboard")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#9CA3AF" }}>
            ← Back
          </button>
          <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "20px", fontWeight: 800, color: "#1E3A5F" }}>⚙️ Settings</h1>
        </div>
      </header>

      <main style={{ maxWidth: "680px", margin: "0 auto", padding: "28px 24px" }}>

        {/* Voice selection */}
        <div className="card" style={{ padding: "24px", marginBottom: "20px" }}>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", fontWeight: 800, color: "#1E3A5F", marginBottom: "16px" }}>
            🗣️ Ticha&apos;s Voice
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {VOICES.map((v) => (
              <button key={v.name} onClick={() => updateSetting("voice", v.name)}
                style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", border: `2px solid ${settings.voice === v.name ? "#F59E0B" : "#E5E7EB"}`, borderRadius: "12px", background: settings.voice === v.name ? "#FEF3C7" : "white", cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ fontSize: "24px" }}>{v.label.split(" ")[1]}</span>
                <div>
                  <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "15px", fontWeight: 700, color: "#1E3A5F" }}>{v.label.split(" ")[0]}</p>
                  <p style={{ fontSize: "12px", color: "#9CA3AF" }}>{v.desc}</p>
                </div>
                {settings.voice === v.name && <span style={{ marginLeft: "auto", fontSize: "18px" }}>✅</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Font size */}
        <div className="card" style={{ padding: "24px", marginBottom: "20px" }}>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", fontWeight: 800, color: "#1E3A5F", marginBottom: "16px" }}>
            🔡 Text Size
          </h2>
          <div style={{ display: "flex", gap: "10px" }}>
            {(["normal", "large", "xlarge"] as FontSize[]).map((size) => (
              <button key={size} onClick={() => updateSetting("fontSize", size)}
                style={{ flex: 1, padding: "14px", border: `2px solid ${settings.fontSize === size ? "#F59E0B" : "#E5E7EB"}`, borderRadius: "12px", background: settings.fontSize === size ? "#FEF3C7" : "white", cursor: "pointer", fontFamily: "'Baloo 2', cursive", fontWeight: 700, fontSize: size === "normal" ? "14px" : size === "large" ? "16px" : "18px", color: "#1E3A5F" }}
              >
                {size === "normal" ? "Normal" : size === "large" ? "Large" : "X-Large"}
              </button>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div className="card" style={{ padding: "24px", marginBottom: "20px" }}>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", fontWeight: 800, color: "#1E3A5F", marginBottom: "16px" }}>
            🎨 Display Theme
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {([
              ["default",       "🌟 Default",        "Warm yellows and greens"],
              ["high-contrast", "⬛ High Contrast",   "Black & white, maximum readability for low vision"],
              ["colorblind",    "👁️ Colorblind Safe", "Optimised for colour vision deficiency"],
            ] as [Theme, string, string][]).map(([id, label, desc]) => (
              <button key={id} onClick={() => updateSetting("theme", id)}
                style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", border: `2px solid ${settings.theme === id ? "#F59E0B" : "#E5E7EB"}`, borderRadius: "12px", background: settings.theme === id ? "#FEF3C7" : "white", cursor: "pointer", textAlign: "left" }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "15px", fontWeight: 700, color: "#1E3A5F" }}>{label}</p>
                  <p style={{ fontSize: "12px", color: "#9CA3AF" }}>{desc}</p>
                </div>
                {settings.theme === id && <span style={{ fontSize: "18px" }}>✅</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Accessibility toggles */}
        <div className="card" style={{ padding: "24px", marginBottom: "20px" }}>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "18px", fontWeight: 800, color: "#1E3A5F", marginBottom: "8px" }}>
            ♿ Accessibility
          </h2>
          <Toggle
            icon="🐢" label="Slow Speech Mode"
            desc="Ticha speaks slower and more clearly — great for beginners and young learners"
            checked={settings.slowSpeech}
            onChange={(v) => updateSetting("slowSpeech", v)}
          />
          <Toggle
            icon="👁️" label="Visual Mode"
            desc="For deaf / hard-of-hearing learners — large emoji animations and text replace audio responses"
            checked={settings.visualMode}
            onChange={(v) => updateSetting("visualMode", v)}
          />
          <Toggle
            icon="🌗" label="High Contrast"
            desc="Maximum colour contrast for low vision or bright screen conditions"
            checked={settings.highContrast}
            onChange={(v) => updateSetting("highContrast", v)}
          />
          <Toggle
            icon="✋" label="Reduce Motion"
            desc="Disable animations — helpful for motion sensitivity or epilepsy"
            checked={settings.reduceMotion}
            onChange={(v) => updateSetting("reduceMotion", v)}
          />
        </div>

        <p style={{ textAlign: "center", fontSize: "12px", color: "#9CA3AF", lineHeight: 1.7 }}>
          Settings are saved automatically on this device.<br />
          ♿ Ticha is built to be accessible to every child.
        </p>
      </main>
    </div>
  );
}
