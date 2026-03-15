"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LandingPage() {
  const router = useRouter();

  return (
    <div style={{ fontFamily: "'Nunito', sans-serif", color: "#1E3A5F", overflowX: "hidden" }}>

      {/* ── Nav ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(255,255,255,0.96)",
        borderBottom: "2px solid rgba(46,139,46,0.10)",
        padding: "0 28px",
        backdropFilter: "blur(8px)",
      }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Image src="/images/ticha-logo.PNG" alt="Ticha" width={130} height={44} style={{ objectFit: "contain" }} priority />
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button onClick={() => router.push("/login")}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "15px", fontWeight: 700, color: "#6B7280", padding: "8px 16px", fontFamily: "'Nunito', sans-serif" }}>
              Log In
            </button>
            <button onClick={() => router.push("/signup")}
              style={{ background: "#2E8B2E", color: "white", border: "none", borderRadius: "9999px", padding: "11px 26px", fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "15px", cursor: "pointer", boxShadow: "0 4px 0 #1F6B1F", transition: "transform 0.12s" }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}>
              Get Started Free
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        background: "linear-gradient(145deg, #10B981 0%, #34D399 35%, #6EE7B7 65%, #FCD34D 100%)",
        padding: "64px 24px 80px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative blobs */}
        <div style={{ position: "absolute", top: "-80px", right: "-80px", width: "320px", height: "320px", borderRadius: "50%", background: "rgba(255,255,255,0.12)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-40px", left: "-60px", width: "240px", height: "240px", borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none" }} />

        <div style={{ maxWidth: "680px", margin: "0 auto", position: "relative" }}>

          {/* Competition badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.25)", border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: "9999px", padding: "6px 18px", marginBottom: "32px" }}>
            <span style={{ fontSize: "14px" }}>🏆</span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "white" }}>Google Gemini Live Agent Challenge 2026</span>
          </div>

          {/* Logo */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "28px" }}>
            <Image
              src="/images/ticha-logo.PNG"
              alt="Ticha — Learn English & African Languages"
              width={260}
              height={90}
              style={{ objectFit: "contain", filter: "drop-shadow(0 4px 24px rgba(0,0,0,0.15))" }}
              priority
            />
          </div>

          <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "clamp(26px, 5.5vw, 48px)", fontWeight: 800, lineHeight: 1.15, marginBottom: "16px", color: "white", textShadow: "0 2px 12px rgba(0,0,0,0.15)" }}>
            Learn English &amp; African Languages<br />
            <span style={{ color: "#FCD34D" }}>Through Real Conversation</span>
          </h1>

          <p style={{ fontSize: "clamp(15px, 2.5vw, 18px)", color: "rgba(255,255,255,0.92)", lineHeight: 1.75, marginBottom: "12px", maxWidth: "520px", margin: "0 auto 12px" }}>
            Ticha is an AI voice tutor built for African children. No reading, no typing — just talk.
          </p>
          <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.75)", marginBottom: "36px", fontStyle: "italic" }}>
            🌍 Starting with <strong style={{ color: "white", fontStyle: "normal" }}>Swahili ↔ English</strong> — spoken by 200 million people across East Africa
          </p>

          {/* CTA */}
          <button onClick={() => router.push("/signup")}
            style={{ background: "#FF8C00", color: "white", border: "none", borderRadius: "9999px", padding: "18px 52px", fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "20px", cursor: "pointer", boxShadow: "0 6px 0 #CC6A00, 0 10px 30px rgba(255,140,0,0.35)", transition: "transform 0.12s", display: "inline-block" }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}>
            🚀 Start Learning Free
          </button>

          <p style={{ marginTop: "18px" }}>
            <button onClick={() => router.push("/login")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", fontSize: "14px", fontWeight: 600, textDecoration: "underline", fontFamily: "'Nunito', sans-serif" }}>
              Already have an account? Log in →
            </button>
          </p>

          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", marginTop: "14px" }}>
            Free to start · No credit card · No reading required
          </p>
        </div>

        {/* Floating word cards */}
        <div style={{ marginTop: "52px", display: "flex", justifyContent: "center", gap: "clamp(10px, 2vw, 20px)", flexWrap: "wrap" }}>
          {[
            { emoji: "🦁", word: "Simba", sub: "Lion" },
            { emoji: "🔢", word: "Tatu = 3", sub: "Numbers" },
            { emoji: "🎨", word: "Nyekundu", sub: "Red" },
            { emoji: "👨‍👩‍👧", word: "Familia", sub: "Family" },
          ].map((card) => (
            <div key={card.word} style={{
              background: "rgba(255,255,255,0.22)",
              borderRadius: "20px", padding: "16px 22px",
              textAlign: "center", minWidth: "110px",
              border: "1.5px solid rgba(255,255,255,0.35)",
              backdropFilter: "blur(6px)",
            }}>
              <div style={{ fontSize: "32px", marginBottom: "6px" }}>{card.emoji}</div>
              <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "15px", fontWeight: 800, color: "white", margin: "0 0 2px" }}>{card.word}</p>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", margin: 0 }}>{card.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Language Mission Strip ── */}
      <section style={{ background: "white", padding: "36px 24px", borderBottom: "1px solid #F3F4F6" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "18px" }}>
            Languages
          </p>
          <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap", alignItems: "center" }}>
            {/* Active */}
            <div style={{ background: "#F0FDF4", border: "2px solid #22C55E", borderRadius: "16px", padding: "12px 22px", display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "22px" }}>🇰🇪</span>
              <div style={{ textAlign: "left" }}>
                <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "15px", fontWeight: 800, color: "#16A34A", margin: 0 }}>Swahili ↔ English</p>
                <p style={{ fontSize: "11px", color: "#22C55E", margin: 0, fontWeight: 700 }}>✓ Available now</p>
              </div>
            </div>
            {/* Coming soon */}
            {[
              { flag: "🇳🇬", lang: "Yoruba ↔ English" },
              { flag: "🇬🇭", lang: "Twi ↔ English" },
              { flag: "🇿🇦", lang: "Zulu ↔ English" },
            ].map((l) => (
              <div key={l.lang} style={{ background: "#F9FAFB", border: "2px solid #E5E7EB", borderRadius: "16px", padding: "12px 22px", display: "flex", alignItems: "center", gap: "10px", opacity: 0.65 }}>
                <span style={{ fontSize: "22px" }}>{l.flag}</span>
                <div style={{ textAlign: "left" }}>
                  <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "15px", fontWeight: 800, color: "#6B7280", margin: 0 }}>{l.lang}</p>
                  <p style={{ fontSize: "11px", color: "#9CA3AF", margin: 0, fontWeight: 700 }}>Coming soon</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: "72px 24px", background: "#F8FAFB" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "clamp(22px, 4vw, 34px)", fontWeight: 800, color: "#1E3A8A", marginBottom: "10px" }}>
              Built for the way children really learn
            </h2>
            <p style={{ fontSize: "15px", color: "#6B7280" }}>Real-time voice AI, designed for Africa</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
            {[
              { emoji: "🎙️", title: "Voice-Only Interaction", desc: "No reading or typing needed. The child simply talks — Ticha listens, responds, and teaches in real time.", color: "#EFF6FF", border: "#BFDBFE" },
              { emoji: "🌍", title: "Authentic African Context", desc: "Hooks rooted in East African culture — animals, family, community. Every lesson feels like home.", color: "#F0FDF4", border: "#BBF7D0" },
              { emoji: "🎮", title: "Gamified & Rewarding", desc: "XP, stars, streaks, and level titles keep children motivated and coming back every day.", color: "#FFF7ED", border: "#FED7AA" },
              { emoji: "🧠", title: "Structured CEFR A1 Lessons", desc: "3-exchange lesson design backed by language-learning research. Children genuinely retain what they learn.", color: "#FAF5FF", border: "#DDD6FE" },
              { emoji: "👨‍👩‍👧", title: "Parent Dashboard", desc: "Track every session, word learned, XP earned, and streak — all in one clean parent view.", color: "#F0FFFE", border: "#99F6E4" },
              { emoji: "♿", title: "Fully Accessible", desc: "High contrast, large touch targets, slow speech mode, and visual aids — no child excluded.", color: "#FFF1F2", border: "#FECDD3" },
            ].map((f) => (
              <div key={f.title} style={{ background: f.color, borderRadius: "22px", padding: "24px", display: "flex", gap: "16px", alignItems: "flex-start", border: `1.5px solid ${f.border}` }}>
                <div style={{ fontSize: "30px", flexShrink: 0, lineHeight: 1 }}>{f.emoji}</div>
                <div>
                  <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "16px", fontWeight: 800, marginBottom: "5px", color: "#1E3A8A" }}>{f.title}</p>
                  <p style={{ fontSize: "13px", color: "#6B7280", lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ background: "white", padding: "72px 24px" }}>
        <div style={{ maxWidth: "760px", margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "clamp(22px, 4vw, 34px)", fontWeight: 800, color: "#1E3A8A", marginBottom: "10px" }}>
            How Ticha works
          </h2>
          <p style={{ fontSize: "15px", color: "#6B7280", marginBottom: "48px" }}>Three steps. One conversation.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {[
              { step: "1", emoji: "👨‍👩‍👧", title: "Parent sets up a profile", desc: "Create your account, add your child's name and learning direction — English to Swahili or Swahili to English." },
              { step: "2", emoji: "🎤", title: "Child taps Start and just talks", desc: "Ticha greets them by name, introduces 5 words through vivid stories and real questions — entirely by voice." },
              { step: "3", emoji: "⭐", title: "Earn stars, build streaks", desc: "Every session awards XP and stars. Parents see the progress dashboard. Children see their level grow." },
            ].map((item) => (
              <div key={item.step} style={{ display: "flex", gap: "20px", alignItems: "flex-start", background: "#F9FAFB", borderRadius: "20px", padding: "22px 24px", textAlign: "left", border: "1.5px solid #F3F4F6" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "#1E3A8A", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Baloo 2', cursive", fontSize: "20px", fontWeight: 800, flexShrink: 0 }}>
                  {item.step}
                </div>
                <div>
                  <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "17px", fontWeight: 800, color: "#1E3A8A", marginBottom: "5px" }}>
                    {item.emoji} {item.title}
                  </p>
                  <p style={{ fontSize: "14px", color: "#6B7280", lineHeight: 1.65, margin: 0 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who it's for ── */}
      <section style={{ background: "#1E3A8A", padding: "64px 24px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "clamp(22px, 4vw, 34px)", fontWeight: 800, color: "white", marginBottom: "10px" }}>
            Who is Ticha for? 🌍
          </h2>
          <p style={{ color: "rgba(255,255,255,0.55)", marginBottom: "40px", fontSize: "15px" }}>
            Every child who deserves to grow up speaking their language.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "16px" }}>
            {[
              { emoji: "👦🏾", title: "African children", desc: "Learning English through play — no textbooks needed." },
              { emoji: "👧🏿", title: "Diaspora kids", desc: "Reconnecting with Swahili while living abroad." },
              { emoji: "🌐", title: "Swahili learners", desc: "Gateway to 200M+ speakers across East Africa." },
              { emoji: "♿", title: "All abilities", desc: "Visual mode, slow speech, high contrast — no child excluded." },
            ].map((item) => (
              <div key={item.title} style={{ background: "rgba(255,255,255,0.09)", borderRadius: "20px", padding: "24px 18px", border: "1px solid rgba(255,255,255,0.12)" }}>
                <div style={{ fontSize: "36px", marginBottom: "10px" }}>{item.emoji}</div>
                <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "15px", fontWeight: 800, color: "white", marginBottom: "6px" }}>{item.title}</p>
                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)", lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{
        background: "linear-gradient(145deg, #10B981 0%, #34D399 50%, #FCD34D 100%)",
        padding: "80px 24px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "500px", height: "500px", borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: "560px", margin: "0 auto" }}>
          <Image src="/images/ticha-logo.PNG" alt="Ticha" width={180} height={62} style={{ objectFit: "contain", marginBottom: "20px", filter: "drop-shadow(0 2px 12px rgba(0,0,0,0.1))" }} />
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "clamp(24px, 5vw, 40px)", fontWeight: 800, color: "white", marginBottom: "12px", textShadow: "0 2px 12px rgba(0,0,0,0.12)" }}>
            Ready to start? Twende! 🌍
          </h2>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "16px", marginBottom: "36px" }}>
            Free to start. No credit card. No reading required.
          </p>
          <button onClick={() => router.push("/signup")}
            style={{ background: "#FF8C00", color: "white", border: "none", borderRadius: "9999px", padding: "18px 56px", fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "20px", cursor: "pointer", boxShadow: "0 6px 0 #CC6A00, 0 12px 32px rgba(255,140,0,0.35)", transition: "transform 0.12s" }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}>
            🎓 Create Free Account
          </button>
          <p style={{ marginTop: "20px" }}>
            <button onClick={() => router.push("/login")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.65)", fontSize: "14px", fontWeight: 600, fontFamily: "'Nunito', sans-serif" }}>
              Parent login →
            </button>
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: "#0D1F3C", padding: "32px 24px", textAlign: "center" }}>
        <Image src="/images/ticha-logo.PNG" alt="Ticha" width={100} height={34} style={{ objectFit: "contain", opacity: 0.7, marginBottom: "12px" }} />
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", margin: 0 }}>
          Built for the Google Gemini Live Agent Challenge 2026 · 🌍 African Language AI · ♿ Accessible by design
        </p>
      </footer>

    </div>
  );
}
