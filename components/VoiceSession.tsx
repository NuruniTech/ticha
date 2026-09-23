"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { GoogleGenAI, Modality, StartSensitivity, EndSensitivity, type LiveServerMessage } from "@google/genai";
import { useAccessibility } from "@/context/AccessibilityContext";
import { useLanguage } from "@/context/LanguageContext";
import { T } from "@/lib/translations";
import TichaAvatar from "./TichaAvatar";
import FluentEmoji from "./FluentEmoji";
import LottieEmoji from "./LottieEmoji";
import { getSystemPrompt, getWordBatch, getLessonLevel } from "@/lib/lessonPrompt";
import { getAnimatedUrl, getFluentUrl } from "@/lib/fluentEmoji";
import { usePostHog } from "posthog-js/react";
import Image from "next/image";

const PRAISE_WORDS = [
  "hongera", "vizuri sana", "vizuri saana", "kabisa", "excellent", "amazing",
  "wooow", "eeeh", "bravo", "perfect", "nzuri", "very good", "well done",
  "sawa sawa", "great job", "wonderful", "fantastic", "you got it",
  "that's right", "correct",
];

// Goodbye phrases that signal the lesson has cleanly completed.
// "tutaonana" covers both directions: the system prompt instructs Ticha to end with it
// regardless of teaching language. "see you next time" is a defensive backup for the
// English-direction case where the AI speaks mostly English — it is unambiguous as a
// farewell and does not appear elsewhere in the lesson flow.
// "kwa heri" is intentionally excluded: it can appear mid-lesson as a casual social phrase.
const GOODBYE_PHRASES = ["tutaonana", "see you next time"];

// Vocabulary (word order, English glosses, emoji, phonetics) lives in
// lib/wordLists.ts — the single source of truth shared with quizzes and games.

// Safety backstop only — session is terminated if it runs this long with no natural ending.
// This is NOT the intended session length. Sessions end when Ticha judges the child is ready,
// not when the clock runs out. 45 minutes is generous enough to never cut a real lesson short.
const SESSION_SAFETY_TIMEOUT_MS = 45 * 60 * 1000;

// Auto-reconnect on unexpected WebSocket drops (e.g. flaky mobile data in Africa).
// Five attempts with increasing backoff: 3 s → 6 s → 12 s → 20 s → 30 s.
// The longer window (total ~71 s) is intentional — mobile networks in East Africa
// can take 20–30 s to recover from a brief signal loss.
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAYS = [3000, 6000, 12000, 20000, 30000] as const; // ms

function encodePcm16Base64(float32: Float32Array): string {
  const buf = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode(...(bytes.subarray(i, i + chunk) as unknown as number[]));
  return btoa(binary);
}

// PCM16 base64 → Float32 (Gemini output, 24 kHz)
function decodePcm16(base64: string): Float32Array<ArrayBuffer> {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const f32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768;
  return f32;
}


type Status = "idle" | "connecting" | "reconnecting" | "listening" | "speaking" | "error";

interface Props {
  childName: string;
  language: string;
  game: string;
  childId: string | null;
  childAge?: number;
  childXp?: number;
  prevSessions?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LiveSession = any;

export default function VoiceSession({ childName: rawChildName, language, game, childId, childAge, childXp = 0, prevSessions = 0 }: Props) {
  // Strip anything that isn't a letter, space, or common name punctuation (apostrophe, hyphen)
  // to prevent prompt injection via a crafted child name in the URL
  const childName = (rawChildName.replace(/[^a-zA-Z '\-]/g, "").trim().slice(0, 40)) || "Friend";

  const router = useRouter();
  const { settings } = useAccessibility();
  const { lang } = useLanguage();
  const posthog = usePostHog();
  const ts = T[lang].session;
  const sessionStartTimeRef = useRef<number>(0);

  const [status, setStatus]               = useState<Status>("idle");
  const [sessionStarted, setSessionStarted] = useState(false);
  const [isMuted, setIsMuted]             = useState(false);
  const [isPaused, setIsPaused]           = useState(false);
  const [pttActive, setPttActive]         = useState(false); // mic open indicator — true from session open, always on for barge-in
  const [isCameraOn, setIsCameraOn]       = useState(false);
  const [transcript, setTranscript]       = useState<{ role: "child" | "ticha"; text: string }[]>([]);
  const [stars, setStars]                 = useState(0);
  const [starsFlash, setStarsFlash]       = useState(false);
  const [errorMsg, setErrorMsg]           = useState("");
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{ stars: number; words: number } | null>(null);
  const [debugLog, setDebugLog]           = useState<string[]>([]);
  const [revealCard, setRevealCard] = useState<{ primary: string; secondary: string; emoji: string; dismissing: boolean } | null>(null);
  const revealedWordsRef  = useRef<Set<string>>(new Set());
  const dismissTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Words fixed for this session
  const lessonWords = useMemo(() => getWordBatch(game, childXp, childAge), [game, childXp, childAge]);

  const sessionRef       = useRef<LiveSession>(null);
  // Two AudioContexts — mic at 16 kHz (Gemini input requirement),
  // playback at system native rate so Gemini's 24 kHz output is never downsampled
  const micCtxRef        = useRef<AudioContext | null>(null);
  const playCtxRef       = useRef<AudioContext | null>(null);
  const playHeadRef      = useRef<number>(0);
  const speakTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMutedRef       = useRef(false);
  const isPausedRef      = useRef(false);
  const pttActiveRef     = useRef(false); // ref for use inside audio processor callback
  const videoRef         = useRef<HTMLVideoElement>(null);
  const cameraStreamRef  = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingChildRef  = useRef("");
  const childTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnCompleteRef  = useRef(true);
  const starsRef         = useRef(0);
  const transcriptRef    = useRef<{ role: "child" | "ticha"; text: string }[]>([]);
  // Prevent double-save if both auto-end and manual End fire at the same time
  const sessionSavedRef  = useRef(false);
  // Prevents auto-end from firing multiple times
  const lessonCompleteRef = useRef(false);
  // Ref to endSession so it can be called from inside Gemini callbacks
  const endSessionRef    = useRef<(() => Promise<void>) | null>(null);
  // Ref to startSession so reconnectSession can call it without a forward-reference
  const startSessionRef  = useRef<(() => Promise<void>) | null>(null);
  // Auto-reconnect state — counts attempts and holds the pending retry timer
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set to true when startSession is called as a reconnect (not a fresh start).
  // The system prompt reads this to tell Ticha to acknowledge the interruption
  // and continue the lesson rather than starting over from Step 0.
  const isReconnectRef       = useRef(false);
  // Ref to reconnectSession so it can be called from inside Gemini callbacks
  const reconnectSessionRef  = useRef<(() => void) | null>(null);
  // Timers for auto-end and session timeout
  const autoEndTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks all queued AudioBufferSourceNodes so they can be cancelled instantly on barge-in
  const scheduledNodesRef = useRef<AudioBufferSourceNode[]>([]);
  // AnalyserNode tapped on playCtx — used by TichaAvatar for audio-reactive lip sync
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { starsRef.current = stars; }, [stars]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  // Debug output is on in dev, or on ANY build via ?debug=1. The failures we
  // are chasing are device-specific (silent audio on one Android tablet, no
  // reply on iOS), and those devices cannot run `npm run dev` — so the
  // deployed app has to be able to show its own log.
  //
  // Read through a ref so `log` keeps empty deps: it is a dependency of
  // reconnectSession and several effects, and changing its identity mid-session
  // would churn them.
  const debugRef = useRef(false);
  const [debugOn, setDebugOn] = useState(false);
  // Counters for the two things we cannot currently see from the outside:
  // whether Ticha's audio is actually being scheduled (tablet plays the
  // animation with no sound) and whether the child's mic is actually reaching
  // Gemini (session greets, then never replies).
  const audioChunkCountRef = useRef(0);
  const micSendCountRef    = useRef(0);
  // The number that actually matters: how long Gemini took to start replying
  // after it closed its own turn. We kept deriving this by hand from
  // timestamps; the app can just measure it.
  const turnCompleteAtRef  = useRef<number | null>(null);
  // Pinned at the top of the panel so it cannot scroll away — the model line
  // is the single most important thing in a session log and it was being
  // flushed out by routine counters before anyone could read it.
  const [debugHeader, setDebugHeader] = useState("");

  // Which Live model this session connects to.
  //
  // Default is PINNED rather than the "-latest" alias: an alias lets Google
  // change the model under a running product with no deploy on our side, and
  // "latest" currently resolves to this same snapshot anyway.
  //
  // ?model=prev rolls back to the previous native-audio snapshot.
  //
  // Half-cascade is NOT an option here. Connecting with an ephemeral token on
  // this API surface rejects gemini-live-2.5-flash-preview, gemini-live-2.5-flash
  // and gemini-2.0-flash-live-001 with "not found for API version v1main".
  // Verified by waiting for the server's setupComplete rather than the socket
  // opening — the socket opens for any string, including a model name that does
  // not exist, so socket-open proves nothing. Only these two answer:
  //   gemini-2.5-flash-native-audio-preview-12-2025  (default here)
  //   gemini-2.5-flash-native-audio-preview-09-2025  (?model=prev)
  //
  // That matters because the app demonstrably worked in July with no code
  // change since, and the model string was the floating "-latest" alias — so
  // the thing most likely to have moved underneath it is the model itself.
  // Rolling back a snapshot is the one lever left inside Google.
  const liveModelRef = useRef("gemini-2.5-flash-native-audio-preview-12-2025");

  // VAD profile, switchable with ?vad= so it can be A/B'd on a real device.
  //
  // Why this is the next suspect: rolling the model back to 09-2025 did NOT
  // fix the long silences (45s gap there vs 17s/65s on 12-2025), so the stall
  // is probably not the model. What both runs share is our own VAD config plus
  // a mic that streams continuously, room noise included.
  //
  // START_SENSITIVITY_HIGH is deliberately eager so quiet children register.
  // The cost is that ambient noise also registers as speech — and every time it
  // does, the silence timer that ends the child's turn resets. If the room
  // never goes quiet for a clean 1000ms, Gemini never closes the turn and never
  // answers, which is exactly the shape of these gaps: long, variable, and
  // ending whenever a quiet moment finally arrives.
  //
  //   ?vad=low  — require clearer speech to start, and Google's recommended
  //               silence window (500-800ms) rather than our 1000ms.
  const vadProfileRef = useRef<"default" | "low">("default");

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("model") === "prev") liveModelRef.current = "gemini-2.5-flash-native-audio-preview-09-2025";
      if (q.get("vad") === "low") vadProfileRef.current = "low";
    } catch { /* leave the pinned defaults */ }
  }, []);
  useEffect(() => {
    // Sticky per device: ?debug=1 turns it on and remembers, ?debug=0 turns it
    // off again. The session URL already carries name/lang/game/childId, so the
    // flag has to be typed as &debug=1 — not something anyone wants to retype
    // on a tablet keyboard before every run.
    let on = process.env.NODE_ENV === "development";
    try {
      const q = new URLSearchParams(window.location.search).get("debug");
      if (q === "0" || q === "false") localStorage.removeItem("ticha_debug");
      else if (q !== null) localStorage.setItem("ticha_debug", "1");
      on = on || localStorage.getItem("ticha_debug") === "1";
    } catch {
      // Private mode / blocked storage — fall back to the URL for this load only.
      on = on || new URLSearchParams(window.location.search).has("debug");
    }
    debugRef.current = on;
    setDebugOn(on);
  }, []);

  const log = useCallback((msg: string) => {
    if (!debugRef.current) return;
    console.log("[Ticha]", msg);
    setDebugLog((p) => [...p.slice(-149), `${new Date().toLocaleTimeString()} ${msg}`]);
  }, []);

  // Callable from hot paths (scheduleAudioChunk, the mic pump) without adding
  // `log` to their dependency arrays.
  const logRef = useRef<((m: string) => void) | null>(null);
  useEffect(() => { logRef.current = log; }, [log]);

  // Gapless streaming playback: each chunk is scheduled to start exactly
  // when the previous one ends, using the AudioContext clock.
  // Mic stays open throughout — child can barge in at any time (Gemini VAD handles detection).
  const scheduleAudioChunk = useCallback((chunk: Float32Array<ArrayBuffer>) => {
    const ctx = playCtxRef.current;
    if (!ctx || isPausedRef.current) return;

    const buf = ctx.createBuffer(1, chunk.length, 24000);
    buf.copyToChannel(chunk, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    // Route through analyser so TichaAvatar can read frequency data for lip sync.
    // Analyser is already connected to ctx.destination so audio still plays normally.
    const analyser = analyserRef.current;
    src.connect(analyser ?? ctx.destination);

    const startAt = Math.max(ctx.currentTime + 0.01, playHeadRef.current);
    src.start(startAt);
    playHeadRef.current = startAt + buf.duration;

    // If these lines appear but the device is silent, audio IS being scheduled
    // and the fault is below Web Audio (output routing / silent switch /
    // context rate), not in our streaming.
    audioChunkCountRef.current += 1;
    const n = audioChunkCountRef.current;

    // First audio after a turnComplete = Gemini started a new reply. This gap
    // is the symptom we are chasing, so measure it explicitly instead of
    // leaving it to be reconstructed from timestamps.
    if (turnCompleteAtRef.current !== null) {
      const waited = ((Date.now() - turnCompleteAtRef.current) / 1000).toFixed(1);
      turnCompleteAtRef.current = null;
      logRef.current?.(`💬 REPLY STARTED after ${waited}s of silence`);
    }

    if (n === 1 || n % 200 === 0) {
      logRef.current?.(
        `🔊 audio chunk #${n} @${ctx.sampleRate}Hz state=${ctx.state} ` +
        `lead=${Math.round((playHeadRef.current - ctx.currentTime) * 1000)}ms`
      );
    }

    // Track node so it can be cancelled instantly if the child barges in
    scheduledNodesRef.current.push(src);
    src.addEventListener("ended", () => {
      scheduledNodesRef.current = scheduledNodesRef.current.filter((n) => n !== src);
    });

    setStatus("speaking");

    // Only switch to "listening" after the last queued chunk finishes.
    // Also auto-open the mic so the child can speak without pressing anything.
    if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
    const msUntilEnd = (playHeadRef.current - ctx.currentTime) * 1000 + 200;
    speakTimerRef.current = setTimeout(() => {
      if (!isPausedRef.current) {
        setStatus("listening");
        // Auto-open mic — child just speaks naturally, no button needed
        pttActiveRef.current = true;
        setPttActive(true);
      }
    }, msUntilEnd);
  }, []);

  const awardStars = useCallback((amount = 10) => {
    setStars((p) => p + amount);
    setStarsFlash(true);
    setTimeout(() => setStarsFlash(false), 900);
  }, []);

  // Track exactly WHICH lesson words Ticha has introduced (by index).
  // Normalise apostrophes so ng'ombe (curly) matches ng'ombe (straight) in the transcript.
  // Defined before endSession, which depends on wordsIntroduced for analytics.
  const introducedWordIndices = useMemo(() => {
    const raw = transcript.filter(t => t.role === "ticha").map(t => t.text).join(" ");
    const tichaText = raw.toLowerCase().replace(/[‘’ʼ′]/g, "'");
    const set = new Set<number>();
    lessonWords.forEach((w, i) => {
      const target = (language === "sw" ? w.sw : w.en).toLowerCase();
      if (tichaText.includes(target)) set.add(i);
    });
    return set;
  }, [transcript, lessonWords, language]);

  const wordsIntroduced = introducedWordIndices.size;

  // What the CHILD is allowed to see, which lags what Gemini has said.
  //
  // introducedWordIndices is derived from outputTranscription, and Gemini sends
  // that text BEFORE it has finished streaming the audio for the same turn (the
  // goodbye handling below relies on the same fact). Rendering the cards
  // straight from it lit up the next animal seconds before the child heard
  // Ticha say it — the "animal displays earlier before the lesson starts"
  // report. Here we hold the reveal back until the audio already queued for
  // that turn has actually played out.
  const [revealedWordIndices, setRevealedWordIndices] = useState<Set<number>>(new Set());
  useEffect(() => {
    const ctx = playCtxRef.current;
    const backlogMs = ctx ? Math.max(0, (playHeadRef.current - ctx.currentTime) * 1000) : 0;
    if (backlogMs < 50) { setRevealedWordIndices(introducedWordIndices); return; }
    const t = setTimeout(() => setRevealedWordIndices(introducedWordIndices), backlogMs);
    return () => clearTimeout(t);
  }, [introducedWordIndices]);

  const toggleCamera = useCallback(async () => {
    if (isCameraOn) {
      frameIntervalRef.current && clearInterval(frameIntervalRef.current);
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
      setIsCameraOn(false);
      log("📷 Camera off");
    } else {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 240 }, height: { ideal: 180 } },
          });
        } catch {
          // Desktop or front-camera-only device — fall back to any camera
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 240 }, height: { ideal: 180 } },
          });
        }
        cameraStreamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
        setIsCameraOn(true);
        log("📷 Camera on — sending frames");
        frameIntervalRef.current = setInterval(() => {
          if (!videoRef.current || !sessionRef.current) return;
          const canvas = document.createElement("canvas");
          canvas.width = 240; canvas.height = 180;
          const ctx2d = canvas.getContext("2d");
          if (!ctx2d) return;
          ctx2d.drawImage(videoRef.current, 0, 0, 240, 180);
          const base64 = canvas.toDataURL("image/jpeg", 0.55).split(",")[1];
          sessionRef.current.sendRealtimeInput({ video: { data: base64, mimeType: "image/jpeg" } });
        }, 3000);
      } catch (err) {
        log(`📷 Camera error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }, [isCameraOn, log]);

  const endSession = useCallback(async (manualEnd = false) => {
    // Guard: prevent double-save from simultaneous auto-end and manual End clicks
    if (sessionSavedRef.current) return;
    sessionSavedRef.current = true;

    // Stop mic sends FIRST — the AudioWorklet processor runs on a separate thread
    // and fires continuously. If we close the socket before flipping this flag,
    // the processor will try to sendRealtimeInput on a CLOSING socket and throw
    // "WebSocket is already in CLOSING or CLOSED state".
    pttActiveRef.current = false;
    setPttActive(false);

    autoEndTimerRef.current && clearTimeout(autoEndTimerRef.current);
    sessionTimeoutRef.current && clearTimeout(sessionTimeoutRef.current);
    frameIntervalRef.current && clearInterval(frameIntervalRef.current);
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    speakTimerRef.current && clearTimeout(speakTimerRef.current);
    sessionRef.current?.close?.();
    sessionRef.current = null;

    if (manualEnd) {
      // Child pressed End — stop all queued audio immediately, no drain wait
      scheduledNodesRef.current.forEach((n) => { try { n.stop(); } catch { /* already ended */ } });
      scheduledNodesRef.current = [];
      playHeadRef.current = 0;
    } else {
      // Natural lesson end — wait for Ticha's goodbye audio to finish before teardown
      const playCtx = playCtxRef.current;
      if (playCtx && playHeadRef.current > playCtx.currentTime) {
        const remainingMs = (playHeadRef.current - playCtx.currentTime) * 1000;
        await new Promise((r) => setTimeout(r, remainingMs + 600));
      }
    }

    micCtxRef.current?.close();
    micCtxRef.current = null;
    playCtxRef.current?.close();
    playCtxRef.current = null;
    playHeadRef.current = 0;
    analyserRef.current = null;
    setAnalyserNode(null);

    // Manual end = no rewards. Only a naturally completed lesson earns XP and streak.
    const earnedStars       = manualEnd ? 0 : starsRef.current;
    const currentTranscript = transcriptRef.current;
    const wordsPracticed    = lessonWords.map((w) => language === "sw" ? w.sw : w.en);

    if (childId && sessionStartTimeRef.current > 0) {
      const durationSeconds = Math.round((Date.now() - sessionStartTimeRef.current) / 1000);

      // Retry helper — attempts up to maxAttempts times with a 1.5 s delay between retries
      async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try { return await fn(); }
          catch (e) {
            if (attempt === maxAttempts) throw e;
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
        throw new Error("unreachable");
      }

      try {
        // Server-side save: session row, XP (clamped against duration), and
        // calendar-day streak are all written by /api/complete-session so
        // scores cannot be forged from the browser.
        await withRetry(async () => {
          const res = await fetch("/api/complete-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              childId,
              game,
              language,
              durationSeconds,
              xpEarned: earnedStars,
              wordsPracticed,
              transcript: currentTranscript,
              manualEnd,
            }),
          });
          if (!res.ok) throw new Error(`Session save failed: ${res.status}`);
        });
      } catch (e) {
        console.error("Failed to save session after retries:", e);
        // Non-blocking — child still sees quiz; progress will be awarded next session
      }
    }

    setSessionStarted(false);
    setIsCameraOn(false);
    setPttActive(false);
    setStatus("idle");
    setTranscript([]);

    const durationSec = sessionStartTimeRef.current > 0
      ? Math.round((Date.now() - sessionStartTimeRef.current) / 1000) : 0;

    if (manualEnd) {
      posthog?.capture("session_abandoned", {
        game,
        language,
        words_introduced: wordsIntroduced,
        duration_seconds: durationSec,
      });
      // Child pressed End manually — skip celebration, go straight back
      setStars(0);
      router.push(childId ? `/child/${childId}` : "/dashboard");
    } else {
      posthog?.capture("session_completed", {
        game,
        language,
        xp_earned:        earnedStars,
        words_introduced: wordsIntroduced,
        duration_seconds: durationSec,
        lesson_level:     getLessonLevel(childXp, childAge),
      });
      // Natural lesson completion — show celebration, then go to quiz
      setCelebrationData({ stars: earnedStars, words: lessonWords.length });
      setShowCelebration(true);
      setTimeout(() => {
        setShowCelebration(false);
        setStars(0);
        if (childId) {
          const wordsParam = lessonWords.map(w => w.sw).join(",");
          const ageParam   = childAge ? `&age=${childAge}` : "";
          router.push(`/quiz?game=${encodeURIComponent(game)}&lang=${encodeURIComponent(language)}&childId=${encodeURIComponent(childId)}&xp=${earnedStars}&words=${encodeURIComponent(wordsParam)}${ageParam}`);
        } else {
          router.push("/dashboard");
        }
      }, 3000);
    }
  // wordsIntroduced/childXp/childAge/posthog are included so the PostHog
  // events report current values instead of the ones captured at mount.
  }, [router, childId, game, language, lessonWords, wordsIntroduced, childXp, childAge, posthog]);

  // Keep endSessionRef in sync so callbacks can call it without stale closure
  useEffect(() => { endSessionRef.current = endSession; }, [endSession]);

  // Auto-reconnect: lightweight teardown (no save) + schedule a new startSession().
  // Called by onclose when an unexpected drop occurs mid-session.
  const reconnectSession = useCallback(() => {
    const attempt = reconnectAttemptsRef.current;
    if (attempt >= MAX_RECONNECT_ATTEMPTS) return; // guard — onclose already checked

    const delay = RECONNECT_DELAYS[attempt];
    reconnectAttemptsRef.current += 1;
    log(`🔄 Reconnecting (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}) in ${delay / 1000}s…`);

    setStatus("reconnecting");
    setSessionStarted(false);
    setErrorMsg("");

    // Lightweight teardown — close WebSocket/audio but preserve stars + transcript
    pttActiveRef.current = false;
    setPttActive(false);
    autoEndTimerRef.current   && clearTimeout(autoEndTimerRef.current);
    sessionTimeoutRef.current && clearTimeout(sessionTimeoutRef.current);
    speakTimerRef.current     && clearTimeout(speakTimerRef.current);
    sessionRef.current?.close?.();
    sessionRef.current = null;
    micCtxRef.current?.close();
    micCtxRef.current = null;
    playCtxRef.current?.close();
    playCtxRef.current = null;
    playHeadRef.current = 0;
    analyserRef.current = null;
    setAnalyserNode(null);

    // Mark this as a reconnect so the system prompt tells Ticha to continue
    // the lesson rather than restarting from Step 0.
    isReconnectRef.current = true;

    // Use startSessionRef to avoid a forward-reference problem (startSession is
    // defined after reconnectSession in the component body).
    reconnectTimerRef.current = setTimeout(() => {
      startSessionRef.current?.();
    }, delay);
  }, [log]);

  // Keep reconnectSessionRef in sync so onclose can call it without stale closure
  useEffect(() => { reconnectSessionRef.current = reconnectSession; }, [reconnectSession]);

  // Listen for the device going offline mid-session so we can show "reconnecting" UI
  // immediately rather than waiting for the WebSocket timeout.
  useEffect(() => {
    function handleOffline() {
      if (sessionRef.current) {
        log("📡 Device went offline — waiting for connection to resume");
        setStatus("reconnecting");
        setErrorMsg("");
      }
    }
    function handleOnline() {
      log("📡 Device back online");
      // The scheduled reconnectTimer (if any) will fire on its own.
      // If we're in idle/error state, just hint to the user they can retry.
    }
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online",  handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online",  handleOnline);
    };
  }, [log]);

  const startSession = useCallback(async () => {
    // Reset per-session guards
    sessionSavedRef.current    = false;
    lessonCompleteRef.current  = false;

    try {
      setStatus("connecting");
      setErrorMsg("");
      setDebugLog([]);
      log("Starting session...");

      // Fast-fail if the device has no network at all — saves a confusing timeout.
      if (!navigator.onLine) {
        throw new Error(
          language === "sw"
            ? "Hakuna mtandao. Tafadhali angalia muunganiko wako wa intaneti."
            : "No internet connection. Please check your internet and try again."
        );
      }

      // Start the token fetch NOW, in parallel with mic + audio setup, instead
      // of after it. It is a round trip to our API which in turn calls Google,
      // and it used to sit behind getUserMedia, two AudioContexts and the
      // worklet module load — all of that dead time added to the pause between
      // the child tapping Start and Ticha saying anything. Nothing below needs
      // the token until live.connect().
      const keyResPromise = fetch("/api/gemini-key");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      log("🎙️ Mic acquired");

      const micCtx = new AudioContext({ sampleRate: 16000 });
      await micCtx.resume();
      micCtxRef.current = micCtx;

      // Playback context runs AT Gemini's output rate (24 kHz), not the system
      // native rate. Each chunk below is an AudioBuffer declared at 24 kHz; if
      // the context runs at 44.1/48 kHz the browser resamples every buffer
      // INDEPENDENTLY, and the resampler carries no state across buffers — so
      // every chunk boundary gets a discontinuity. With chunks arriving many
      // times a second that is continuous clicking: the "scratching" testers
      // reported. Matching the context to 24 kHz removes per-chunk resampling
      // entirely; the device resamples the continuous output stream once, in
      // hardware, which is what it is designed to do.
      // NOTE: do NOT request sampleRate 24000 here. Matching Gemini's output
      // rate removes the per-chunk resampling that causes clicking, but some
      // Android builds ACCEPT the constructor and then output silence — the
      // tablet played Ticha's animation with no sound at all. There is no
      // reliable feature test for that (the context reports sampleRate 24000
      // and state "running"), so silence is strictly worse than crackle.
      // The per-chunk resampling artefact needs fixing with a stateful
      // resampler on our side instead.
      const playCtx = new AudioContext(); // system native rate
      await playCtx.resume();
      audioChunkCountRef.current = 0;
      micSendCountRef.current    = 0;
      log(`🔈 playCtx ${playCtx.sampleRate}Hz state=${playCtx.state} | micCtx ${micCtx.sampleRate}Hz`);
      setDebugHeader(`🤖 ${liveModelRef.current}  |  vad=${vadProfileRef.current}  |  play ${playCtx.sampleRate}Hz  mic ${micCtx.sampleRate}Hz`);
      playCtxRef.current = playCtx;
      playHeadRef.current = 0;

      // AnalyserNode passive tap — sits between audio source nodes and destination.
      // TichaAvatar reads frequency data from it on every animation frame to drive
      // audio-reactive lip sync. fftSize 256 → 128 frequency bins; smoothing 0.6
      // gives fast-enough response for mouth shapes without jitter.
      const analyser = playCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.15; // low smoothing = mouth reacts quickly to each phoneme
      analyser.connect(playCtx.destination);
      analyserRef.current = analyser;
      setAnalyserNode(analyser);

      const source = micCtx.createMediaStreamSource(stream);

      // Register the AudioWorklet processor (runs in a dedicated audio thread —
      // replaces the deprecated ScriptProcessorNode which ran on the main thread
      // and caused audio glitches and jank)
      await micCtx.audioWorklet.addModule("/mic-processor.js");
      const processor = new AudioWorkletNode(micCtx, "mic-processor");

      // Fetch a short-lived, single-use ephemeral token from the server.
      // The real Gemini API key never reaches the browser — this token only
      // works for one Live session and expires on its own.
      const keyRes = await keyResPromise;
      if (!keyRes.ok) throw new Error("Could not initialise session. Please try again.");
      const { token: geminiToken } = await keyRes.json();

      const client = new GoogleGenAI({
        apiKey: geminiToken,
        // Ephemeral tokens are only accepted on the v1alpha API surface
        httpOptions: { apiVersion: "v1alpha" },
      });

      const session: LiveSession = await client.live.connect({
        model: liveModelRef.current,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: {
            parts: [{ text: getSystemPrompt(childName, language, game, lessonWords, childAge, childXp, settings.slowSpeech, prevSessions, isReconnectRef.current) }],
          },
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: settings.voice } },
          },
          thinkingConfig: { thinkingBudget: 0 },
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: false,
              startOfSpeechSensitivity: vadProfileRef.current === "low"
                ? StartSensitivity.START_SENSITIVITY_LOW
                : StartSensitivity.START_SENSITIVITY_HIGH,
              // HIGH: cuts through ambient noise common in East African home/classroom
              // environments. LOW required definitively quiet silence, causing children to
              // repeat themselves 2-3 times before Gemini would respond in noisy rooms.
              endOfSpeechSensitivity:   EndSensitivity.END_SENSITIVITY_HIGH,
              // 300 ms: ensures utterance start is not clipped.
              prefixPaddingMs:          300,
              // 1000 ms: HIGH sensitivity detects silence quickly, so we extend the wait
              // window to give children enough time to pause mid-thought without being cut off.
              silenceDurationMs:        vadProfileRef.current === "low" ? 700 : 1000,
            },
          },
        },
        callbacks: {
          onopen: () => {
            log("✅ Session opened");
            setStatus("listening");
            setSessionStarted(true);
            sessionStartTimeRef.current = Date.now();
            reconnectAttemptsRef.current = 0; // successful (re)connection — reset counter
            isReconnectRef.current = false;  // clear flag; next fresh start is not a reconnect
            posthog?.capture("session_started", {
              game,
              language,
              lesson_level: getLessonLevel(childXp, childAge),
              child_age_group: childAge ? (childAge <= 5 ? "3-5" : childAge <= 8 ? "6-8" : "9+") : "unknown",
              is_first_session: prevSessions === 0,
            });

            // AudioWorkletNode posts Float32Array blocks from the audio thread;
            // we forward them to Gemini only when PTT is active.
            processor.port.onmessage = (e: MessageEvent<Float32Array>) => {
              if (!pttActiveRef.current || isMutedRef.current || isPausedRef.current || !sessionRef.current) return;
              const data = encodePcm16Base64(e.data);
              sessionRef.current.sendRealtimeInput({ audio: { data, mimeType: "audio/pcm;rate=16000" } });

              // ~1 line every 5 s. If Ticha greets and then never replies while
              // this counter keeps climbing, the child's audio IS reaching
              // Gemini and the silence is Gemini's (VAD or turn handling),
              // not a broken mic path. If it stops climbing, it is ours.
              micSendCountRef.current += 1;
              if (micSendCountRef.current % 200 === 0) {
                logRef.current?.(`🎤 mic batches sent: ${micSendCountRef.current}`);
              }
            };
            // Connect mic → worklet. No need to connect worklet → destination
            // (ScriptProcessorNode required that; AudioWorkletNode does not).
            source.connect(processor);

            // 2-second AEC training window: browser echo cancellation (AEC3) needs ~2–5 s
            // after getUserMedia() to model the speaker-mic acoustic relationship before it
            // can subtract Ticha's voice from the mic signal. Streaming immediately means the
            // first seconds are contaminated with echo, causing Gemini's VAD to mistake
            // Ticha's voice for the child speaking and interrupt itself. Delaying mic send by
            // 2 s gives AEC enough time to converge without making the child wait noticeably.
            setTimeout(() => {
              if (!sessionRef.current) return; // session may have been closed during the delay
              pttActiveRef.current = true;
              setPttActive(true);
              log("🎙️ Mic streaming started (AEC trained)");
            }, 2000);

            // Safety backstop: only fires if the session never naturally completes.
            // Normal sessions end when Ticha says "tutaonana" after confirming mastery.
            sessionTimeoutRef.current = setTimeout(() => {
              if (!lessonCompleteRef.current) {
                log("⏱️ Safety timeout (45 min) — auto-ending");
                endSessionRef.current?.();
              }
            }, SESSION_SAFETY_TIMEOUT_MS);

          },

          onmessage: (msg: LiveServerMessage) => {
            // ── Barge-in: Gemini detected the child speaking during Ticha's turn ──
            // Cancel all queued audio nodes instantly so playback stops mid-sentence,
            // then reset the play head so the next Ticha response starts cleanly.
            if (msg.serverContent?.interrupted) {
              scheduledNodesRef.current.forEach((n) => { try { n.stop(); } catch { /* already ended */ } });
              scheduledNodesRef.current = [];
              playHeadRef.current = playCtxRef.current?.currentTime ?? 0;
              if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
              setStatus("listening");
              log("⚡ Barge-in — audio cancelled, mic open");
            }

            // ── Audio ──
            const parts = msg.serverContent?.modelTurn?.parts ?? [];
            for (const part of parts) {
              if (part.inlineData?.data) {
                scheduleAudioChunk(decodePcm16(part.inlineData.data));
              }
            }

            // ── Ticha transcript + XP + auto-complete detection ──
            const tichaText = msg.serverContent?.outputTranscription?.text;
            if (tichaText?.trim()) {
              setTranscript((prev) => {
                if (turnCompleteRef.current) {
                  turnCompleteRef.current = false;
                  return [...prev, { role: "ticha", text: tichaText }];
                }
                const last = prev[prev.length - 1];
                if (last?.role === "ticha") {
                  return [...prev.slice(0, -1), { role: "ticha", text: last.text + " " + tichaText }];
                }
                return [...prev, { role: "ticha", text: tichaText }];
              });

              if (PRAISE_WORDS.some((w) => tichaText.toLowerCase().includes(w))) awardStars(10);

              // Auto-completion: detect the lesson goodbye.
              // We do NOT start the end timer here — the text arrives before all audio
              // chunks for that turn have been sent by Gemini. Starting a fixed timer
              // here caused the session to close while Ticha was still mid-sentence.
              // Instead we set lessonCompleteRef and let turnComplete (below) trigger
              // the drain timer once Gemini confirms it has finished sending audio.
              if (!lessonCompleteRef.current) {
                const lower = tichaText.toLowerCase();
                const isDone = GOODBYE_PHRASES.some((p) => lower.includes(p));
                if (isDone) {
                  lessonCompleteRef.current = true;
                  log("🎓 Goodbye detected — waiting for Ticha's turn to finish before ending");
                }
              }
            }

            if (msg.serverContent?.turnComplete) {
              // A turnComplete arriving seconds before the audio actually runs
              // out is the signature of the known server-side truncation bug.
              turnCompleteAtRef.current = Date.now();
              log(`⏹ turnComplete — waiting for next reply…`);
              turnCompleteRef.current = true;
              // If the lesson goodbye was already detected, start the drain timer NOW —
              // turnComplete means Gemini has sent all audio for this turn, so 3 s is
              // more than enough for the playback queue to drain before teardown.
              if (lessonCompleteRef.current && !autoEndTimerRef.current) {
                log("🎓 Turn complete after goodbye — ending in 3s (audio drain)");
                autoEndTimerRef.current = setTimeout(() => {
                  endSessionRef.current?.();
                }, 3000);
              }
            }

            // ── Child transcript ──
            const childText = msg.serverContent?.inputTranscription?.text;
            if (childText?.trim() && childText.trim().length >= 2) {
              // If the child speaks while the auto-end timer is running (e.g. they said
              // "wait!" or asked a question right after Ticha's goodbye), cancel the
              // timer and let Ticha respond — never close over the child's voice.
              if (autoEndTimerRef.current) {
                clearTimeout(autoEndTimerRef.current);
                autoEndTimerRef.current = null;
                lessonCompleteRef.current = false;
                log("🔄 Child spoke during goodbye window — auto-end cancelled, continuing");
              }

              pendingChildRef.current += (pendingChildRef.current ? " " : "") + childText.trim();
              if (childTimerRef.current) clearTimeout(childTimerRef.current);
              childTimerRef.current = setTimeout(() => {
                const utterance = pendingChildRef.current.trim();
                if (utterance.length >= 2) {
                  setTranscript((prev) => [...prev, { role: "child", text: utterance }]);
                }
                pendingChildRef.current = "";
              }, 1200);
            }
          },

          onerror: (e: unknown) => {
            const msg = e instanceof Error ? e.message : JSON.stringify(e);
            console.error("[Ticha] Gemini onerror:", msg);
            log(`⚠️ Error: ${msg}`);
            // onclose always fires after onerror on a WebSocket — reconnect logic lives there.
            // Do NOT set status="error" here to avoid a flash before onclose decides what to do.
          },

          onclose: (e?: unknown) => {
            const ev = e as CloseEvent;
            const isNormal = ev?.code === 1000 || ev?.code === undefined;
            if (!isNormal) {
              console.error("[Ticha] Gemini onclose — unexpected code:", ev?.code, "reason:", ev?.reason);
            }
            log(`${isNormal ? "✅" : "❌"} Closed: code=${ev?.code} reason="${ev?.reason}"`);

            if (
              !isNormal &&
              sessionStartTimeRef.current > 0 &&
              !sessionSavedRef.current &&
              reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
            ) {
              // Unexpected drop mid-session — try to reconnect automatically.
              // reconnectSession does a lightweight teardown and schedules startSession().
              reconnectSessionRef.current?.();
            } else if (!sessionSavedRef.current && sessionStartTimeRef.current > 0) {
              // Either a normal close or we exhausted all reconnect attempts —
              // save progress and show the quiz/summary.
              endSessionRef.current?.();
            } else {
              setSessionStarted(false);
              setStatus("idle");
            }
          },
        },
      });
      sessionRef.current = session;

      // Send opening trigger now — sessionRef.current is guaranteed to be set.
      // Previously this was inside onopen (with 200 ms delay), but connect() may
      // not resolve until AFTER onopen fires, leaving sessionRef.current null when
      // the timer fired and silently dropping the trigger (Ticha never spoke).
      // Moving it here eliminates the race condition entirely.
      // The trigger is in the child's NATIVE language so Ticha's first response
      // comes back in the instructional language automatically.
      // en direction (sw speaker): Swahili trigger → Ticha responds in Swahili ✅
      // sw direction (en speaker): English trigger → Ticha responds in English ✅
      const triggerText = language === "en"
        ? `Habari Ticha! Mimi ni ${childName} na niko tayari kujifunza!`
        : `Hello Ticha! I am ${childName} and I am ready to learn!`;
      setTimeout(() => {
        sessionRef.current?.sendClientContent({
          turns: [{ role: "user", parts: [{ text: triggerText }] }],
          turnComplete: true,
        });
      }, 200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`💥 Catch: ${msg}`);
      setErrorMsg(`Could not start: ${msg}`);
      setStatus("error");
      setSessionStarted(false);
    }
  }, [childName, language, game, scheduleAudioChunk, awardStars, log, settings.voice, settings.slowSpeech, childAge, childXp]);

  // Keep startSessionRef in sync so reconnectSession can call it via ref
  useEffect(() => { startSessionRef.current = startSession; }, [startSession]);

  const togglePause = useCallback(() => {
    setIsPaused((p) => {
      const next = !p;
      isPausedRef.current = next;
      isMutedRef.current  = next;
      setIsMuted(next);
      return next;
    });
  }, []);

  // Emoji for each lesson word — carried on the word entry itself
  const lessonEmojis = useMemo(() =>
    lessonWords.map(lw => lw.emoji),
    [lessonWords],
  );

  // Preload all 5 lesson-word APNG/PNG images as soon as the word list is known,
  // so the animated reveal is instant rather than fetching on first display.
  useEffect(() => {
    lessonEmojis.forEach(emoji => {
      const url = getAnimatedUrl(emoji) ?? getFluentUrl(emoji);
      if (url) {
        const img = new window.Image();
        img.src = url;
      }
    });
  }, [lessonEmojis]);

  // Detect newly introduced words and animate a card reveal.
  // Timer IDs live in refs (not local vars) so they are not cancelled by the React
  // cleanup when the effect re-runs on unrelated transcript updates (e.g. child speaks
  // while the card is still on screen). Without refs, the cleanup would clear the
  // dismiss timers and leave the card permanently visible.
  useEffect(() => {
    if (!sessionStarted) return;
    const raw = transcript.filter(t => t.role === "ticha").map(t => t.text).join(" ");
    const tichaText = raw.toLowerCase().replace(/[''ʼ′]/g, "'");

    const newlyIntroduced = lessonWords.find(lw => {
      // Fire on the vocabulary target word (sw for Swahili lessons, en for English lessons).
      // Using the Swahili word for sw-sessions avoids false positives from common English
      // words like "one"/"two" that appear in normal English instruction speech.
      const target = (language === "sw" ? lw.sw : lw.en).toLowerCase();
      return tichaText.includes(target) && !revealedWordsRef.current.has(lw.sw);
    });

    if (!newlyIntroduced) return;
    revealedWordsRef.current.add(newlyIntroduced.sw);
    const emoji = newlyIntroduced.emoji;
    // primary = vocabulary target (what the child is learning); secondary = known-language translation
    // sw session: teaching Swahili → Swahili word big, English small
    // en session: teaching English → English word big, Swahili small
    const primary   = language === "sw" ? newlyIntroduced.sw : newlyIntroduced.en;
    const secondary = language === "sw" ? newlyIntroduced.en : newlyIntroduced.sw;
    setRevealCard({ primary, secondary, emoji, dismissing: false });

    if (dismissTimerRef.current)   clearTimeout(dismissTimerRef.current);
    if (revealClearTimerRef.current) clearTimeout(revealClearTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      setRevealCard(prev => prev ? { ...prev, dismissing: true } : null);
    }, 3000);
    revealClearTimerRef.current = setTimeout(() => setRevealCard(null), 3400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  // Clean up reveal timers on unmount
  useEffect(() => () => {
    if (dismissTimerRef.current)   clearTimeout(dismissTimerRef.current);
    if (revealClearTimerRef.current) clearTimeout(revealClearTimerRef.current);
  }, []);

  const sessionLevel = getLessonLevel(childXp);
  const levelLabel =
    sessionLevel === 4 ? "Bingwa 🏆" :
    sessionLevel === 3 ? "Hodari 🌟" :
    sessionLevel === 2 ? "Msomi ⭐"  : "Mwanafunzi 🌱";

  const GAME_COLORS: Record<string, string> = { animals: "#FF8C00", numbers: "#4B8BF5", colors: "#9B59F5", body: "#EF4444", people: "#22C55E", chakula: "#F97316", vitenzi: "#0EA5E9", shule: "#8B5CF6", hisia: "#EC4899", mazingira: "#16A34A" };
  const GAME_EMOJIS: Record<string, string> = { animals: "🦁", numbers: "🔢", colors: "🎨", body: "🫀", people: "👨‍👩‍👧‍👦", chakula: "🍽️", vitenzi: "🏃", shule: "📚", hisia: "❤️", mazingira: "🌿" };
  const GAME_SHORT:  Record<string, string> = { animals: "Animals / Wanyama", numbers: "Numbers / Nambari", colors: "Colors / Rangi", body: "Body Parts / Mwili", people: "People / Watu", chakula: "Food / Chakula", vitenzi: "Verbs / Vitenzi", shule: "School / Shule", hisia: "Feelings / Hisia", mazingira: "Nature / Mazingira" };

  // Cartoon background emojis — scattered around the stage per topic
  type BgEmoji = { e: string; top?: string; bottom?: string; left?: string; right?: string; size: number; anim: string; delay: string };
  const GAME_BG_EMOJIS: Record<string, BgEmoji[]> = {
    animals: [
      { e: "🦁", top: "7%",   left: "4%",   size: 54, anim: "bg-emoji-a", delay: "0s"   },
      { e: "🐘", top: "9%",   right: "4%",  size: 58, anim: "bg-emoji-b", delay: "0.9s" },
      { e: "🦒", top: "46%",  left: "2%",   size: 46, anim: "bg-emoji-c", delay: "1.7s" },
      { e: "🐆", top: "42%",  right: "2%",  size: 44, anim: "bg-emoji-a", delay: "2.4s" },
      { e: "🦋", bottom: "18%", left: "6%", size: 38, anim: "bg-emoji-b", delay: "0.5s" },
      { e: "🦜", bottom: "15%", right: "5%",size: 40, anim: "bg-emoji-c", delay: "1.3s" },
      { e: "🐊", top: "24%",  left: "8%",   size: 30, anim: "bg-emoji-b", delay: "2.0s" },
    ],
    numbers: [
      { e: "1️⃣",  top: "8%",   left: "5%",   size: 50, anim: "bg-emoji-a", delay: "0s"   },
      { e: "2️⃣",  top: "9%",   right: "5%",  size: 54, anim: "bg-emoji-b", delay: "0.8s" },
      { e: "3️⃣",  top: "45%",  left: "2%",   size: 44, anim: "bg-emoji-c", delay: "1.6s" },
      { e: "⭐",  top: "41%",  right: "3%",  size: 42, anim: "bg-emoji-a", delay: "2.2s" },
      { e: "5️⃣",  bottom: "20%", left: "7%", size: 36, anim: "bg-emoji-b", delay: "0.4s" },
      { e: "🔢",  bottom: "16%", right: "6%",size: 40, anim: "bg-emoji-c", delay: "1.2s" },
      { e: "🎯",  top: "25%",  right: "9%",  size: 30, anim: "bg-emoji-a", delay: "1.9s" },
    ],
    colors: [
      { e: "🌈", top: "7%",   left: "4%",   size: 56, anim: "bg-emoji-a", delay: "0s"   },
      { e: "🎨", top: "9%",   right: "4%",  size: 52, anim: "bg-emoji-b", delay: "0.7s" },
      { e: "🌺", top: "45%",  left: "2%",   size: 44, anim: "bg-emoji-c", delay: "1.5s" },
      { e: "💜", top: "41%",  right: "2%",  size: 42, anim: "bg-emoji-a", delay: "2.1s" },
      { e: "🖌️", bottom: "19%", left: "7%", size: 36, anim: "bg-emoji-b", delay: "0.5s" },
      { e: "🌊", bottom: "16%", right: "5%",size: 38, anim: "bg-emoji-c", delay: "1.2s" },
      { e: "🌻", top: "26%",  left: "10%",  size: 30, anim: "bg-emoji-a", delay: "2.0s" },
    ],
    body: [
      { e: "💪", top: "8%",   left: "5%",   size: 50, anim: "bg-emoji-a", delay: "0s"   },
      { e: "👁️", top: "9%",   right: "5%",  size: 54, anim: "bg-emoji-b", delay: "0.8s" },
      { e: "👃", top: "45%",  left: "3%",   size: 44, anim: "bg-emoji-c", delay: "1.6s" },
      { e: "👂", top: "41%",  right: "3%",  size: 42, anim: "bg-emoji-a", delay: "2.2s" },
      { e: "🦷", bottom: "20%", left: "7%", size: 36, anim: "bg-emoji-b", delay: "0.4s" },
      { e: "🦵", bottom: "17%", right: "6%",size: 38, anim: "bg-emoji-c", delay: "1.2s" },
      { e: "🖐🏾", top: "26%", right: "10%", size: 30, anim: "bg-emoji-a", delay: "1.9s" },
    ],
    people: [
      { e: "👨‍👩‍👧", top: "7%",  left: "3%",   size: 54, anim: "bg-emoji-a", delay: "0s"   },
      { e: "🏠",  top: "9%",   right: "4%",  size: 50, anim: "bg-emoji-b", delay: "0.8s" },
      { e: "🤝",  top: "45%",  left: "2%",   size: 44, anim: "bg-emoji-c", delay: "1.6s" },
      { e: "💛",  top: "41%",  right: "2%",  size: 42, anim: "bg-emoji-a", delay: "2.2s" },
      { e: "👶🏾", bottom: "20%", left: "7%",size: 36, anim: "bg-emoji-b", delay: "0.4s" },
      { e: "🌍",  bottom: "17%", right: "5%",size: 40, anim: "bg-emoji-c", delay: "1.1s" },
      { e: "🎓",  top: "26%",  right: "10%", size: 30, anim: "bg-emoji-a", delay: "1.8s" },
    ],
    chakula: [
      { e: "🍽️", top: "7%",   left: "4%",   size: 54, anim: "bg-emoji-a", delay: "0s"   },
      { e: "🍌", top: "9%",   right: "4%",  size: 52, anim: "bg-emoji-b", delay: "0.8s" },
      { e: "🍅", top: "45%",  left: "2%",   size: 44, anim: "bg-emoji-c", delay: "1.6s" },
      { e: "🥩", top: "41%",  right: "2%",  size: 42, anim: "bg-emoji-a", delay: "2.2s" },
      { e: "☕", bottom: "20%", left: "7%", size: 36, anim: "bg-emoji-b", delay: "0.4s" },
      { e: "🌽", bottom: "17%", right: "5%",size: 38, anim: "bg-emoji-c", delay: "1.1s" },
      { e: "🍯", top: "26%",  right: "10%", size: 30, anim: "bg-emoji-a", delay: "1.8s" },
    ],
    vitenzi: [
      { e: "🏃", top: "7%",   left: "4%",   size: 54, anim: "bg-emoji-a", delay: "0s"   },
      { e: "⚽", top: "9%",   right: "4%",  size: 50, anim: "bg-emoji-b", delay: "0.8s" },
      { e: "✍️", top: "45%",  left: "2%",   size: 44, anim: "bg-emoji-c", delay: "1.6s" },
      { e: "🎵", top: "41%",  right: "2%",  size: 42, anim: "bg-emoji-a", delay: "2.2s" },
      { e: "🦘", bottom: "20%", left: "7%", size: 36, anim: "bg-emoji-b", delay: "0.4s" },
      { e: "🍳", bottom: "17%", right: "5%",size: 38, anim: "bg-emoji-c", delay: "1.1s" },
      { e: "💪", top: "26%",  right: "10%", size: 30, anim: "bg-emoji-a", delay: "1.8s" },
    ],
    shule: [
      { e: "📚", top: "7%",   left: "4%",   size: 54, anim: "bg-emoji-a", delay: "0s"   },
      { e: "✏️", top: "9%",   right: "4%",  size: 50, anim: "bg-emoji-b", delay: "0.8s" },
      { e: "🎒", top: "45%",  left: "2%",   size: 44, anim: "bg-emoji-c", delay: "1.6s" },
      { e: "📐", top: "41%",  right: "2%",  size: 42, anim: "bg-emoji-a", delay: "2.2s" },
      { e: "🏫", bottom: "20%", left: "7%", size: 36, anim: "bg-emoji-b", delay: "0.4s" },
      { e: "🖊️", bottom: "17%", right: "5%",size: 38, anim: "bg-emoji-c", delay: "1.1s" },
      { e: "🎓", top: "26%",  right: "10%", size: 30, anim: "bg-emoji-a", delay: "1.8s" },
    ],
    hisia: [
      { e: "❤️", top: "7%",   left: "4%",   size: 54, anim: "bg-emoji-a", delay: "0s"   },
      { e: "😊", top: "9%",   right: "4%",  size: 50, anim: "bg-emoji-b", delay: "0.8s" },
      { e: "😢", top: "45%",  left: "2%",   size: 44, anim: "bg-emoji-c", delay: "1.6s" },
      { e: "✨", top: "41%",  right: "2%",  size: 42, anim: "bg-emoji-a", delay: "2.2s" },
      { e: "🤗", bottom: "20%", left: "7%", size: 36, anim: "bg-emoji-b", delay: "0.4s" },
      { e: "🌟", bottom: "17%", right: "5%",size: 38, anim: "bg-emoji-c", delay: "1.1s" },
      { e: "💫", top: "26%",  right: "10%", size: 30, anim: "bg-emoji-a", delay: "1.8s" },
    ],
    mazingira: [
      { e: "🌿", top: "7%",   left: "4%",   size: 54, anim: "bg-emoji-a", delay: "0s"   },
      { e: "🌳", top: "9%",   right: "4%",  size: 52, anim: "bg-emoji-b", delay: "0.8s" },
      { e: "☀️", top: "45%",  left: "2%",   size: 46, anim: "bg-emoji-c", delay: "1.6s" },
      { e: "🌧️", top: "41%",  right: "2%",  size: 42, anim: "bg-emoji-a", delay: "2.2s" },
      { e: "🏔️", bottom: "20%", left: "7%", size: 36, anim: "bg-emoji-b", delay: "0.4s" },
      { e: "🌺", bottom: "17%", right: "5%",size: 38, anim: "bg-emoji-c", delay: "1.1s" },
      { e: "🦋", top: "26%",  right: "10%", size: 30, anim: "bg-emoji-a", delay: "1.8s" },
    ],
  };
  const bgEmojis = GAME_BG_EMOJIS[game] || [];

  const avatarState =
    status === "connecting"                              ? "connecting"  :
    starsFlash                                           ? "celebrating" :
    status === "speaking"                                ? "talking"     :
    status === "listening" && sessionStarted && pttActive ? "listening"  :
    "idle" as const;

  // Ring colour driven by session state (Figma-inspired: coloured ring around avatar)
  const ringColor =
    !sessionStarted ? "#E5E7EB" :
    isPaused        ? "#D1D5DB" :
    status === "speaking" ? "#6366F1" :
    pttActive       ? "#22C55E" : "#E5E7EB";

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Nunito', sans-serif", overflowX: "hidden" }}>

      {/* ── Header ── */}
      <header style={{ background: "white", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 0 rgba(0,0,0,0.06)", flexShrink: 0, zIndex: 10 }}>
        <button
          onClick={() => router.push(childId ? `/child/${childId}` : "/dashboard")}
          style={{ width: "54px", height: "54px", borderRadius: "50%", border: "none", background: "#F3F4F6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px", boxShadow: "0 3px 0 #D1D5DB" }}
        >🏠</button>

        <div style={{ background: GAME_COLORS[game] || "#FF8C00", borderRadius: "9999px", padding: "10px 22px", display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 4px 0 rgba(0,0,0,0.15)" }}>
          <span style={{ fontSize: "16px" }}>{GAME_EMOJIS[game]}</span>
          <span style={{ color: "white", fontWeight: 800, fontSize: "14px", fontFamily: "'Baloo 2', cursive" }}>{GAME_SHORT[game]}</span>
        </div>

        <div style={{ background: starsFlash ? "#FF8C00" : "#FEF3C7", borderRadius: "9999px", padding: "10px 18px", transition: "background 0.3s", display: "flex", alignItems: "center", gap: "6px", border: "2px solid #F59E0B", boxShadow: "0 3px 0 #D97706" }}>
          <span style={{ fontSize: "18px" }}>⭐</span>
          <span style={{ fontSize: "17px", fontWeight: 800, color: starsFlash ? "white" : "#92400E", fontFamily: "'Baloo 2', cursive" }}>{stars}</span>
        </div>
      </header>

      {/* ── Gradient Stage ── */}
      <div className="session-stage" style={{ background: "linear-gradient(160deg, #D4F0E0 0%, #B8E8CC 40%, #A0D8BC 100%)" }}>

        {/* Topic cartoon background emojis */}
        {bgEmojis.map((item, i) => (
          <div key={i} className={item.anim} style={{
            position: "absolute",
            top: item.top, bottom: item.bottom, left: item.left, right: item.right,
            fontSize: `${item.size}px`,
            opacity: 0.16,
            lineHeight: 1,
            userSelect: "none",
            pointerEvents: "none",
            animationDelay: item.delay,
            zIndex: 0,
          }}>
            {item.e}
          </div>
        ))}

        {/* Name + level + word progress */}
        <div className="app-page" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: "14px", position: "relative", zIndex: 1 }}>
          <div style={{ background: "rgba(255,255,255,0.75)", borderRadius: "9999px", padding: "6px 16px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#374151" }}>👋🏾 {childName}</span>
          </div>

          {sessionStarted && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px" }}>
              <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                {lessonWords.map((lw, i) => {
                  const done = revealedWordIndices.has(i);
                  const active = done && !revealedWordIndices.has(i + 1) && revealedWordIndices.size > 0;
                  return (
                    <div key={i} style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
                      transition: "all 0.4s",
                    }}>
                      <div style={{
                        width: "34px", height: "34px", borderRadius: "50%",
                        background: done ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.22)",
                        border: active ? "2.5px solid #fff" : done ? "2px solid rgba(255,255,255,0.6)" : "2px solid rgba(255,255,255,0.35)",
                        boxShadow: active ? "0 0 10px rgba(255,255,255,0.7)" : done ? "0 2px 8px rgba(0,0,0,0.12)" : "none",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.45s",
                        filter: done ? "none" : "grayscale(1)",
                        opacity: done ? 1 : 0.55,
                      }}>
                        <FluentEmoji emoji={lessonEmojis[i]} size={22} />
                      </div>
                      {done && (
                        <span style={{ fontSize: "8px", fontWeight: 800, color: "white", maxWidth: "36px", textAlign: "center", letterSpacing: "0.01em", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {language === "sw" ? lw.sw : lw.en}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.8)", letterSpacing: "0.04em" }}>
                {wordsIntroduced}/{lessonWords.length} {language === "sw" ? "maneno" : "words"}
              </span>
            </div>
          )}

          <div style={{ background: "rgba(255,255,255,0.75)", borderRadius: "9999px", padding: "6px 16px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#374151" }}>{levelLabel}</span>
          </div>
        </div>

        {/* ── Word Reveal (floating, no card) ── */}
        {revealCard && (
          <div
            className={revealCard.dismissing ? "word-dismiss" : "word-reveal"}
            style={{
              position: "relative", zIndex: 10,
              display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
              marginBottom: "8px",
              pointerEvents: "none",
            }}
          >
            <LottieEmoji emoji={revealCard.emoji} size={100} loop />
            <span style={{
              fontSize: "26px", fontWeight: 900, color: "white",
              fontFamily: "'Baloo 2', cursive",
              textShadow: "0 2px 10px rgba(0,0,0,0.25)",
              letterSpacing: "0.01em",
            }}>
              {revealCard.primary}
            </span>
            <span style={{
              fontSize: "12px", fontWeight: 700,
              color: "rgba(255,255,255,0.82)",
              textShadow: "0 1px 4px rgba(0,0,0,0.2)",
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}>
              {revealCard.secondary}
            </span>
          </div>
        )}

        {/* Status bubble */}
        <div style={{ background: "white", borderRadius: "9999px", padding: "9px 24px", marginBottom: "18px", boxShadow: "0 3px 16px rgba(0,0,0,0.12)", display: "inline-flex", alignItems: "center", gap: "6px", position: "relative", zIndex: 1 }}>
          <span style={{ fontSize: "16px" }}>
            {status === "reconnecting" ? "🔄" :
             status === "connecting" ? "⏳" :
             !sessionStarted ? "🎓" :
             isPaused ? "⏸" :
             status === "speaking" ? "🔊" :
             pttActive ? "🖐🏾" : "⏳"}
          </span>
          <span style={{ fontWeight: 800, fontSize: "14px", color: "#374151" }}>
            {status === "reconnecting" ? ts.reconnecting :
             status === "connecting" ? ts.connecting :
             !sessionStarted ? ts.readyToLearn :
             isPaused ? ts.sessionPaused :
             status === "speaking" ? ts.tichaIsTalking :
             pttActive ? ts.yourTurnToSpeak :
             ts.gettingReady}
          </span>
        </div>

        {/* Avatar inside white circle with coloured ring */}
        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Pulsing rings behind the circle */}
          {sessionStarted && !isPaused && (pttActive || status === "speaking") && (
            <>
              <div className="mic-ring" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "330px", height: "330px", borderRadius: "50%", background: ringColor, opacity: 0.18 }} />
              <div className="mic-ring" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "305px", height: "305px", borderRadius: "50%", background: ringColor, opacity: 0.12, animationDelay: "0.35s" }} />
            </>
          )}
          {/* White circle frame */}
          <div className="avatar-circle" style={{
            border: `5px solid ${ringColor}`,
            boxShadow: "0 6px 32px rgba(0,0,0,0.14)",
          }}>
            <TichaAvatar state={avatarState} size={245} analyser={analyserNode} />
          </div>
          {isCameraOn && (
            <div style={{ position: "absolute", bottom: "10px", right: "-8px", borderRadius: "10px", overflow: "hidden", border: "3px solid #22C55E", zIndex: 2 }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: "72px", height: "54px", objectFit: "cover", display: "block" }} />
            </div>
          )}
        </div>
      </div>

      {/* ── White Bottom Panel ── */}
      <div style={{ background: "white", flex: 1, borderRadius: "28px 28px 0 0", marginTop: "-24px", display: "flex", flexDirection: "column", alignItems: "center", padding: "22px 20px 40px", zIndex: 5, position: "relative" }}>

        {/* Hint */}
        <p style={{ fontSize: "15px", color: !sessionStarted ? "#1F2937" : "#9CA3AF", fontWeight: 800, textAlign: "center", marginBottom: "16px", letterSpacing: "0.02em" }}>
          {!sessionStarted ? ts.hintStart :
           isPaused ? ts.hintPaused :
           status === "speaking" ? ts.hintListening :
           pttActive ? ts.hintSpeak :
           ts.hintWait}
        </p>

        {/* Controls */}
        {!sessionStarted ? (
          <button
            onClick={startSession}
            disabled={status === "connecting"}
            className={status !== "connecting" ? "btn-control" : ""}
            style={{ width: "110px", height: "110px", borderRadius: "50%", background: status === "connecting" ? "#9CA3AF" : "#FF8C00", border: "none", cursor: status === "connecting" ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: status !== "connecting" ? "0 8px 0 #CC6A00, 0 14px 36px rgba(255,140,0,0.45)" : "none" }}
          >
            {status === "connecting" ? (
              <span style={{ fontSize: "38px" }}>⏳</span>
            ) : (
              <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="2" width="6" height="11" rx="3" fill="white"/>
                <path d="M5 11a7 7 0 0 0 14 0" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                <line x1="12" y1="18" x2="12" y2="22" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                <line x1="8" y1="22" x2="16" y2="22" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
            <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {pttActive && !isPaused && (
                  <>
                    <div className="mic-ring" style={{ position: "absolute", width: "130px", height: "130px", borderRadius: "50%", background: "#22C55E", opacity: 0.22 }} />
                    <div className="mic-ring" style={{ position: "absolute", width: "116px", height: "116px", borderRadius: "50%", background: "#22C55E", opacity: 0.14 }} />
                  </>
                )}
                <div style={{
                  width: "110px", height: "110px", borderRadius: "50%",
                  background: isPaused ? "#D1D5DB" :
                               status === "speaking" ? "#6366F1" :
                               pttActive ? "#22C55E" : "#E5E7EB",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: status === "speaking" && !isPaused ? "0 8px 0 #4338CA, 0 14px 36px rgba(99,102,241,0.45)" :
                             pttActive && !isPaused ? "0 8px 0 #16A34A, 0 14px 36px rgba(34,197,94,0.45)" :
                             "0 3px 10px rgba(0,0,0,0.1)",
                  transition: "background 0.3s, box-shadow 0.3s",
                }}>
                  {isPaused ? (
                    <span style={{ fontSize: "42px" }}>⏸</span>
                  ) : status === "speaking" ? (
                    <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
                      <path d="M11 5L6 9H2v6h4l5 4V5z" fill="white"/>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                    </svg>
                  ) : pttActive ? (
                    <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
                      <rect x="9" y="2" width="6" height="11" rx="3" fill="white"/>
                      <path d="M5 11a7 7 0 0 0 14 0" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                      <line x1="12" y1="18" x2="12" y2="22" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                      <line x1="8" y1="22" x2="16" y2="22" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <span style={{ fontSize: "42px" }}>⏳</span>
                  )}
                </div>
              </div>
              <p style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.05em", margin: 0, textAlign: "center",
                color: isPaused ? "#9CA3AF" : status === "speaking" ? "#6366F1" : pttActive ? "#22C55E" : "#9CA3AF" }}>
                {isPaused ? ts.labelPaused : status === "speaking" ? ts.labelTalking : pttActive ? ts.labelYourTurn : ts.labelWaiting}
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button onClick={togglePause} className="btn-control"
                style={{ padding: "11px 22px", borderRadius: "16px", border: `2.5px solid ${isPaused ? "#F59E0B" : "#E5E7EB"}`, background: isPaused ? "#FFFBEB" : "white", fontSize: "14px", fontWeight: 800, color: isPaused ? "#D97706" : "#6B7280", cursor: "pointer", fontFamily: "'Baloo 2', cursive", boxShadow: isPaused ? "0 4px 0 #D97706" : "0 4px 0 #D1D5DB" }}>
                {isPaused ? ts.resume : ts.pause}
              </button>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                <button onClick={toggleCamera} className="btn-control"
                  title={isCameraOn ? "Turn camera off" : "Show Ticha what you see"}
                  style={{ padding: "11px 14px", borderRadius: "16px", border: `2.5px solid ${isCameraOn ? "#22C55E" : "#E5E7EB"}`, background: isCameraOn ? "#F0FDF4" : "white", fontSize: "14px", fontWeight: 800, color: isCameraOn ? "#16A34A" : "#6B7280", cursor: "pointer", boxShadow: isCameraOn ? "0 4px 0 #16A34A" : "0 4px 0 #D1D5DB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 7l-7 5 7 5V7z"/>
                    <rect x="1" y="5" width="15" height="14" rx="2"/>
                  </svg>
                </button>
                <span style={{ fontSize: "10px", fontWeight: 700, color: isCameraOn ? "#16A34A" : "#9CA3AF", letterSpacing: "0.03em" }}>
                  {isCameraOn ? "CAM ON" : "CAMERA"}
                </span>
              </div>
              <button onClick={() => endSession(true)} className="btn-control"
                style={{ padding: "11px 22px", borderRadius: "16px", border: "2.5px solid #FCA5A5", background: "#FFF1F2", fontSize: "14px", fontWeight: 800, color: "#EF4444", cursor: "pointer", fontFamily: "'Baloo 2', cursive", boxShadow: "0 4px 0 #FCA5A5" }}>
                {ts.end}
              </button>
            </div>
          </div>
        )}

        {status === "reconnecting" && (
          <div style={{ background: "#FEF9C3", borderRadius: "12px", padding: "12px 16px", maxWidth: "300px", textAlign: "center", marginTop: "14px", border: "1.5px solid #FCD34D" }}>
            <p style={{ color: "#92400E", fontSize: "13px", fontWeight: 700, marginBottom: "2px" }}>
              {ts.reconnectTitle}
            </p>
            <p style={{ color: "#78350F", fontSize: "11px", fontWeight: 500, margin: 0 }}>
              {ts.reconnectSub}
            </p>
          </div>
        )}

        {status === "error" && errorMsg && (
          <div style={{ background: "#FEE2E2", borderRadius: "12px", padding: "12px 16px", maxWidth: "300px", textAlign: "center", marginTop: "14px" }}>
            <p style={{ color: "#B91C1C", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>{errorMsg}</p>
            <button onClick={() => { setStatus("idle"); setErrorMsg(""); reconnectAttemptsRef.current = 0; }} style={{ background: "#EF4444", color: "white", border: "none", borderRadius: "9999px", padding: "6px 18px", cursor: "pointer", fontSize: "12px", fontWeight: 700, boxShadow: "0 3px 0 #B91C1C" }}>
              {ts.tryAgain}
            </button>
          </div>
        )}
      </div>

      {/* ── Session end celebration overlay ── */}
      {showCelebration && celebrationData && (
        <div style={{ position: "fixed", inset: 0, background: "linear-gradient(160deg, #1E3A8A 0%, #0D1F5C 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 300, padding: "32px" }}>
          <TichaAvatar state="celebrating" size={200} />
          <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "32px", fontWeight: 800, color: "white", marginTop: "20px", marginBottom: "8px", textAlign: "center" }}>
            {language === "sw" ? "Hongera! 🎉" : "Well done! 🎉"}
          </h1>
          <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.65)", marginBottom: "28px", textAlign: "center" }}>
            {language === "sw"
              ? `Umejifunza maneno ${celebrationData.words} leo!`
              : `You learned ${celebrationData.words} words today!`}
          </p>
          <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: "20px", padding: "20px 40px", border: "1px solid rgba(255,255,255,0.15)", textAlign: "center" }}>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.55)", marginBottom: "4px" }}>
              {language === "sw" ? "Umepata" : "Stars earned"}
            </p>
            <p style={{ fontSize: "36px", fontWeight: 800, color: "#FDE68A", fontFamily: "'Baloo 2', cursive" }}>
              ⭐ +{celebrationData.stars}
            </p>
          </div>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", marginTop: "24px" }}>
            {language === "sw" ? "Mchezo wa maneno unaanza..." : "Word quiz coming up..."}
          </p>
        </div>
      )}

      {debugOn && debugLog.length > 0 && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxHeight: "38vh", overflowY: "auto", background: "rgba(0,0,0,0.88)", padding: "6px 12px 10px", zIndex: 9999 }}>
          <button
            onClick={() => {
              const text = [debugHeader, ...debugLog].join("\n");
              navigator.clipboard?.writeText(text).catch(() => {});
            }}
            style={{ position: "sticky", top: 0, float: "right", fontSize: "10px", padding: "3px 10px", borderRadius: "6px", border: "none", background: "#a3e635", color: "#111", fontWeight: 700 }}
          >
            copy
          </button>
          {debugHeader && (
            <p style={{ position: "sticky", top: 0, fontSize: "10px", color: "#fde047", fontFamily: "monospace", margin: "0 0 4px", fontWeight: 700, background: "rgba(0,0,0,0.95)", padding: "2px 0" }}>{debugHeader}</p>
          )}
          {debugLog.map((line, i) => (
            <p key={i} style={{ fontSize: "9px", color: "#a3e635", fontFamily: "monospace", margin: "1px 0", wordBreak: "break-word" }}>{line}</p>
          ))}
        </div>
      )}
    </main>
  );
}
