"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getItem, type ReadingItem } from "@/lib/reading/curriculum";
import { planLesson } from "@/lib/reading/lesson";
import type { Attempt, AttemptOutcome } from "@/lib/reading/mastery";
import { decideCheck, type StoredRow } from "@/lib/reading/checks";
import {
  buildSteps, startConductor, applyVerdict, currentStep, isCheckStep,
  type ConductorState, type StepKind,
} from "@/lib/reading/conductor";
import { greetingInstruction, promptInstruction, feedbackInstruction, shouldPlayClip } from "@/lib/reading/instructions";

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

type Pending = "greeting" | "startStep" | "end" | null;

export function useReadingLesson(options: Options) {
  const optsRef = useRef(options);
  useEffect(() => { optsRef.current = options; });

  const [card, setCard] = useState<ReadingCard | null>(null);

  const stateRef = useRef<ConductorState | null>(null);
  const sessionIdRef = useRef("");
  const pendingRef = useRef<Pending>(null);
  const audioSincePendingRef = useRef(false);
  const expectingRef = useRef(false);
  const promptSentAtRef = useRef(0);
  const reportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const summaryRef = useRef({ attempts: 0, correct: 0, incorrect: 0, unscored: 0, check_attempts: 0, movedOn: 0, autoUnscored: 0 });

  const clearTimers = () => {
    if (reportTimerRef.current) clearTimeout(reportTimerRef.current);
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    reportTimerRef.current = fallbackTimerRef.current = null;
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

    const check = decideCheck(stored);
    const steps = buildSteps({ plan: planLesson(byItem), check: check ?? undefined });
    stateRef.current = startConductor(steps);
    sessionIdRef.current = newSessionId();
    pendingRef.current = null;
    expectingRef.current = false;
    log(`📖 Reading lesson ready: ${steps.length} steps${check ? `, starting with ${check.phase}` : ""}`);
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

  const armFallback = () => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    audioSincePendingRef.current = false;
    fallbackTimerRef.current = setTimeout(() => {
      if (pendingRef.current === "greeting" || pendingRef.current === "startStep") {
        optsRef.current.log("⚠️ No feedback audio — starting the next step anyway");
        pendingRef.current = null;
        void startStep();
      }
    }, NO_AUDIO_FALLBACK_MS);
  };

  const startStep = useCallback(async () => {
    const st = stateRef.current;
    const step = st && currentStep(st);
    if (!st || !step) return;
    const item = getItem(step.itemId)!;
    const isRetry = st.tries > 0;
    setCard({ item, index: st.index, total: st.steps.length, kind: step.kind, canReplay: !isCheckStep(step) });

    const clipExpected = shouldPlayClip(step, isRetry);
    const clipPlayed = clipExpected ? await optsRef.current.playClip(item.audio) : false;
    if (clipExpected && !clipPlayed) optsRef.current.log(`🔇 no recording for ${item.id} — Ticha says it instead`);

    expectingRef.current = true;
    promptSentAtRef.current = Date.now();
    optsRef.current.sendToModel(promptInstruction(step, { isRetry, clipPlayed, clipExpected }));
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
    return feedbackInstruction(step, outcome, advance);
  // armFallback/startStep are stable refs-only helpers
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveAttempt]);

  /** Ticha called report_attempt. Returns the text to hand back as the tool result. */
  const handleToolCall = useCallback((args: unknown): string => {
    const r = (args as { result?: unknown } | null)?.result;
    const outcome: AttemptOutcome = r === "correct" ? "correct" : r === "incorrect" ? "incorrect" : "unscored";
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
    if ((p === "greeting" || p === "startStep") && audioSincePendingRef.current) {
      pendingRef.current = null;
      if (fallbackTimerRef.current) { clearTimeout(fallbackTimerRef.current); fallbackTimerRef.current = null; }
      void startStep();
    }
  }, [startStep]);

  /** The child stopped speaking. If Ticha never reports, count it as unscored. */
  const onChildTurnEnded = useCallback(() => {
    if (!expectingRef.current) return;
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
