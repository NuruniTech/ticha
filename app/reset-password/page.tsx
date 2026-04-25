"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { useLanguage } from "@/context/LanguageContext";
import { T } from "@/lib/translations";

export default function ResetPasswordPage() {
  const router      = useRouter();
  const { lang }    = useLanguage();
  const t           = T[lang].resetPassword;

  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [done, setDone]             = useState(false);
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionReady(!!data.session);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError(t.errors.tooShort);
      return;
    }
    if (password !== confirm) {
      setError(t.errors.noMatch);
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(t.errors.generic);
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/dashboard"), 2500);
  }

  // Still checking session
  if (sessionReady === null) {
    return (
      <main style={{ minHeight: "100vh", background: "linear-gradient(135deg, #F4FAF4, #E8F5E9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#6B7280", fontFamily: "'Nunito', sans-serif", fontSize: "15px" }}>Loading...</p>
      </main>
    );
  }

  // Link expired or user navigated here directly without a recovery session
  if (!sessionReady) {
    return (
      <main style={{ minHeight: "100vh", background: "linear-gradient(135deg, #F4FAF4, #E8F5E9)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ width: "100%", maxWidth: "420px" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
              <Image src="/images/ticha-login.PNG" alt="Ticha" width={110} height={110} style={{ objectFit: "contain" }} />
            </div>
          </div>
          <div className="card" style={{ padding: "32px", textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>⏳</div>
            <p style={{ fontSize: "15px", color: "#1E3A8A", fontWeight: 700, marginBottom: "8px" }}>
              {lang === "sw" ? "Kiungo kimekwisha muda" : "This link has expired"}
            </p>
            <p style={{ fontSize: "13px", color: "#6B7280", lineHeight: 1.6, marginBottom: "24px" }}>
              {lang === "sw"
                ? "Tafadhali omba kiungo kipya cha kubadilisha nywila."
                : "Please request a new password reset link."}
            </p>
            <button
              className="btn-primary"
              onClick={() => router.push("/login")}
              style={{ padding: "12px 28px", fontSize: "15px" }}
            >
              {lang === "sw" ? "Rudi kwenye Kuingia" : "Back to Login"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(135deg, #F4FAF4, #E8F5E9)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>

        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
            <Image src="/images/ticha-login.PNG" alt="Ticha" width={110} height={110} style={{ objectFit: "contain" }} />
          </div>
          <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "24px", fontWeight: 800, color: "#1E3A8A" }}>{t.title}</h1>
          <p style={{ fontSize: "14px", color: "#9CA3AF", marginTop: "4px" }}>{t.subtitle}</p>
        </div>

        <div className="card" style={{ padding: "32px" }}>
          {done ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>✅</div>
              <p style={{ fontSize: "15px", color: "#1E3A8A", fontWeight: 700, marginBottom: "8px" }}>{t.successTitle}</p>
              <p style={{ fontSize: "13px", color: "#6B7280", lineHeight: 1.6 }}>{t.successDesc}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "18px" }}>
                <label style={{ fontSize: "13px", fontWeight: 700, color: "#374151", display: "block", marginBottom: "6px" }}>
                  {t.newPasswordLabel}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Min. 8 characters"
                    style={{ width: "100%", border: "2px solid #E5E7EB", borderRadius: "12px", padding: "12px 44px 12px 16px", fontSize: "16px", fontFamily: "'Nunito', sans-serif", outline: "none" }}
                    onFocus={(e) => e.target.style.borderColor = "#2E8B2E"}
                    onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "#9CA3AF", padding: 0 }}
                  >
                    {showPw ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: "8px" }}>
                <label style={{ fontSize: "13px", fontWeight: 700, color: "#374151", display: "block", marginBottom: "6px" }}>
                  {t.confirmPasswordLabel}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    placeholder="Repeat your new password"
                    style={{ width: "100%", border: "2px solid #E5E7EB", borderRadius: "12px", padding: "12px 44px 12px 16px", fontSize: "16px", fontFamily: "'Nunito', sans-serif", outline: "none" }}
                    onFocus={(e) => e.target.style.borderColor = "#2E8B2E"}
                    onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "#9CA3AF", padding: 0 }}
                  >
                    {showConfirm ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ background: "#FEE2E2", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px", display: "flex", gap: "8px", marginTop: "12px" }}>
                  <span style={{ fontSize: "14px", flexShrink: 0 }}>⚠️</span>
                  <p style={{ color: "#B91C1C", fontSize: "13px", fontWeight: 600, margin: 0 }}>{error}</p>
                </div>
              )}

              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ width: "100%", padding: "14px", fontSize: "17px", opacity: loading ? 0.6 : 1, marginTop: "16px" }}
              >
                {loading ? t.saving : t.saveBtn}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
