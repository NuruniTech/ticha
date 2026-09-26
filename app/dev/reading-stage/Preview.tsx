"use client";

import { useEffect, useRef, useState } from "react";
import ReadingScreen from "@/components/ReadingScreen";
import { getItem } from "@/lib/reading/curriculum";
import type { ReadingCard } from "@/hooks/useReadingLesson";
import type { AvatarState } from "@/components/TichaAvatar";

const STAGES: { id: string; kind: ReadingCard["kind"]; stage?: ReadingCard["stage"]; avatar: AvatarState; listening: boolean }[] = [
  { id: "model", kind: "teach", stage: "model", avatar: "talking", listening: false },
  { id: "together", kind: "teach", stage: "together", avatar: "listening", listening: true },
  { id: "alone", kind: "teach", stage: "alone", avatar: "listening", listening: true },
  { id: "play", kind: "teach", stage: "play", avatar: "talking", listening: false },
  { id: "check", kind: "baseline", avatar: "listening", listening: true },
];

export default function Preview() {
  const [stageId, setStageId] = useState("model");
  const [item, setItem] = useState("s-ba");
  const [side, setSide] = useState<"left" | "right">("left");
  const [language, setLanguage] = useState<"sw" | "en">("sw");
  // Read the query after mount so the first client render matches the server's.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("stage")) setStageId(q.get("stage")!);
    if (q.get("item")) setItem(q.get("item")!);
    if (q.get("side") === "right") setSide("right");
    if (q.get("lang") === "en") setLanguage("en");
  }, []);
  const [collected, setCollected] = useState<string[]>(["v-a", "v-e", "v-i"]);
  const [burst, setBurst] = useState(0);
  const [camera, setCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const s = STAGES.find((x) => x.id === stageId) ?? STAGES[0];
  const it = getItem(item)!;
  const card: ReadingCard = { item: it, index: 3, total: 12, kind: s.kind, stage: s.stage, canReplay: s.kind !== "baseline" };

  return (
    <>
      <ReadingScreen
        language={language}
        side={side}
        card={card}
        collected={collected}
        celebrateKey={burst}
        onReplay={() => {}}
        avatarState={s.avatar}
        analyser={null}
        ringColor={s.listening ? "#22C55E" : "#6366F1"}
        statusText={s.listening ? "Your turn to speak!" : "Ticha is talking..."}
        labelText={s.listening ? "YOUR TURN — JUST SPEAK!" : "TICHA IS TALKING"}
        hintText={s.listening ? "🎤 Your turn — just speak!" : "🔊 Listen carefully to Ticha..."}
        listening={s.listening}
        isPaused={false}
        isCameraOn={camera}
        videoRef={videoRef}
        labels={{ pause: "Pause", resume: "Resume", end: "End" }}
        onPause={() => {}}
        onCamera={() => setCamera((c) => !c)}
        onEnd={() => {}}
      />
      <div style={{ position: "fixed", left: 8, bottom: 8, zIndex: 50, background: "rgba(255,255,255,0.92)", borderRadius: 12, padding: 8, display: "flex", gap: 6, flexWrap: "wrap", fontSize: 12, maxWidth: "90vw" }}>
        {STAGES.map((x) => <button key={x.id} onClick={() => setStageId(x.id)} style={{ fontWeight: stageId === x.id ? 800 : 400 }}>{x.id}</button>)}
        <button onClick={() => setItem(item === "s-ba" ? "w-mama" : item === "w-mama" ? "v-e" : "s-ba")}>next item</button>
        <button onClick={() => { setBurst((b) => b + 1); setCollected((c) => (c.includes(item) ? c : [...c, item])); }}>correct!</button>
      </div>
    </>
  );
}
