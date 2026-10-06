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
  buildSteps, startConductor, applyVerdict, advanceGuided, currentStep, isCheckStep,
  type ConductorState, type StepKind, type Stage,
} from "@/lib/reading/conductor";
import {
  WARMUP_FEELING, WARMUP_FEELING_FALLBACK, WARMUP_QUESTIONS, WARMUP_QUESTION_REACTION_FALLBACK,
  READY_CHECK, CLASS_INTRO, TEACH_ALONE, TEACH_PLAY, PRAISE, RETRY_INCORRECT, RETRY_UNSCORED,
  MOVED_ON_AFTER_MISS, CHECK_NEUTRAL, CHECK_DISCONTINUE, MIXED_INTRO,
  teachModel, togetherCount, matchFeelingReaction, matchFunWord, type FunCategory,
} from "@/lib/reading/scripts";

// Runs one reading lesson under the scripted-TTS architecture (see
// docs/superpowers/specs/2026-10-06-reading-tts-scripted-architecture-design.md):
// Ticha's lines are exact, pre-written Swahili (spoken via `speak`, a static
// recording or a narrow on-the-fly TTS fallback — see scripts.ts), and the
// child's answers are understood by the app itself (one-shot transcription
// outside this hook, delivered here as plain text via `onChildUtterance`) —
// never by asking a live conversational model to relay what it heard. That
// removes a whole category of old timing bugs (a report arriving before the
// child spoke, one that never arrives, a stray report during an unscored
// moment) since there is no second party's own turn-taking to race against.
//
// Control flow is straight-line async code, not a pending-ref state machine:
// `speak()` resolves when the audio finishes, and `awaitChildUtterance()`
// turns the event-driven listening callback into something `await`-able.

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
  speak: (lineId: string, opts?: { name?: string; word?: string }) => Promise<boolean>;
  playClip: (url: string) => Promise<boolean>; // the recorded pronunciation clip for the item on screen
  onCorrect: () => void;
  log: (msg: string) => void;
}

function newSessionId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch { /* fall through */ }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type PrepareResult = { ok: true } | { needsConsent: true } | { error: string };

const SILENCE_CHECKIN_MS = 12_000; // a gentle "still there?", twice, before counting a scored step unscored
const WARMUP_WAIT_MS = 15_000;    // child doesn't answer the friendly chat: carry on
const TOGETHER_READY_WAIT_MS = 8_000; // waiting for any ack before the count-in
const PLAY_WAIT_MS = 20_000;
const STEP_GAP_MS = 1_200; // a breath between steps
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

export function useReadingLesson(options: Options) {
  const optsRef = useRef(options);
  useEffect(() => { optsRef.current = options; });

  const [card, setCard] = useState<ReadingCard | null>(null);
  const [collected, setCollected] = useState<string[]>([]);
  const [celebrateKey, setCelebrateKey] = useState(0);

  const stateRef = useRef<ConductorState | null>(null);
  const sessionIdRef = useRef("");
  const warmupDoneRef = useRef(false);
  const runTokenRef = useRef(0); // bumped on resume()/teardown so a stale run's awaits give up quietly
  const summaryRef = useRef({ attempts: 0, correct: 0, incorrect: 0, unscored: 0, check_attempts: 0, movedOn: 0, autoUnscored: 0 });

  // Converts the event-driven "child spoke" callback into something awaitable.
  // Only one waiter at a time — the lesson is always doing exactly one thing.
  const utteranceWaiterRef = useRef<((heard: string) => void) | null>(null);
  const awaitChildUtterance = useCallback((timeoutMs: number): Promise<string | null> => {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v: string | null) => { if (done) return; done = true; utteranceWaiterRef.current = null; resolve(v); };
      utteranceWaiterRef.current = (heard) => finish(heard);
      setTimeout(() => finish(null), timeoutMs); // null = timed out, not "heard nothing" (empty string IS a real, judged outcome)
    });
  }, []);

  const speak = useCallback((lineId: string, opts?: { name?: string; word?: string }) => optsRef.current.speak(lineId, opts), []);

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
      if (r.phase !== "practice") continue;
      (byItem[r.item_id] ??= []).push({ sessionId: r.session_id, outcome: r.outcome as AttemptOutcome, at: Date.parse(r.created_at) });
    }

    const category = optsRef.current.category;
    const check = decideCheckForCategory(category, stored);
    const steps = buildSteps({ plan: planLesson(byItem, { kinds: CATEGORY_KINDS[category] }), check: check ?? undefined });
    stateRef.current = startConductor(steps);
    sessionIdRef.current = newSessionId();
    setCollected([]);
    setCelebrateKey(0);
    warmupDoneRef.current = false;
    log(`📖 Reading lesson ready (${category}): ${steps.length} steps${check ? `, starting with ${check.phase}` : ""}`);
    return { ok: true };
  }, []);

  const giveConsent = useCallback(async (): Promise<boolean> => {
    const { childId } = optsRef.current;
    if (!childId) return false;
    try {
      const res = await fetch("/api/reading-consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childId }) });
      return res.ok;
    } catch { return false; }
  }, []);

  // ── Warmup: a real back-and-forth before any learning ───────────────────

  const runWarmup = useCallback(async (myToken: number) => {
    await sleep(STEP_GAP_MS);
    await speak(WARMUP_FEELING.id);
    const feeling = await awaitChildUtterance(WARMUP_WAIT_MS);
    if (runTokenRef.current !== myToken) return;
    const reaction = feeling ? matchFeelingReaction(feeling) : null;
    await speak(reaction ? pick(reaction.variants.map((_, i) => `${reaction.groupId}_${i + 1}`)) : WARMUP_FEELING_FALLBACK.id);

    await sleep(STEP_GAP_MS);
    const q = pick(WARMUP_QUESTIONS);
    const category: FunCategory = q.id === "warmup_q_animal" ? "animal" : q.id === "warmup_q_food" ? "food" : "colour";
    await speak(q.id);
    const funAnswer = await awaitChildUtterance(WARMUP_WAIT_MS);
    if (runTokenRef.current !== myToken) return;
    const word = funAnswer ? matchFunWord(category, funAnswer) : null;
    if (word) await speak("warmup_q_reaction_word", { word });
    else await speak(WARMUP_QUESTION_REACTION_FALLBACK.id);

    await sleep(STEP_GAP_MS);
    await speak(READY_CHECK.id);
    await awaitChildUtterance(WARMUP_WAIT_MS); // the "uko tayari" answer itself isn't branched on — any reply (or none) moves on
    if (runTokenRef.current !== myToken) return;
    warmupDoneRef.current = true;
  }, [speak, awaitChildUtterance]);

  // ── One scored attempt: speak the prompt, wait for the child, judge it ──

  const silenceNudgesRef = useRef(0);

  /** Waits for the child's answer with the two-stage gentle check-in, then judges it. Null = truly no sound at all. */
  const listenAndJudge = useCallback(async (itemId: string, myToken: number): Promise<AttemptOutcome | null> => {
    silenceNudgesRef.current = 0;
    while (true) {
      const heard = await awaitChildUtterance(SILENCE_CHECKIN_MS);
      if (runTokenRef.current !== myToken) return null;
      if (heard !== null) {
        const outcome = judgeHeard(itemId, heard);
        optsRef.current.log(`👂 heard "${heard}" for "${getItem(itemId)!.text}" → ${outcome}`);
        return outcome;
      }
      silenceNudgesRef.current += 1;
      if (silenceNudgesRef.current >= 2) {
        optsRef.current.log("⚠️ Child stayed silent — counted as unscored");
        return "unscored";
      }
      optsRef.current.log("⚠️ Child has not spoken — gentle check-in");
      await speak(RETRY_UNSCORED.id); // reused as the check-in nudge: short, warm, asks again
    }
  }, [speak, awaitChildUtterance]);

  const finishAttempt = useCallback(async (itemId: string, outcome: AttemptOutcome, kind: StepKind, latencyMs: number) => {
    const st = stateRef.current!;
    saveAttempt(itemId, outcome, kind, latencyMs);
    const { state, advance } = applyVerdict(st, outcome);
    stateRef.current = state;

    const sm = summaryRef.current;
    sm.attempts += 1; sm[outcome] += 1;
    if (kind === "baseline" || kind === "checkpoint") sm.check_attempts += 1;
    if ((advance.action === "next" || advance.action === "end") && advance.movedOn) sm.movedOn += 1;
    if (outcome === "correct" && kind !== "baseline" && kind !== "checkpoint") {
      optsRef.current.onCorrect();
      setCollected((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]));
      setCelebrateKey((k) => k + 1);
    }
    optsRef.current.log(`📖 ${itemId} → ${outcome} (${advance.action})`);
    return advance;
  }, [saveAttempt]);

  // ── The lesson proper: one step at a time, following the conductor ──────

  const runStep = useCallback(async (myToken: number): Promise<void> => {
    const st = stateRef.current;
    const step = st && currentStep(st);
    if (!st || !step) {
      if (st?.done) { await speak("lesson_end", { name: optsRef.current.childName }); }
      return;
    }
    const item = getItem(step.itemId)!;
    const isRetry = st.tries > 0;
    setCard({ item, index: st.index, total: st.steps.length, kind: step.kind, stage: step.stage, canReplay: !isCheckStep(step) });
    optsRef.current.log(`▶️ Step ${st.index + 1}/${st.steps.length}: ${step.kind}${step.stage ? "/" + step.stage : ""} ${item.id}${isRetry ? " (retry)" : ""}`);

    // One-time class intro, vowels only, right before the very first vowel is taught.
    if (step.kind === "teach" && item.kind === "vowel" && st.steps.findIndex((s) => s.kind === "teach") === st.index) {
      await sleep(STEP_GAP_MS);
      await speak(CLASS_INTRO.id);
    }
    if (step.phaseStart && !isRetry && step.kind !== "teach") {
      await sleep(STEP_GAP_MS);
      if (step.kind === "baseline" || step.kind === "checkpoint") await speak(READY_CHECK.id); // reused: "let's play a little game" framing
      if (step.kind === "mixed" && item.kind === "vowel") await speak(MIXED_INTRO.id);
      // KNOWN GAP, not an oversight to silently patch: a "review" phaseStart has
      // no announced framing ("let's remember what you learned before") the way
      // the old instructions.ts gave it. Only matters once a child has moved past
      // their first baseline into real teach+review cycles — not exercised by a
      // brand-new learner's first session, which is all that's been tested so
      // far. Needs a founder-reviewed "review_intro" script line before this is
      // filled in, same as everything else that gets spoken.
    }

    const vowel = item.kind === "vowel" ? item.text : null;

    if (step.stage === "model") {
      await sleep(STEP_GAP_MS);
      await optsRef.current.playClip(item.audio);
      await speak(vowel ? teachModel(vowel).id : TEACH_ALONE.id); // non-vowel model lines aren't scripted per-item yet; falls back to a generic prompt
      if (runTokenRef.current !== myToken) return;
      stateRef.current = advanceGuided(stateRef.current!);
      await runStep(myToken);
      return;
    }
    if (step.stage === "together") {
      await sleep(STEP_GAP_MS);
      await speak("together_intro");
      await awaitChildUtterance(TOGETHER_READY_WAIT_MS); // any ack (or none) proceeds to the count-in
      if (runTokenRef.current !== myToken) return;
      await optsRef.current.playClip(item.audio);
      await speak(vowel ? togetherCount(vowel).id : TEACH_ALONE.id);
      await awaitChildUtterance(TOGETHER_READY_WAIT_MS); // give them a beat to join in before moving on
      if (runTokenRef.current !== myToken) return;
      stateRef.current = advanceGuided(stateRef.current!);
      await runStep(myToken);
      return;
    }
    if (step.stage === "play") {
      await sleep(STEP_GAP_MS);
      await speak(pick(TEACH_PLAY).id);
      await awaitChildUtterance(PLAY_WAIT_MS);
      if (runTokenRef.current !== myToken) return;
      stateRef.current = advanceGuided(stateRef.current!);
      await runStep(myToken);
      return;
    }

    // Scored step: play the clip (on a retry, or always for a check/review/mixed per shouldPlayClip's old rule — simplified here to "always except on a check"), ask, listen, judge.
    await sleep(STEP_GAP_MS);
    if (!isCheckStep(step)) await optsRef.current.playClip(item.audio);
    await speak(TEACH_ALONE.id); // the screen shows the item; this line is deliberately generic across every scored step
    const startedAt = Date.now();
    const outcome = await listenAndJudge(step.itemId, myToken);
    if (runTokenRef.current !== myToken || outcome === null) return;
    const advance = await finishAttempt(step.itemId, outcome, step.kind, Date.now() - startedAt);
    if (runTokenRef.current !== myToken) return;

    await sleep(STEP_GAP_MS);
    if (advance.action === "end") {
      await speak("lesson_end", { name: optsRef.current.childName });
      return;
    }
    if (isCheckStep(step)) {
      await speak(advance.action !== "retry" && advance.discontinued ? CHECK_DISCONTINUE.id : CHECK_NEUTRAL.id);
    } else if (advance.action === "retry") {
      await speak(outcome === "unscored" ? RETRY_UNSCORED.id : pick(RETRY_INCORRECT).id);
    } else if (advance.movedOn) {
      await speak(MOVED_ON_AFTER_MISS.id);
    } else {
      await speak(pick(PRAISE).id);
    }
    if (runTokenRef.current !== myToken) return;
    await runStep(myToken);
  }, [speak, awaitChildUtterance, listenAndJudge, finishAttempt]);

  const begin = useCallback(() => {
    const myToken = ++runTokenRef.current;
    void (async () => {
      await speak("greeting", { name: optsRef.current.childName });
      if (runTokenRef.current !== myToken) return;
      if (!warmupDoneRef.current) await runWarmup(myToken);
      if (runTokenRef.current !== myToken) return;
      await runStep(myToken);
    })();
  }, [speak, runWarmup, runStep]);

  /** The child started speaking (VAD activityStart) — currently informational only; kept for parity with the pre-rewrite hook's event shape. */
  const onChildTurnStarted = useCallback(() => {}, []);

  /** The child's turn ended and VoiceSession has already transcribed it. heard === "" means no usable speech. */
  const onChildUtterance = useCallback((heard: string) => {
    utteranceWaiterRef.current?.(heard);
  }, []);

  const replay = useCallback(() => {
    const st = stateRef.current;
    const step = st && currentStep(st);
    if (step && !isCheckStep(step)) void optsRef.current.playClip(getItem(step.itemId)!.audio);
  }, []);

  /** A dropped connection is irrelevant now — there is no live session to lose. Kept as a no-op for VoiceSession's existing call sites during the transition. */
  const resume = useCallback(() => {}, []);

  const summary = useCallback(() => ({ ...summaryRef.current }), []);

  useEffect(() => () => { runTokenRef.current += 1; }, []); // unmount: stop any in-flight run from proceeding

  return { card, collected, celebrateKey, prepare, giveConsent, begin, onChildTurnStarted, onChildUtterance, replay, resume, summary };
}
