"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/context/LanguageContext";
import { hashPin, isPinUnlocked, markPinUnlocked, FRESH_LOGIN_WINDOW_MS } from "@/lib/pin";

// Wraps parent-only pages (dashboard, settings, progress). If the parent has
// set a PIN, a child cannot get past this overlay. Unlock lasts for the
// browser tab; a fresh sign-in (< 2 min) auto-unlocks, which is also the
// "forgot PIN" path (sign out → sign back in → change PIN in settings).
export default function ParentGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { lang } = useLanguage();
  const sw = lang === "sw";

  const [status, setStatus]     = useState<"checking" | "locked" | "open">("checking");
  const [pinHash, setPinHash]   = useState<string>("");
  const [userId, setUserId]     = useState<string>("");
  const [entered, setEntered]   = useState<string>("");
  const [shake, setShake]       = useState(false);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        if (isPinUnlocked()) { setStatus("open"); return; }
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setStatus("open"); return; } // middleware handles auth redirects
        // Fresh sign-in proves a grown-up is present
        const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;
        if (Date.now() - lastSignIn < FRESH_LOGIN_WINDOW_MS) {
          markPinUnlocked();
          setStatus("open");
          return;
        }
        const { data: profile } = await supabase
          .from("profiles").select("parent_pin_hash").eq("id", user.id).single();
        if (cancelled) return;
        if (!profile?.parent_pin_hash) { setStatus("open"); return; } // no PIN set
        setPinHash(profile.parent_pin_hash);
        setUserId(user.id);
        setStatus("locked");
      } catch {
        // Offline or profile fetch failed — fail open (this is a child gate,
        // not account security; the account password is the real boundary)
        if (!cancelled) setStatus("open");
      }
    }
    check();
    return () => { cancelled = true; };
  }, []);

  const tryDigit = useCallback(async (digit: string) => {
    if (entered.length >= 4) return;
    const next = entered + digit;
    setEntered(next);
    if (next.length < 4) return;
    const hash = await hashPin(next, userId);
    if (hash === pinHash) {
      markPinUnlocked();
      setStatus("open");
    } else {
      setAttempts((a) => a + 1);
      setShake(true);
      setTimeout(() => { setShake(false); setEntered(""); }, 500);
    }
  }, [entered, pinHash, userId]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (status === "open") return <>{children}</>;

  if (status === "checking") {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #1E3A8A 0%, #0D1F5C 100%)" }} />
    );
  }

  // ── Locked: PIN pad ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #1E3A8A 0%, #0D1F5C 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px", fontFamily: "'Nunito', sans-serif" }}>
      <style>{`
        @keyframes pgShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-9px)} 40%{transform:translateX(9px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
      `}</style>

      <div style={{ fontSize: "44px", marginBottom: "10px" }}>🔐</div>
      <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "24px", fontWeight: 800, color: "white", margin: "0 0 6px", textAlign: "center" }}>
        {sw ? "Eneo la Wazazi" : "Grown-Ups Only"}
      </h1>
      <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)", margin: "0 0 26px", textAlign: "center" }}>
        {sw ? "Weka PIN ya mzazi kuendelea" : "Enter the parent PIN to continue"}
      </p>

      {/* PIN dots */}
      <div style={{ display: "flex", gap: "14px", marginBottom: "10px", animation: shake ? "pgShake 0.45s ease-in-out" : "none" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            width: "18px", height: "18px", borderRadius: "50%",
            background: i < entered.length ? "#FCD34D" : "rgba(255,255,255,0.15)",
            border: "2px solid rgba(255,255,255,0.35)",
            transition: "background 0.15s",
          }} />
        ))}
      </div>
      <p style={{ fontSize: "12px", fontWeight: 700, color: "#FCA5A5", minHeight: "18px", margin: "0 0 16px" }}>
        {attempts > 0 ? (sw ? "PIN si sahihi — jaribu tena" : "Wrong PIN — try again") : ""}
      </p>

      {/* Keypad */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 72px)", gap: "12px" }}>
        {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((key, i) => (
          key === "" ? <div key={i} /> : (
            <button
              key={i}
              onClick={() => key === "⌫" ? setEntered((e) => e.slice(0, -1)) : tryDigit(key)}
              style={{
                height: "72px", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.08)", color: "white",
                fontFamily: "'Baloo 2', cursive", fontSize: key === "⌫" ? "20px" : "26px", fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {key}
            </button>
          )
        ))}
      </div>

      {/* Escape hatches */}
      <button onClick={() => router.back()} style={{ marginTop: "28px", background: "rgba(255,255,255,0.12)", border: "1.5px solid rgba(255,255,255,0.25)", borderRadius: "9999px", padding: "11px 28px", color: "white", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "'Baloo 2', cursive" }}>
        {sw ? "← Rudi kwenye masomo" : "← Back to learning"}
      </button>
      <button onClick={signOut} style={{ marginTop: "12px", background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "12px", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>
        {sw ? "Umesahau PIN? Toka uingie tena — utaweza kuiweka upya" : "Forgot PIN? Sign out and back in — then you can reset it"}
      </button>
    </div>
  );
}
