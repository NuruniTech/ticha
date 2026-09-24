"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getItem, type ReadingItem } from "@/lib/reading/curriculum";
import { planLesson } from "@/lib/reading/lesson";
import { judgeHeard } from "@/lib/reading/judge";
import type { Attempt, AttemptOutcome } from "@/lib/reading/mastery";
import { decideCheckForTrack, type StoredRow } from "@/lib/reading/checks";
import { readingTrack, trackKinds } from "@/lib/reading/track";
import {
  buildSteps, startConductor, applyVerdict, advanceGuided, currentStep, isCheckStep, isGuided,
  type ConductorState, type StepKind,
} from "@/lib/reading/conductor";
import { greetingInstruction, promptInstruction, feedbackInstruction, shouldPlayClip, nothingLeftInstruction } from "@/lib/reading/instructions";

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
  canReplay: boolean; // never during a check: replaying would give the answer away
}

interface Options {
  childId: string | null;
  childName: string;
  childAge?: number;
  sendToModel: (text: string) => void;
  playClip: (url: string) => Promise<boolean>; // false when the recording is unavailable
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
const NO_AUDIO_FALLBACK_MS = 7_000; // Ticha never spoke the feedback: carry on anyway

// What we are waiting for Ticha to finish saying before moving on.
//   afterModel / afterTogether: a guided (unscored) step just spoken -> advance past it.
type Pending = "greeting" | "startStep" | "afterModel" | "afterTogether" | "end" | null;

const TOGETHER_WAIT_MS = 15_000; // child never joins in: move on rather than wait forever

export function useReadingLesson(options: Options) {
  const optsRef = useRef(options);
  useEffect(() => { optsRef.current = options; });

  const [card, setCard] = useState<ReadingCard | null>(null);

  const stateRef = useRef<ConductorState | null>(null);
  const sessionIdRef = useRef("");
  const pendingRef = useRef<Pending>(null);
  const audioSincePendingRef = useRef(false);
  const expectingRef = useRef(false);
  // True once the app's own mic detection has seen the child finish speaking since
  // the current prompt. A report without it is premature: the model may call the
  // function straight after asking, before the child has said anything.
  const spokeSincePromptRef = useRef(false);
  const togetherRef = useRef(false); // waiting for the child to say it WITH Ticha (unscored)
  const togetherTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptSentAtRef = useRef(0);
  const reportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const summaryRef = useRef({ attempts: 0, correct: 0, incorrect: 0, unscored: 0, check_attempts: 0, movedOn: 0, autoUnscored: 0 });

  const clearTimers = () => {
    if (reportTimerRef.current) clearTimeout(reportTimerRef.current);
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    if (togetherTimerRef.current) clearTimeout(togetherTimerRef.current);
    reportTimerRef.current = fallbackTimerRef.current = togetherTimerRef.current = null;
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

    const track = readingTrack(optsRef.current.childAge);
    const check = decideCheckForTrack(track, stored);
    const steps = buildSteps({ plan: planLesson(byItem, { kinds: trackKinds(track) }), check: check ?? undefined });
    stateRef.current = startConductor(steps);
    sessionIdRef.current = newSessionId();
    pendingRef.current = null;
    expectingRef.current = false;
    log(`📖 Reading lesson ready (${track} track): ${steps.length} steps${check ? `, starting with ${check.phase}` : ""}`);
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
  const proceed = (p: Exclude<Pending, "end" | null>) => {
    if ((p === "afterModel" || p === "afterTogether") && stateRef.current) {
      stateRef.current = advanceGuided(stateRef.current);
    }
    void startStep();
  };

  const armFallback = () => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    audioSincePendingRef.current = false;
    fallbackTimerRef.current = setTimeout(() => {
      const p = pendingRef.current;
      if (p && p !== "end") {
        optsRef.current.log("⚠️ No feedback audio — starting the next step anyway");
        pendingRef.current = null;
        proceed(p);
      }
    }, NO_AUDIO_FALLBACK_MS);
  };

  const startStep = useCallback(async () => {
    const st = stateRef.current;
    const step = st && currentStep(st);
    if (!st || !step) {
      // Nothing (left) to practise: say goodbye so the lesson ends instead of hanging.
      if (st?.done) { pendingRef.current = "end"; optsRef.current.sendToModel(nothingLeftInstruction); }
      return;
    }
    const item = getItem(step.itemId)!;
    const isRetry = st.tries > 0;
    setCard({ item, index: st.index, total: st.steps.length, kind: step.kind, canReplay: !isCheckStep(step) });

    const clipExpected = shouldPlayClip(step, isRetry);
    const clipPlayed = clipExpected ? await optsRef.current.playClip(item.audio) : false;
    if (clipExpected && !clipPlayed) optsRef.current.log(`🔇 no recording for ${item.id} — Ticha says it instead`);

    const instruction = promptInstruction(step, { isRetry, clipPlayed, clipExpected });

    // Guided steps ("I do" / "we do") are not scored: nothing is reported.
    if (isGuided(step)) {
      expectingRef.current = false;
      optsRef.current.sendToModel(instruction);
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
        }, TOGETHER_WAIT_MS);
      }
      return;
    }

    expectingRef.current = true;
    spokeSincePromptRef.current = false;
    promptSentAtRef.current = Date.now();
    optsRef.current.sendToModel(instruction);
  // proceed/armFallback are stable, refs-only helpers
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Records the verdict and returns the instruction Ticha should follow next,
  // or null when no attempt was being waited for (ignored: a stray or duplicate report).
  const finishAttempt = useCallback((outcome: AttemptOutcome): string | null => {
    const st = stateRef.current;
    const step = st && currentStep(st);
    if (!st || !step || !expectingRef.current) return null;
    expectingRef.current = false;
    if (reportTimerRef.current) { clearTimeout(reportTimerRef.current); reportTimerRef.current = null; }

    saveAttempt(step.itemId, outcome, step.kind, Date.now() - promptSentAtRef.current);
    const { state, advance } = applyVerdict(st, outcome);
    stateRef.current = state;

    const sm = summaryRef.current;
    sm.attempts += 1; sm[outcome] += 1;
    if (isCheckStep(step)) sm.check_attempts += 1;
    if ((advance.action === "next" || advance.action === "end") && advance.movedOn) sm.movedOn += 1;
    if (outcome === "correct" && !isCheckStep(step)) optsRef.current.onCorrect();

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
    const outcome: AttemptOutcome = step ? judgeHeard(step.itemId, heard) : "unscored";
    // Debug log only (never stored or sent anywhere): shows why an attempt was scored as it was.
    optsRef.current.log(`👂 heard "${typeof heard === "string" ? heard : ""}" for "${step ? getItem(step.itemId)!.text : "?"}" → ${outcome}`);
    return finishAttempt(outcome) ?? "[APP] Ignored. Wait quietly for the next [APP] message.";
  }, [finishAttempt]);

  const begin = useCallback(() => {
    pendingRef.current = "greeting";
    armFallback();
    optsRef.current.sendToModel(greetingInstruction(optsRef.current.childName));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onModelAudio = useCallback(() => { audioSincePendingRef.current = true; }, []);

  /** Ticha finished a spoken turn. If we were waiting for her feedback, move on. */
  const onTurnComplete = useCallback(() => {
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
  const onChildTurnEnded = useCallback(() => {
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
        optsRef.current.sendToModel(text);
      }
    }, NO_REPORT_MS);
  }, [finishAttempt]);

  const replay = useCallback(() => {
    const st = stateRef.current;
    const step = st && currentStep(st);
    if (step && !isCheckStep(step)) void optsRef.current.playClip(getItem(step.itemId)!.audio);
  }, []);

  const summary = useCallback(() => ({ ...summaryRef.current }), []);

  return { card, prepare, giveConsent, begin, handleToolCall, onModelAudio, onTurnComplete, onChildTurnEnded, replay, summary };
}
