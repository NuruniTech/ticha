"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Suspense } from "react";

function mapError(msg: string): string {
  if (msg.includes("Invalid login credentials") || msg.includes("invalid_credentials") || msg.includes("Invalid email or password"))
    return "Incorrect email or password. Please try again.";
  if (msg.includes("Email not confirmed"))
    return "Please confirm your email before logging in. Check your inbox.";
  if (msg.includes("rate limit") || msg.includes("too many"))
    return "Too many attempts. Please wait a few minutes and try again.";
  if (msg.includes("network") || msg.includes("fetch"))
    return "Connection error. Check your internet and try again.";
  return msg;
}

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]       = useState("");
  const [resetSent, setResetSent]   = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [view, setView]         = useState<"login" | "forgot">("login");

  useEffect(() => {
    if (searchParams.get("error")) setError("Authentication failed. Please try again.");
  }, [searchParams]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(mapError(error.message)); setLoading(false); return; }
    router.push("/dashboard");
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setError(mapError(error.message)); setGoogleLoading(false); }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Enter your email address above first."); return; }
    setResetLoading(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setResetLoading(false);
    if (error) { setError(mapError(error.message)); return; }
    setResetSent(true);
  }

  // ── Forgot password view ──────────────────────────────────────────────────
  if (view === "forgot") {
    return (
      <main style={{ minHeight: "100vh", background: "linear-gradient(135deg, #F4FAF4, #E8F5E9)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ width: "100%", maxWidth: "420px" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <div style={{ width: "56px", height: "56px", background: "#2E8B2E", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", boxShadow: "0 4px 0 #1F6B1F", margin: "0 auto 12px" }}>🎓</div>
            <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "24px", fontWeight: 800, color: "#1E3A8A" }}>Reset Password</h1>
            <p style={{ fontSize: "14px", color: "#9CA3AF", marginTop: "4px" }}>We&apos;ll send you a reset link</p>
          </div>

          <div className="card" style={{ padding: "32px" }}>
            {resetSent ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>📬</div>
                <p style={{ fontSize: "15px", color: "#1E3A8A", fontWeight: 700, marginBottom: "8px" }}>Check your inbox</p>
                <p style={{ fontSize: "13px", color: "#6B7280", lineHeight: 1.6, marginBottom: "24px" }}>
                  We sent a password reset link to <strong>{email}</strong>.
                </p>
                <button className="btn-primary" onClick={() => { setView("login"); setResetSent(false); }} style={{ padding: "12px 28px", fontSize: "15px" }}>
                  Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword}>
                <div style={{ marginBottom: "18px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "#374151", display: "block", marginBottom: "6px" }}>Email address</label>
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    placeholder="you@example.com"
                    style={{ width: "100%", border: "2px solid #E5E7EB", borderRadius: "12px", padding: "12px 16px", fontSize: "16px", fontFamily: "'Nunito', sans-serif", outline: "none" }}
                    onFocus={(e) => e.target.style.borderColor = "#2E8B2E"}
                    onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
                  />
                </div>

                {error && (
                  <div style={{ background: "#FEE2E2", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px", display: "flex", gap: "8px" }}>
                    <span style={{ fontSize: "14px", flexShrink: 0 }}>⚠️</span>
                    <p style={{ color: "#B91C1C", fontSize: "13px", fontWeight: 600, margin: 0 }}>{error}</p>
                  </div>
                )}

                <button type="submit" className="btn-primary" disabled={resetLoading} style={{ width: "100%", padding: "14px", fontSize: "16px", opacity: resetLoading ? 0.6 : 1, marginBottom: "14px" }}>
                  {resetLoading ? "Sending..." : "Send Reset Link"}
                </button>

                <p style={{ textAlign: "center", fontSize: "13px", color: "#9CA3AF" }}>
                  <button type="button" onClick={() => { setView("login"); setError(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#2E8B2E", fontWeight: 700, fontSize: "13px" }}>
                    ← Back to Login
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ── Login view ────────────────────────────────────────────────────────────
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(135deg, #F4FAF4, #E8F5E9)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>

        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ width: "56px", height: "56px", background: "#2E8B2E", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", boxShadow: "0 4px 0 #1F6B1F", margin: "0 auto 12px" }}>🎓</div>
          <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "26px", fontWeight: 800, color: "#1E3A8A" }}>Welcome back!</h1>
          <p style={{ fontSize: "14px", color: "#9CA3AF", marginTop: "4px" }}>Log in to your Ticha account</p>
        </div>

        <div className="card" style={{ padding: "32px" }}>

          {/* Google */}
          <button
            onClick={handleGoogleLogin} disabled={googleLoading}
            style={{ width: "100%", padding: "13px", border: "2px solid #E5E7EB", borderRadius: "12px", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", fontSize: "15px", fontFamily: "'Nunito', sans-serif", fontWeight: 700, color: "#374151", marginBottom: "20px", opacity: googleLoading ? 0.6 : 1 }}
            onMouseEnter={(e) => { if (!googleLoading) e.currentTarget.style.borderColor = "#2E8B2E"; }}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "#E5E7EB"}
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.4-4z"/>
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

          <form onSubmit={handleLogin}>
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

            <div style={{ marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ fontSize: "13px", fontWeight: 700, color: "#374151" }}>Password</label>
                <button type="button" onClick={() => { setView("forgot"); setError(""); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#2E8B2E", fontWeight: 700, fontSize: "12px", padding: 0 }}>
                  Forgot password?
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showPw ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)} required
                  placeholder="••••••••"
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
            </div>

            {error && (
              <div style={{ background: "#FEE2E2", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px", display: "flex", gap: "8px", marginTop: "12px" }}>
                <span style={{ fontSize: "14px", flexShrink: 0 }}>⚠️</span>
                <p style={{ color: "#B91C1C", fontSize: "13px", fontWeight: 600, margin: 0 }}>{error}</p>
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: "100%", padding: "14px", fontSize: "17px", opacity: loading ? 0.6 : 1, marginTop: "16px" }}>
              {loading ? "Logging in..." : "Log In →"}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: "13px", color: "#9CA3AF", marginTop: "20px" }}>
            No account?{" "}
            <button type="button" onClick={() => router.push("/signup")} style={{ background: "none", border: "none", cursor: "pointer", color: "#2E8B2E", fontWeight: 700, fontSize: "13px" }}>
              Sign up free
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
