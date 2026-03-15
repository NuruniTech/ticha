"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import VoiceSession from "@/components/VoiceSession";

function SessionContent() {
  const params  = useSearchParams();
  const name     = params.get("name")    || "Friend";
  const lang     = params.get("lang")    || "sw";
  const game     = params.get("game")    || "animals";
  const childId  = params.get("childId") || null;
  const childAge = params.get("age") ? parseInt(params.get("age")!) : undefined;
  const childXp  = params.get("xp")  ? parseInt(params.get("xp")!)  : 0;

  return <VoiceSession childName={name} language={lang} game={game} childId={childId} childAge={childAge} childXp={childXp} />;
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
