"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import VoiceSession from "@/components/VoiceSession";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useLanguage } from "@/context/LanguageContext";
import { T } from "@/lib/translations";
import TichaAvatar from "@/components/TichaAvatar";

function SessionContent() {
  const params   = useSearchParams();
  const router   = useRouter();
  const isOnline = useOnlineStatus();
  const { lang } = useLanguage();
  const t        = T[lang].offline;

  const name        = params.get("name")    || "Friend";
  const sessionLang = params.get("lang")    || "sw";
  const game        = params.get("game")    || "animals";
  const childId     = params.get("childId") || null;
  const childAge    = params.get("age")  ? parseInt(params.get("age")!)  : undefined;
  const childXp     = params.get("xp")   ? parseInt(params.get("xp")!)  : 0;
  const prevSessions= params.get("prev") ? parseInt(params.get("prev")!) : 0;

  // ── Offline wall ───────────────────────────────────────────────────────────
  if (!isOnline) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #A4C4F8 0%, #D4B4F8 50%, #F8B4D4 100%)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "32px", textAlign: "center",
        fontFamily: "'Nunito', sans-serif",
      }}>
        <TichaAvatar state="idle" size={110} />
        <div style={{ fontSize: "48px", margin: "16px 0 8px" }}>📡</div>
        <h2 style={{
          fontFamily: "'Baloo 2', cursive", fontSize: "22px",
          fontWeight: 800, color: "white", marginBottom: "12px",
        }}>
          {t.sessionTitle}
        </h2>
        <p style={{
          fontSize: "15px", color: "rgba(255,255,255,0.85)",
          lineHeight: 1.65, maxWidth: "300px", marginBottom: "28px",
        }}>
          {t.sessionDesc}
        </p>
        <button
          onClick={() => router.back()}
          style={{
            background: "white", color: "#4B8BF5", border: "none",
            borderRadius: "16px", padding: "13px 32px",
            fontFamily: "'Baloo 2', cursive", fontWeight: 800,
            fontSize: "16px", cursor: "pointer",
          }}
        >
          {t.sessionBack}
        </button>
      </div>
    );
  }

  return (
    <VoiceSession
      childName={name}
      language={sessionLang}
      game={game}
      childId={childId}
      childAge={childAge}
      childXp={childXp}
      prevSessions={prevSessions}
    />
  );
}

export default function SessionPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFBF0" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>⏳</div>
          <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: "20px", color: "#1E3A5F" }}>Getting ready...</p>
        </div>
      </div>
    }>
      <SessionContent />
    </Suspense>
  );
}
