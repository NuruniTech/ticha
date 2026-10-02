"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getItem, type ReadingItem } from "@/lib/reading/curriculum";
import { planLesson } from "@/lib/reading/lesson";
import { judgeHeard } from "@/lib/reading/judge";
import type { Attempt, AttemptOutcome } from "@/lib/reading/mastery";
import { decideCheckForCategory, type StoredRow } from "@/lib/reading/checks";
import { CATEGORY_KINDS, type ReadingCategory } from "@/lib/reading/categories";
import {
  buildSteps, startConductor, applyVerdict, advanceGuided, currentStep, isCheckStep, isGuided,
  type ConductorState, type StepKind, type Stage,
} from "@/lib/reading/conductor";
import { greetingInstruction, promptInstruction, feedbackInstruction, shouldPlayClip, nothingLeftInstruction, warmupInstructions, WARMUP_TURNS } from "@/lib/reading/instructions";

// Runs one reading lesson. The APP steers (see lib/reading/conductor.ts);
// Ticha, through Gemini Live, speaks, listens and reports each attempt by
// calling report_attempt. This hook owns the sequencing around that:
//
//   greeting -> [ feedback for the last attempt ] -> app plays the recording ->
//   app asks Ticha to prompt the child -> child answers -> Ticha calls
//   report_attempt -> (feedback) -> ...
//
// Nothing here stores audio or speech text — only the verdict per attempt.

export interface ReadingCard {
  item: ReadingItem;
  index: number;
  total: number;
  kind: StepKind;
  stage?: Stage;
  canReplay: boolean; // never during a check: replaying would give the answer away
}

interface Options {
  childId: string | null;
  childName: string;
  category: ReadingCategory;
  sendToModel: (text: string) => void;
  playClip: (url: string) => Promise<boolean>; // false when the recording is unavailable
  roll?: () => Promise<boolean>;                // swap in a fresh Gemini session; false if it failed
  onCorrect: () => void;
  log: (msg: string) => void;
}

// crypto.randomUUID() only exists in secure contexts (https / localhost) and newer
// browsers. This id just groups one sitting's attempts, so a fallback is fine.
function newSessionId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch { /* fall through */ }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type PrepareResult = { ok: true } | { needsConsent: true } | { error: string };

const NO_REPORT_MS = 9_000;    // child finished speaking but Ticha never reported
const NO_AUDIO_FALLBACK_MS = 8_000; // Ticha never started speaking: carry on anyway
// Once she IS speaking, only step in if the audio goes quiet AND her turn never ends.
// (A single timer from the moment of sending fired mid-sentence and started the next
// step over her voice.)
const SPEAKING_IDLE_MS = 15_000;

// What we are waiting for Ticha to finish saying before moving on.
//   afterModel / afterTogether: a guided (unscored) step just spoken -> advance past it.
type Pending = "greeting" | "startStep" | "afterModel" | "afterTogether" | "afterWarmup" | "end" | null;

// The native-audio model slows down and stalls as one session ages, so we swap in a
// fresh session every few prompts, and straight away after any stall or fallback.
const ROLL_EVERY_SENDS = 3;

// A breath between steps: without it the lesson moves at machine speed, and a small
// child has no time to enjoy the praise, hear the next thing coming, or answer.
const STEP_GAP_MS = 1_500;
const PLAY_WAIT_MS = 20_000;     // a game with the sound: give the child longer to join in
const WARMUP_WAIT_MS = 15_000;   // child does not answer the friendly question: carry on
const TOGETHER_WAIT_MS = 15_000;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)); // child never joins in: move on rather than wait forever

export function useReadingLesson(options: Options) {
  const optsRef = useRef(options);
  useEffect(() => { optsRef.current = options; });

  const [card, setCard] = useState<ReadingCard | null>(null);
  // Sounds the child has got right in this lesson (each earns a "sound friend" sticker),
  // and a counter that ticks on every correct answer so the screen can celebrate it.
  const [collected, setCollected] = useState<string[]>([]);
  const [celebrateKey, setCelebrateKey] = useState(0);

  const stateRef = useRef<ConductorState | null>(null);
  const sessionIdRef = useRef("");
  const pendingRef = useRef<Pending>(null);
  const audioSincePendingRef = useRef(false);
  const expectingRef = useRef(false);
  // True once the app's own mic detection has seen the child finish speaking since
  // the current prompt. A report without it is premature: the model may call the
  // function straight after asking, before the child has said anything.
  const spokeSincePromptRef = useRef(false);
  // The child spoke over Ticha. The server then sends a "turn complete" for the
  // CUT-OFF reply, which must not be mistaken for her finishing what she meant to say.
  const interruptedRef = useRef(false);
  const sendsSinceRollRef = useRef(0);
  const needsRollRef = useRef(false);
  const warmupIndexRef = useRef(0);    // which friendly question we are on
  const warmupPlanRef = useRef<string[]>([]);
  const warmedUpRef = useRef(false);
  const warmupDoneRef = useRef(false); // true once all WARMUP_TURNS have completed and the lesson has begun   // the friendly chat happens once per lesson (not again after a reconnect)
  const warmupRef = useRef(false);     // currently waiting for the child to answer the friendly question
  const togetherRef = useRef(false); // waiting for the child to say it WITH Ticha (unscored)
  const togetherTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptSentAtRef = useRef(0);
  const reportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True silence on a scored step (the child never even triggers the mic's speech
  // detection) previously had NO timeout at all — the lesson would just hang. Two
  // gentle check-ins, then the attempt counts as unscored and the lesson moves on.
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceNudgesRef = useRef(0);
  const summaryRef = useRef({ attempts: 0, correct: 0, incorrect: 0, unscored: 0, check_attempts: 0, movedOn: 0, autoUnscored: 0 });

  // Every message we send to Ticha starts a new model turn, so count them.
  const send = (text: string) => {
    sendsSinceRollRef.current += 1;
    optsRef.current.sendToModel(text);
  };

  const clearTimers = () => {
    if (reportTimerRef.current) clearTimeout(reportTimerRef.current);
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    if (togetherTimerRef.current) clearTimeout(togetherTimerRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    reportTimerRef.current = fallbackTimerRef.current = togetherTimerRef.current = silenceTimerRef.current = null;
  };
  useEffect(() => clearTimers, []);

  const prepare = useCallback(async (): Promise<PrepareResult> => {
    const { childId, log } = optsRef.current;
    if (!childId) return { error: "Reading needs a child profile. Please sign in and choose a child." };

    const { data: child, error: childErr } = await supabase
      .from("children").select("reading_consent_at").eq("id", childId).single();
    if (childErr || !child) return { error: "Could not load this child's profile." };
    if (!child.reading_consent_at) return { needsConsent: true };

    const { data: rows, error: rowsErr } = await supabase
      .from("reading_attempts")
      .select("item_id, outcome, phase, session_id, created_at")
      .eq("child_id", childId).limit(5000);
    if (rowsErr) return { error: "Could not load reading progress." };

    const stored = (rows ?? []) as (StoredRow & { session_id: string })[];
    const byItem: Record<string, Attempt[]> = {};
    for (const r of stored) {
      if (r.phase !== "practice") continue; // checks measure; only practice builds mastery
      (byItem[r.item_id] ??= []).push({ sessionId: r.session_id, outcome: r.outcome as AttemptOutcome, at: Date.parse(r.created_at) });
    }

    const category = optsRef.current.category;
    const check = decideCheckForCategory(category, stored);
    const steps = buildSteps({ plan: planLesson(byItem, { kinds: CATEGORY_KINDS[category] }), check: check ?? undefined });
    stateRef.current = startConductor(steps);
    sessionIdRef.current = newSessionId();
    setCollected([]);
    setCelebrateKey(0);
    pendingRef.current = null;
    expectingRef.current = false;
    log(`📖 Reading lesson ready (${category}): ${steps.length} steps${check ? `, starting with ${check.phase}` : ""}`);
    return { ok: true };
  }, []);

  const giveConsent = useCallback(async (): Promise<boolean> => {
    const { childId } = optsRef.current;
    if (!childId) return false;
    try {
      const res = await fetch("/api/reading-consent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId }),
      });
      return res.ok;
    } catch { return false; }
  }, []);

  const saveAttempt = useCallback((itemId: string, outcome: AttemptOutcome, kind: StepKind, latencyMs: number) => {
    const { childId, log } = optsRef.current;
    if (!childId) return;
    const phase = kind === "baseline" ? "baseline" : kind === "checkpoint" ? "checkpoint" : "practice";
    const body = JSON.stringify({ childId, sessionId: sessionIdRef.current, itemId, outcome, phase, latencyMs });
    const send = () => fetch("/api/reading-attempt", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    send()
      .then((r) => { if (!r.ok) log(`⚠️ attempt not saved (${r.status})`); })
      .catch(() => { setTimeout(() => { send().catch(() => log("⚠️ attempt not saved (network)")); }, 2000); });
  }, []);

  // Move on after Ticha has finished speaking. A guided step is advanced past first.
  // Between steps is the safe moment to swap in a fresh Gemini session.
  const startWarmup = () => {
    if (!warmedUpRef.current) {
      warmedUpRef.current = true;
      warmupIndexRef.current = 0;
      warmupPlanRef.current = warmupInstructions();
    }
    optsRef.current.log(`💬 Friendly chat ${warmupIndexRef.current + 1}/${WARMUP_TURNS}`);
    send(warmupPlanRef.current[warmupIndexRef.current]);
    warmupRef.current = true;
    if (togetherTimerRef.current) clearTimeout(togetherTimerRef.current);
    togetherTimerRef.current = setTimeout(() => {
      if (!warmupRef.current) return;
      warmupRef.current = false;
      // The child is not answering: stop chatting and start the lesson.
      optsRef.current.log("⚠️ Child did not answer the friendly question — starting the lesson");
      warmupIndexRef.current = WARMUP_TURNS;
      proceed("afterWarmup");
    }, WARMUP_WAIT_MS);
  };

  const proceed = (p: Exclude<Pending, "end" | null>) => {
    if ((p === "afterModel" || p === "afterTogether") && stateRef.current) {
      stateRef.current = advanceGuided(stateRef.current);
    }
    // After the greeting comes a real back-and-forth chat, before any learning.
    if (p === "greeting" && !warmedUpRef.current) {
      void (async () => { await sleep(STEP_GAP_MS); startWarmup(); })();
      return;
    }
    if (p === "afterWarmup") {
      warmupIndexRef.current += 1;
      if (warmupIndexRef.current < WARMUP_TURNS) {
        void (async () => { await sleep(STEP_GAP_MS); startWarmup(); })();
        return;
      }
      warmupDoneRef.current = true;
    }
    void (async () => {
      await sleep(STEP_GAP_MS); // a breath before every step
      if (optsRef.current.roll && (needsRollRef.current || sendsSinceRollRef.current >= ROLL_EVERY_SENDS)) {
        const ok = await optsRef.current.roll();
        if (ok) { needsRollRef.current = false; sendsSinceRollRef.current = 0; }
      }
      await startStep();
    })();
  };

  const armFallback = (ms: number = NO_AUDIO_FALLBACK_MS, resetAudioFlag = true) => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    if (resetAudioFlag) audioSincePendingRef.current = false;
    fallbackTimerRef.current = setTimeout(() => {
      const p = pendingRef.current;
      if (p && p !== "end") {
        optsRef.current.log("⚠️ No feedback audio — starting the next step anyway");
        needsRollRef.current = true;
        pendingRef.current = null;
        proceed(p);
      }
    }, ms);
  };

  const startStep = useCallback(async () => {
    const st = stateRef.current;
    const step = st && currentStep(st);
    if (!st || !step) {
      // Nothing (left) to practise: say goodbye so the lesson ends instead of hanging.
      if (st?.done) { pendingRef.current = "end"; send(nothingLeftInstruction); }
      return;
    }
    const item = getItem(step.itemId)!;
    const isRetry = st.tries > 0;
    setCard({ item, index: st.index, total: st.steps.length, kind: step.kind, stage: step.stage, canReplay: !isCheckStep(step) });

    optsRef.current.log(`▶️ Step ${st.index + 1}/${st.steps.length}: ${step.kind}${step.stage ? "/" + step.stage : ""} ${item.id}${isRetry ? " (retry)" : ""}`);
    const clipExpected = shouldPlayClip(step, isRetry);
    const clipPlayed = clipExpected ? await optsRef.current.playClip(item.audio) : false;
    if (clipExpected && !clipPlayed) optsRef.current.log(`🔇 no recording for ${item.id} — Ticha says it instead`);

    const instruction = promptInstruction(step, { isRetry, clipPlayed, clipExpected });

    // Guided steps ("I do" / "we do") are not scored: nothing is reported.
    if (isGuided(step)) {
      expectingRef.current = false;
      send(instruction);
      if (step.stage === "model") {
        pendingRef.current = "afterModel";
        armFallback();
      } else {
        togetherRef.current = true;
        if (togetherTimerRef.current) clearTimeout(togetherTimerRef.current);
        togetherTimerRef.current = setTimeout(() => {
          if (!togetherRef.current) return;
          togetherRef.current = false;
          optsRef.current.log("⚠️ Child did not join in — moving on");
          proceed("afterTogether");
        }, step.stage === "play" ? PLAY_WAIT_MS : TOGETHER_WAIT_MS);
      }
      return;
    }

    expectingRef.current = true;
    spokeSincePromptRef.current = false;
    promptSentAtRef.current = Date.now();
    silenceNudgesRef.current = 0;
    armSilenceCheckIn();
    send(instruction);
  // proceed/armFallback/armSilenceCheckIn are stable, refs-only helpers
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The child never triggers the mic's speech detection at all (as opposed to
  // speaking but Ticha never reporting, which onChildTurnEnded/NO_REPORT_MS below
  // already covers). Check in gently once, then once more, then give up kindly.
  const SILENCE_CHECKIN_MS = 12_000;
  const armSilenceCheckIn = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      if (!expectingRef.current || spokeSincePromptRef.current) return; // resolved or the child did speak
      silenceNudgesRef.current += 1;
      if (silenceNudgesRef.current >= 2) {
        optsRef.current.log("⚠️ Child stayed silent — counted as unscored");
        const text = finishAttempt("unscored");
        if (text) send(text);
        return;
      }
      optsRef.current.log("⚠️ Child has not spoken — sending a gentle check-in");
      send("[APP] The child has been quiet for a little while. In ONE short, warm Swahili sentence check in gently (for example ask if they are still there, or say there is no hurry), then in ONE more short sentence repeat the invitation to answer. Then stay silent and listen.");
      armSilenceCheckIn();
    }, SILENCE_CHECKIN_MS);
  };

  // Records the verdict and returns the instruction Ticha should follow next,
  // or null when no attempt was being waited for (ignored: a stray or duplicate report).
  const finishAttempt = useCallback((outcome: AttemptOutcome): string | null => {
    const st = stateRef.current;
    const step = st && currentStep(st);
    if (!st || !step || !expectingRef.current) return null;
    expectingRef.current = false;
    if (reportTimerRef.current) { clearTimeout(reportTimerRef.current); reportTimerRef.current = null; }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }

    saveAttempt(step.itemId, outcome, step.kind, Date.now() - promptSentAtRef.current);
    const { state, advance } = applyVerdict(st, outcome);
    stateRef.current = state;

    const sm = summaryRef.current;
    sm.attempts += 1; sm[outcome] += 1;
    if (isCheckStep(step)) sm.check_attempts += 1;
    if ((advance.action === "next" || advance.action === "end") && advance.movedOn) sm.movedOn += 1;
    if (outcome === "correct" && !isCheckStep(step)) {
      optsRef.current.onCorrect();
      setCollected((prev) => (prev.includes(step.itemId) ? prev : [...prev, step.itemId]));
      setCelebrateKey((k) => k + 1);
    }

    pendingRef.current = advance.action === "end" ? "end" : "startStep";
    if (advance.action !== "end") armFallback();
    optsRef.current.log(`📖 ${step.itemId} → ${outcome} (${advance.action})`);
    const learned = [...new Set(state.steps.filter((x) => x.kind === "teach").map((x) => getItem(x.itemId)!.text))];
    return feedbackInstruction(step, outcome, advance, learned);
  // armFallback/startStep are stable refs-only helpers
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveAttempt]);

  /** Ticha called report_attempt with what she heard. The APP judges it. Returns the tool result text. */
  const handleToolCall = useCallback((args: unknown): string => {
    const heard = (args as { heard?: unknown } | null)?.heard;
    const st = stateRef.current;
    const step = st && currentStep(st);
    if (expectingRef.current && !spokeSincePromptRef.current) {
      optsRef.current.log("⚠️ Report arrived before the child spoke — ignored");
      return "[APP] The child has not spoken yet. Stay completely silent and wait for them to answer. Do not call report_attempt until they have spoken.";
    }
    // A stray call outside a scored step (e.g. mid friendly-chat) is thrown away by
    // finishAttempt below; say so up front rather than printing a misleading verdict.
    if (!step || !expectingRef.current) {
      optsRef.current.log(`👂 heard "${typeof heard === "string" ? heard : ""}" — not currently expecting an answer, ignored`);
      return finishAttempt("unscored") ?? "[APP] Ignored — do NOT speak. Stay completely silent until the next [APP] message.";
    }
    const outcome: AttemptOutcome = judgeHeard(step.itemId, heard);
    // Debug log only (never stored or sent anywhere): shows why an attempt was scored as it was.
    optsRef.current.log(`👂 heard "${typeof heard === "string" ? heard : ""}" for "${getItem(step.itemId)!.text}" → ${outcome}`);
    return finishAttempt(outcome) ?? "[APP] Ignored — do NOT speak. Stay completely silent until the next [APP] message.";
  }, [finishAttempt]);

  const begin = useCallback(() => {
    pendingRef.current = "greeting";
    armFallback();
    send(greetingInstruction(optsRef.current.childName));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastRearmRef = useRef(0);
  const onModelAudio = useCallback(() => {
    interruptedRef.current = false; // a new reply has started: the cut-off one is over
    audioSincePendingRef.current = true;
    // She is speaking: swap the short "never started" timer for a long "gone quiet" one,
    // pushed back as audio keeps arriving (throttled: chunks come every few ms).
    const now = Date.now();
    if (pendingRef.current && pendingRef.current !== "end" && fallbackTimerRef.current && now - lastRearmRef.current > 400) {
      lastRearmRef.current = now;
      armFallback(SPEAKING_IDLE_MS, false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Ticha finished a spoken turn. If we were waiting for her feedback, move on. */
  const onInterrupted = useCallback(() => { interruptedRef.current = true; }, []);

  const onTurnComplete = useCallback(() => {
    if (interruptedRef.current) { interruptedRef.current = false; return; } // the cut-off turn ending
    const p = pendingRef.current;
    if (p === "end") { pendingRef.current = null; return; }
    if (p && audioSincePendingRef.current) {
      pendingRef.current = null;
      if (fallbackTimerRef.current) { clearTimeout(fallbackTimerRef.current); fallbackTimerRef.current = null; }
      proceed(p);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startStep]);

  /** The child stopped speaking. If Ticha never reports, count it as unscored. */
  // The child has just STARTED speaking (VAD activityStart), before we know how long
  // for. The silence check-in only has to wonder whether the child has spoken at all
  // since the prompt, not whether they have finished — so cancel it the instant they
  // begin, rather than waiting for them to stop. Without this, the check-in could fire
  // literally mid-answer (seen on a device log: it fired at the 12s mark while the
  // child was still talking, so Ticha started a "are you still there?" line on top of
  // the answer she was about to score — two of her own turns colliding).
  const onChildTurnStarted = useCallback(() => {
    spokeSincePromptRef.current = true;
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
  }, []);

  const onChildTurnEnded = useCallback(() => {
    // The child joined in while Ticha was still modelling the item: count that as
    // "we do" (they are saying it with her), so go straight on once she has replied.
    if (pendingRef.current === "afterModel" && stateRef.current) {
      stateRef.current = advanceGuided(stateRef.current); // model -> together
      pendingRef.current = "afterTogether";               // ... and proceed() moves on past together
      armFallback();
      return;
    }
    // Friendly chat: the child has answered. Let Ticha react, then start the lesson.
    if (warmupRef.current) {
      warmupRef.current = false;
      if (togetherTimerRef.current) { clearTimeout(togetherTimerRef.current); togetherTimerRef.current = null; }
      pendingRef.current = "afterWarmup";
      armFallback();
      return;
    }
    // "We do": the child has joined in. Let Ticha's brief praise finish, then go on.
    if (togetherRef.current) {
      togetherRef.current = false;
      if (togetherTimerRef.current) { clearTimeout(togetherTimerRef.current); togetherTimerRef.current = null; }
      pendingRef.current = "afterTogether";
      armFallback();
      return;
    }
    if (!expectingRef.current) return;
    spokeSincePromptRef.current = true;
    if (reportTimerRef.current) clearTimeout(reportTimerRef.current);
    reportTimerRef.current = setTimeout(() => {
      const text = finishAttempt("unscored");
      if (text) {
        summaryRef.current.autoUnscored += 1;
        optsRef.current.log("⚠️ Ticha did not report — counted as unscored");
        needsRollRef.current = true;
        send(text);
      }
    }, NO_REPORT_MS);
  }, [finishAttempt]);

  const replay = useCallback(() => {
    const st = stateRef.current;
    const step = st && currentStep(st);
    if (step && !isCheckStep(step)) void optsRef.current.playClip(getItem(step.itemId)!.audio);
  }, []);

  /** A fresh Gemini session has been swapped in after a drop: restart the current step from the top. */
  const resume = useCallback(() => {
    clearTimers();
    pendingRef.current = null;
    expectingRef.current = false;
    togetherRef.current = false;
    warmupRef.current = false;
    sendsSinceRollRef.current = 0;
    needsRollRef.current = false;
    // A drop mid-chat used to jump straight into the lesson and silently skip
    // whatever was left of the friendly chat. Re-ask the current chat turn instead
    // (the child may hear it twice if they had just answered, which is far better
    // than the conversation vanishing).
    if (!warmupDoneRef.current) {
      optsRef.current.log("▶️ Resuming the friendly chat on the fresh session");
      startWarmup();
      return;
    }
    const st = stateRef.current;
    if (!st || st.done) return;
    stateRef.current = { ...st, tries: 0, unscored: 0 };
    optsRef.current.log("▶️ Resuming the lesson on the fresh session");
    void startStep();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useCallback(() => ({ ...summaryRef.current }), []);

  return { card, collected, celebrateKey, prepare, giveConsent, begin, handleToolCall, onModelAudio, onInterrupted, onTurnComplete, onChildTurnStarted, onChildTurnEnded, replay, resume, summary };
}
