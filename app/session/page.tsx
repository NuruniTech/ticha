"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import VoiceSession from "@/components/VoiceSession";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useLanguage } from "@/context/LanguageContext";
import { T } from "@/lib/translations";
import TichaAvatar from "@/components/TichaAvatar";

// Read straight from the browser's own URL rather than Next's useSearchParams()
// hook. Verified directly against this dev setup: on a fresh navigation (not a
// same-page client transition), useSearchParams() can still be unpopulated on
// first render, so a fallback like `|| "animals"` silently wins and the wrong
// lesson launches — exactly how a reading category tile ended up opening the
// vocabulary tutor instead. window.location.search is the browser's actual,
// already-correct address bar; it cannot be behind the hook's own timing.
function readSessionParams() {
  if (typeof window === "undefined") {
    // Build-time / server render: no real URL to read yet. The real client
    // render (see the lazy useState initializer below) re-runs this in the
    // browser, where window exists, before anything is shown to a user.
    return { name: "Friend", sessionLang: "sw", game: "animals", childId: null, childAge: undefined, childXp: 0, prevSessions: 0 };
  }
  const p = new URLSearchParams(window.location.search);
  return {
    name:         p.get("name")    || "Friend",
    sessionLang:  p.get("lang")    || "sw",
    game:         p.get("game")    || "animals",
    childId:      p.get("childId") || null,
    childAge:     p.get("age")  ? parseInt(p.get("age")!)  : undefined,
    childXp:      p.get("xp")   ? parseInt(p.get("xp")!)  : 0,
    prevSessions: p.get("prev") ? parseInt(p.get("prev")!) : 0,
  };
}

function SessionContent() {
  const router   = useRouter();
  const isOnline = useOnlineStatus();
  const { lang } = useLanguage();
  const t        = T[lang].offline;

  const [{ name, sessionLang, game, childId, childAge, childXp, prevSessions }] = useState(readSessionParams);

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
