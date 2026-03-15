"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function mapError(msg: string): string {
  if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("already been registered"))
    return "An account with this email already exists. Log in instead.";
  if (msg.includes("Password should") || msg.includes("password"))
    return "Password is too weak. Use at least 8 characters with letters and numbers.";
  if (msg.includes("valid email") || msg.includes("Unable to validate"))
    return "Please enter a valid email address.";
  if (msg.includes("rate limit") || msg.includes("too many"))
    return "Too many attempts. Please wait a moment and try again.";
  if (msg.includes("network") || msg.includes("fetch"))
    return "Connection error. Check your internet and try again.";
  return msg;
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  const levels = [
    { label: "Weak",   color: "#EF4444" },
    { label: "Weak",   color: "#EF4444" },
    { label: "Fair",   color: "#2E8B2E" },
    { label: "Good",   color: "#10B981" },
    { label: "Strong", color: "#059669" },
  ];
  const { label, color } = levels[score];
  return (
    <div style={{ marginTop: "6px" }}>
      <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ flex: 1, height: "4px", borderRadius: "9999px", background: i < score ? color : "#E5E7EB", transition: "background 0.3s" }} />
        ))}
      </div>
      <p style={{ fontSize: "11px", color, fontWeight: 600 }}>{label}</p>
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]       = useState("");
  const [confirmed, setConfirmed] = useState(false);

  async function handleGoogleSignup() {
    setGoogleLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setError(mapError(error.message)); setGoogleLoading(false); }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) { setError(mapError(error.message)); setLoading(false); return; }

    // If session is null, email confirmation is required
    if (!data.session) {
      setConfirmed(true);
      setLoading(false);
      return;
    }

    // Session exists (confirmation disabled) — upsert profile and go to dashboard
    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email,
        full_name: name.trim(),
      }, { onConflict: "id" });
    }
    router.push("/dashboard");
  }

  // ── Email confirmation screen ─────────────────────────────────────────────
  if (confirmed) {
    return (
      <main style={{ minHeight: "100vh", background: "linear-gradient(135deg, #F4FAF4, #D1FAE5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ width: "100%", maxWidth: "420px", textAlign: "center" }}>
          <div style={{ width: "72px", height: "72px", background: "#D1FAE5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "36px", margin: "0 auto 20px" }}>📬</div>
          <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "24px", fontWeight: 800, color: "#1E3A8A", marginBottom: "10px" }}>Check your email</h1>
          <p style={{ fontSize: "15px", color: "#6B7280", lineHeight: 1.7, marginBottom: "8px" }}>
            We sent a confirmation link to <strong style={{ color: "#1E3A8A" }}>{email}</strong>.
          </p>
          <p style={{ fontSize: "14px", color: "#9CA3AF", marginBottom: "28px", lineHeight: 1.6 }}>
            Click the link in the email to activate your account, then log in here.
          </p>
          <button className="btn-primary" onClick={() => router.push("/login")} style={{ padding: "13px 36px", fontSize: "16px" }}>
            Go to Login →
          </button>
          <p style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "16px" }}>
            Didn&apos;t receive it? Check your spam folder.
          </p>
        </div>
      </main>
    );
  }

  // ── Signup form ───────────────────────────────────────────────────────────
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(135deg, #F4FAF4, #D1FAE5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>

        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ width: "56px", height: "56px", background: "#2E8B2E", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", boxShadow: "0 4px 0 #1F6B1F", margin: "0 auto 12px" }}>🎓</div>
          <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "26px", fontWeight: 800, color: "#1E3A8A" }}>Join Ticha</h1>
          <p style={{ fontSize: "14px", color: "#9CA3AF", marginTop: "4px" }}>Create a free parent account</p>
        </div>

        <div className="card" style={{ padding: "32px" }}>

          {/* Google */}
          <button
            onClick={handleGoogleSignup} type="button" disabled={googleLoading}
            style={{ width: "100%", padding: "13px", border: "2px solid #E5E7EB", borderRadius: "12px", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", fontSize: "15px", fontFamily: "'Nunito', sans-serif", fontWeight: 700, color: "#374151", marginBottom: "20px", opacity: googleLoading ? 0.6 : 1 }}
            onMouseEnter={(e) => { if (!googleLoading) e.currentTarget.style.borderColor = "#2E8B2E"; }}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "#E5E7EB"}
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4c-7.7 0-14.3 4.4-17.7 10.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.2 0-9.6-3-11.4-7.4l-6.5 5C9.5 39.4 16.3 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.5-2.6 4.6-4.8 6l6.2 5.2C40.4 35.7 44 30.3 44 24c0-1.3-.1-2.7-.4-4z"/>
            </svg>
            {googleLoading ? "Redirecting..." : "Continue with Google"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <div style={{ flex: 1, height: "1px", background: "#E5E7EB" }} />
            <span style={{ fontSize: "12px", color: "#9CA3AF", fontWeight: 600 }}>or with email</span>
            <div style={{ flex: 1, height: "1px", background: "#E5E7EB" }} />
          </div>

          <form onSubmit={handleSignup}>
            {/* Name */}
            <div style={{ marginBottom: "18px" }}>
              <label style={{ fontSize: "13px", fontWeight: 700, color: "#374151", display: "block", marginBottom: "6px" }}>Your name</label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)} required
                placeholder="e.g. Amina Juma"
                style={{ width: "100%", border: "2px solid #E5E7EB", borderRadius: "12px", padding: "12px 16px", fontSize: "16px", fontFamily: "'Nunito', sans-serif", outline: "none" }}
                onFocus={(e) => e.target.style.borderColor = "#2E8B2E"}
                onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
              />
            </div>

            {/* Email */}
            <div style={{ marginBottom: "18px" }}>
              <label style={{ fontSize: "13px", fontWeight: 700, color: "#374151", display: "block", marginBottom: "6px" }}>Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                placeholder="you@example.com"
                style={{ width: "100%", border: "2px solid #E5E7EB", borderRadius: "12px", padding: "12px 16px", fontSize: "16px", fontFamily: "'Nunito', sans-serif", outline: "none" }}
                onFocus={(e) => e.target.style.borderColor = "#2E8B2E"}
                onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "13px", fontWeight: 700, color: "#374151", display: "block", marginBottom: "6px" }}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPw ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)} required
                  placeholder="Min. 8 characters"
                  style={{ width: "100%", border: "2px solid #E5E7EB", borderRadius: "12px", padding: "12px 44px 12px 16px", fontSize: "16px", fontFamily: "'Nunito', sans-serif", outline: "none" }}
                  onFocus={(e) => e.target.style.borderColor = "#2E8B2E"}
                  onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
                />
                <button
                  type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "#9CA3AF", padding: 0 }}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? "🙈" : "👁️"}
                </button>
              </div>
              <PasswordStrength password={password} />
            </div>

            {error && (
              <div style={{ background: "#FEE2E2", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px", display: "flex", alignItems: "flex-start", gap: "8px" }}>
                <span style={{ fontSize: "14px", flexShrink: 0 }}>⚠️</span>
                <p style={{ color: "#B91C1C", fontSize: "13px", fontWeight: 600, margin: 0 }}>{error}</p>
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: "100%", padding: "14px", fontSize: "17px", opacity: loading ? 0.6 : 1, marginTop: "6px" }}>
              {loading ? "Creating account..." : "🚀 Create Account"}
            </button>

            <p style={{ textAlign: "center", fontSize: "13px", color: "#9CA3AF", marginTop: "20px" }}>
              Already have an account?{" "}
              <button type="button" onClick={() => router.push("/login")} style={{ background: "none", border: "none", cursor: "pointer", color: "#2E8B2E", fontWeight: 700, fontSize: "13px" }}>
                Log in
              </button>
            </p>
          </form>

          <p style={{ textAlign: "center", fontSize: "11px", color: "#9CA3AF", marginTop: "16px", lineHeight: 1.6 }}>
            🔒 Your data is private · ♿ Accessible by design · 🌍 Built for Africa
          </p>
        </div>
      </div>
    </main>
  );
}
