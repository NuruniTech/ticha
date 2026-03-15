"use client";

import { useRouter } from "next/navigation";
import TichaAvatar from "@/components/TichaAvatar";

const FEATURES = [
  { emoji: "🎙️", title: "Voice-First Learning",   desc: "No reading or typing — just speak naturally. Perfect for young children." },
  { emoji: "📷", title: "Show & Tell with Camera", desc: "Show Ticha objects, she names them in both languages instantly." },
  { emoji: "🌍", title: "African Roots",            desc: "Authentic East African pronunciation, culture, and warmth — built for us." },
  { emoji: "♿", title: "Fully Accessible",          desc: "High-contrast, large text, slow speech, and visual mode for every child." },
  { emoji: "⭐", title: "Gamified & Fun",            desc: "Stars, streaks, and level titles keep children coming back every day." },
  { emoji: "👨‍👩‍👧", title: "Parent Dashboard",       desc: "Track progress, session history, and vocabulary growth in one place." },
];

export default function LandingPage() {
  const router = useRouter();

  return (
    <div style={{ fontFamily: "'Nunito', sans-serif", color: "#1E3A5F", overflowX: "hidden" }}>

      {/* ── Nav ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.95)", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "0 24px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <TichaAvatar state="idle" size={36} />
            <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: "22px", fontWeight: 800, color: "#1E3A8A" }}>Ticha</span>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button onClick={() => router.push("/login")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "15px", fontWeight: 700, color: "#6B7280", padding: "8px 14px" }}>
              Log in
            </button>
            <button onClick={() => router.push("/signup")} style={{ background: "#FF8C00", color: "white", border: "none", borderRadius: "9999px", padding: "10px 24px", fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "15px", cursor: "pointer", boxShadow: "0 4px 0 #CC6A00" }}>
              Get Started Free
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ background: "linear-gradient(160deg, #1A7A50 0%, #0D9488 55%, #2563EB 100%)", padding: "60px 24px 80px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        {/* Background circles decoration */}
        <div style={{ position: "absolute", top: "-60px", right: "-60px", width: "300px", height: "300px", borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "20px", left: "-80px", width: "250px", height: "250px", borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />

        <div style={{ maxWidth: "680px", margin: "0 auto", position: "relative" }}>
          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "9999px", padding: "6px 16px", marginBottom: "28px" }}>
            <span style={{ fontSize: "14px" }}>🏆</span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>Google Gemini Live Agent Challenge 2026</span>
          </div>

          <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
            <TichaAvatar state="idle" size={160} />
          </div>

          <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "clamp(32px, 7vw, 58px)", fontWeight: 800, lineHeight: 1.1, marginBottom: "18px", color: "white" }}>
            Learn Languages<br />with AI Friends!
          </h1>

          <p style={{ fontSize: "clamp(15px, 2.5vw, 18px)", color: "rgba(255,255,255,0.85)", lineHeight: 1.7, marginBottom: "36px", maxWidth: "500px", margin: "0 auto 36px" }}>
            Ticha is a real-time AI voice companion that teaches children to speak <strong style={{ color: "#FCD34D" }}>Swahili ↔ English</strong> — no reading, no typing, just conversation.
          </p>

          <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => router.push("/signup")} style={{ background: "#FF8C00", color: "white", border: "none", borderRadius: "9999px", padding: "16px 40px", fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "18px", cursor: "pointer", boxShadow: "0 5px 0 #CC6A00, 0 8px 24px rgba(255,140,0,0.4)", transition: "all 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
            >
              🚀 Start Learning Free
            </button>
            <button onClick={() => router.push("/login")} style={{ padding: "16px 32px", fontSize: "16px", background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.4)", borderRadius: "9999px", cursor: "pointer", fontFamily: "'Baloo 2', cursive", fontWeight: 700, color: "white", transition: "all 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.25)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.15)"; }}
            >
              I have an account
            </button>
          </div>

          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", marginTop: "20px" }}>
            🔒 No data sold · ♿ Fully accessible · 🌍 Built for Africa
          </p>
        </div>

        {/* Floating word cards */}
        <div style={{ marginTop: "52px", display: "flex", justifyContent: "center", gap: "clamp(10px, 2.5vw, 24px)", flexWrap: "wrap" }}>
          {[
            { emoji: "🦁", word: "Simba", sub: "Lion" },
            { emoji: "🔢", word: "Tatu = 3", sub: "Number" },
            { emoji: "🎨", word: "Nyekundu", sub: "Red" },
          ].map((card) => (
            <div key={card.word} style={{ background: "rgba(255,255,255,0.18)", borderRadius: "20px", padding: "18px 24px", textAlign: "center", minWidth: "130px", border: "1px solid rgba(255,255,255,0.25)", backdropFilter: "blur(4px)" }} className="animate-pop-in">
              <div style={{ fontSize: "36px", marginBottom: "6px" }}>{card.emoji}</div>
              <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "16px", fontWeight: 800, color: "white", marginBottom: "2px" }}>{card.word}</p>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.65)" }}>{card.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Topics strip ── */}
      <section style={{ background: "white", padding: "40px 24px", borderBottom: "1px solid #F3F4F6" }}>
        <div style={{ maxWidth: "860px", margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "22px" }}>
            Learning topics
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { emoji: "🦁", label: "Animals", sub: "Wanyama",  bg: "#FFF7ED", color: "#FF8C00" },
              { emoji: "🎨", label: "Colors",  sub: "Rangi",    bg: "#FAF5FF", color: "#9B59F5" },
              { emoji: "🔢", label: "Numbers", sub: "Nambari",  bg: "#EFF6FF", color: "#4B8BF5" },
              { emoji: "💬", label: "Free Talk", sub: "Ongea",  bg: "#F0FDF4", color: "#22C55E" },
            ].map((t) => (
              <div key={t.label} style={{ background: t.bg, borderRadius: "16px", padding: "14px 20px", display: "flex", alignItems: "center", gap: "10px", border: `1px solid ${t.color}22` }}>
                <span style={{ fontSize: "24px" }}>{t.emoji}</span>
                <div style={{ textAlign: "left" }}>
                  <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "15px", fontWeight: 800, color: t.color, margin: 0 }}>{t.label}</p>
                  <p style={{ fontSize: "11px", color: "#9CA3AF", margin: 0 }}>{t.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: "72px 24px", background: "#F9FAFB" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, color: "#1E3A8A", marginBottom: "10px" }}>
              Everything a child needs
            </h2>
            <p style={{ fontSize: "16px", color: "#9CA3AF" }}>Built for the way African children actually learn</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ background: "white", borderRadius: "20px", padding: "24px", display: "flex", gap: "16px", alignItems: "flex-start", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", border: "1px solid #F3F4F6" }}>
                <div style={{ width: "48px", height: "48px", background: "#F0FDF4", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", flexShrink: 0 }}>
                  {f.emoji}
                </div>
                <div>
                  <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "16px", fontWeight: 800, marginBottom: "5px", color: "#1E3A8A" }}>{f.title}</p>
                  <p style={{ fontSize: "13px", color: "#6B7280", lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who it's for ── */}
      <section style={{ background: "#1E3A8A", padding: "60px 24px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "clamp(24px, 4vw, 34px)", fontWeight: 800, color: "white", marginBottom: "10px" }}>
            Who is Ticha for? 🌍
          </h2>
          <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: "40px", fontSize: "15px" }}>
            Anyone who feels the distance of a language barrier.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            {[
              { emoji: "👦🏾", title: "African children", desc: "Learning English through play — no textbooks needed." },
              { emoji: "👧🏿", title: "Diaspora kids", desc: "Reconnecting with Swahili while living abroad." },
              { emoji: "🌐", title: "Swahili learners", desc: "Gateway to 200M+ Swahili speakers worldwide." },
              { emoji: "♿", title: "Children with disabilities", desc: "Visual mode, slow speech, high contrast — no child excluded." },
            ].map((item) => (
              <div key={item.title} style={{ background: "rgba(255,255,255,0.08)", borderRadius: "18px", padding: "24px 18px" }}>
                <div style={{ fontSize: "36px", marginBottom: "10px" }}>{item.emoji}</div>
                <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "15px", fontWeight: 800, color: "white", marginBottom: "6px" }}>{item.title}</p>
                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section style={{ padding: "72px 24px", background: "white" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 800, textAlign: "center", marginBottom: "40px", color: "#1E3A8A" }}>
            What families are saying 💬
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "18px" }}>
            {[
              { name: "Amina K.", role: "Parent, Nairobi", text: "My daughter forgot most of her Swahili after we moved to London. Two weeks with Ticha and she's speaking confidently again!" },
              { name: "James O.", role: "Teacher, Dar es Salaam", text: "The camera feature is genius — children love showing Ticha objects and hearing the word in both languages." },
              { name: "Fatuma M.", role: "Parent, Minnesota", text: "Finally an app that speaks to our children the way we do — warm, patient, and full of African joy." },
            ].map((t) => (
              <div key={t.name} style={{ background: "#F9FAFB", borderRadius: "20px", padding: "24px", border: "1px solid #F3F4F6" }}>
                <div style={{ fontSize: "20px", color: "#2E8B2E", marginBottom: "10px" }}>★★★★★</div>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.7, marginBottom: "16px", fontStyle: "italic" }}>&ldquo;{t.text}&rdquo;</p>
                <p style={{ fontWeight: 800, fontSize: "14px", color: "#1E3A8A" }}>{t.name}</p>
                <p style={{ fontSize: "12px", color: "#9CA3AF" }}>{t.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: "linear-gradient(135deg, #1A7A50 0%, #0D9488 100%)", padding: "80px 24px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "600px", height: "600px", borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <TichaAvatar state="idle" size={110} />
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "clamp(26px, 5vw, 42px)", fontWeight: 800, color: "white", marginBottom: "14px" }}>
            Ready to start? Twende! 🌍
          </h2>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "16px", marginBottom: "36px" }}>
            Free to start. No credit card. No reading required.
          </p>
          <button onClick={() => router.push("/signup")} style={{ background: "#FF8C00", color: "white", border: "none", borderRadius: "9999px", padding: "18px 52px", fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "20px", cursor: "pointer", boxShadow: "0 5px 0 #CC6A00, 0 10px 30px rgba(255,140,0,0.4)", transition: "all 0.15s" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
          >
            🎓 Create Free Account
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: "#0D1F3C", padding: "32px 24px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "12px" }}>
          <TichaAvatar state="idle" size={28} />
          <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: "16px", fontWeight: 800, color: "white" }}>Ticha</span>
        </div>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>
          Built for the Google Gemini Live Agent Challenge 2026 · 🌍 African Language AI · ♿ Accessible by design
        </p>
      </footer>
    </div>
  );
}
