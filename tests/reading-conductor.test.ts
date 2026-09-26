import { describe, it, expect } from "vitest";
import { buildSteps, startConductor, applyVerdict, advanceGuided, currentStep, isGuided, MAX_TRIES, DISCONTINUE_AFTER, type ConductorState } from "@/lib/reading/conductor";
import { decideCheck } from "@/lib/reading/checks";
import { CHECK_FORMS, isKnownItemId } from "@/lib/reading/curriculum";
import { greetingInstruction, shouldPlayClip, promptInstruction, feedbackInstruction, nothingLeftInstruction, warmupInstructions, WARMUP_TURNS, respellUnit, respellItem, PRAISES, VOWEL_SOUND } from "@/lib/reading/instructions";
import { SESSION_GAP_MS } from "@/lib/reading/validate";

const plan = { review: ["v-a"], teach: ["v-e", "v-i"], mixed: ["v-i", "v-e", "v-a"] };

describe("check forms", () => {
  it("are two disjoint sets of 10 real items", () => {
    expect(CHECK_FORMS.A).toHaveLength(10);
    expect(CHECK_FORMS.B).toHaveLength(10);
    [...CHECK_FORMS.A, ...CHECK_FORMS.B].forEach((id) => expect(isKnownItemId(id)).toBe(true));
    expect(CHECK_FORMS.A.filter((id) => (CHECK_FORMS.B as readonly string[]).includes(id))).toEqual([]);
  });
});

describe("check forms are easiest first", () => {
  const rank = (id: string) => ({ v: 0, s: 1, w: 2 } as Record<string, number>)[id[0]];
  it("run vowels, then syllables, then words", () => {
    for (const form of [CHECK_FORMS.A, CHECK_FORMS.B]) {
      const ranks = form.map(rank);
      expect(ranks).toEqual([...ranks].sort((x, y) => x - y));
    }
  });
});

describe("buildSteps", () => {
  it("orders check, review, teach, mixed and marks first appearances", () => {
    const steps = buildSteps({ plan, check: { phase: "baseline", items: ["s-ba"] } });
    // each new item is taught in three stages: model, together, alone
    // ...and a little game follows every second new item
    expect(steps.map((s) => s.kind)).toEqual(["baseline", "review", "teach", "teach", "teach", "teach", "teach", "teach", "teach", "mixed", "mixed", "mixed"]);
    expect(steps.filter((s) => s.kind === "teach").map((s) => `${s.itemId}:${s.stage}`)).toEqual([
      "v-e:model", "v-e:together", "v-e:alone", "v-i:model", "v-i:together", "v-i:alone", "v-i:play",
    ]);
    expect(steps.find((s) => s.itemId === "v-e" && s.stage === "model")!.first).toBe(true);
    expect(steps.find((s) => s.itemId === "v-e" && s.stage === "alone")!.first).toBe(false);
    expect(steps.find((s) => s.itemId === "v-e" && s.kind === "mixed")!.first).toBe(false);
  });
});

// Guided steps ("I do" / "we do") are not scored, so scoring tests step past them.
const skipGuided = (s: ConductorState): ConductorState => {
  while (currentStep(s) && isGuided(currentStep(s)!)) s = advanceGuided(s);
  return s;
};

describe("conductor", () => {
  it("teaches each new item as model, then together, then alone; only alone is scored", () => {
    let s = startConductor(buildSteps({ plan: { review: [], teach: ["v-a"], mixed: ["v-a"] } }));
    expect(currentStep(s)!.stage).toBe("model");
    s = advanceGuided(s);
    expect(currentStep(s)!.stage).toBe("together");
    s = advanceGuided(s);
    expect(currentStep(s)!.stage).toBe("alone");
    expect(isGuided(currentStep(s)!)).toBe(false);
    expect(applyVerdict(s, "incorrect").advance).toEqual({ action: "retry" }); // the alone step retries a miss
  });

  const run = (kinds: ("correct" | "incorrect" | "unscored")[], planIn = plan, check?: Parameters<typeof buildSteps>[0]["check"]) => {
    let s = startConductor(buildSteps({ plan: planIn, check }));
    const advances: string[] = [];
    for (const k of kinds) { s = skipGuided(s); const r = applyVerdict(s, k); s = r.state; advances.push(r.advance.action); }
    return { s, advances };
  };

  it("advances on a correct answer", () => {
    expect(run(["correct"]).advances).toEqual(["next"]);
  });

  it("retries a miss, then moves on after the maximum tries", () => {
    const { advances, s } = run(Array(MAX_TRIES).fill("incorrect"));
    expect(advances).toEqual(["retry", "retry", "next"]);
    expect(s.index).toBeGreaterThan(0);
  });

  it("moves on after two attempts it could not judge", () => {
    expect(run(["unscored", "unscored"]).advances).toEqual(["retry", "next"]);
  });

  it("gives checks exactly one attempt with no retry", () => {
    const { advances } = run(["incorrect"], plan, { phase: "baseline", items: ["s-ba", "s-be"] });
    expect(advances).toEqual(["next"]);
  });

  it("ends the lesson after the last step", () => {
    const one = { review: [], teach: ["v-a"], mixed: ["v-a"] };
    const { advances, s } = run(["correct", "correct"], one);
    expect(advances).toEqual(["next", "end"]);
    expect(s.done).toBe(true);
    expect(currentStep(s)).toBeNull();
  });

  it("reports movedOn when leaving without a correct answer", () => {
    let s = skipGuided(startConductor(buildSteps({ plan: { review: [], teach: ["v-a"], mixed: ["v-a"] } })));
    let last;
    for (let i = 0; i < MAX_TRIES; i++) { last = applyVerdict(s, "incorrect"); s = last.state; }
    expect(last!.advance).toEqual({ action: "next", movedOn: true });
  });
});

describe("phase starts", () => {
  it("flags the first step of each part of the lesson", () => {
    const steps = buildSteps({ plan, check: { phase: "baseline", items: ["s-ba", "s-be"] } });
    // baseline, baseline | review | teach, teach | mixed x3
    expect(steps.filter((x) => x.phaseStart).map((x) => x.kind)).toEqual(["baseline", "review", "teach", "mixed"]);
  });
});

describe("check stop rule", () => {
  const items = ["v-a", "v-o", "s-ba", "s-mo", "s-ti", "s-ke", "w-mama", "w-kuku", "w-soma", "w-sita"];
  const start = () => startConductor(buildSteps({ plan, check: { phase: "baseline", items } }));

  it("skips the rest of the check after 4 misses in a row, then carries on to the lesson", () => {
    let s = start();
    let last;
    for (let i = 0; i < DISCONTINUE_AFTER; i++) { last = applyVerdict(s, "incorrect"); s = last.state; }
    expect(last!.advance).toEqual({ action: "next", movedOn: false, discontinued: true });
    expect(currentStep(s)!.kind).toBe("review");
  });

  it("counts only consecutive misses: a correct answer resets the run", () => {
    let s = start();
    for (const o of ["incorrect", "incorrect", "correct", "incorrect", "incorrect"] as const) s = applyVerdict(s, o).state;
    expect(currentStep(s)!.kind).toBe("baseline");
  });
});

import { judgeHeard, normalizeSpeech } from "@/lib/reading/judge";

describe("the app judges what Ticha heard", () => {
  it("accepts an exact match, ignoring case, spaces and drawn-out sounds", () => {
    expect(judgeHeard("s-ba", "ba")).toBe("correct");
    expect(judgeHeard("s-ba", "BA")).toBe("correct");
    expect(judgeHeard("s-ba", "baaa")).toBe("correct");
    expect(judgeHeard("v-a", "aaa")).toBe("correct");
    expect(judgeHeard("w-baba", "ba ba")).toBe("correct");
    expect(judgeHeard("w-baba", "ba-ba")).toBe("correct");
  });

  it("marks a different sound or word incorrect", () => {
    expect(judgeHeard("s-ba", "pa")).toBe("incorrect");
    expect(judgeHeard("v-a", "e")).toBe("incorrect");
    expect(judgeHeard("w-mama", "baba")).toBe("incorrect");
    expect(judgeHeard("w-mama", "mana")).toBe("incorrect");
  });

  it("is unscored when nothing usable was heard", () => {
    expect(judgeHeard("s-ba", "")).toBe("unscored");
    expect(judgeHeard("s-ba", "   ")).toBe("unscored");
    expect(judgeHeard("s-ba", "unclear")).toBe("unscored");
    expect(judgeHeard("s-ba", undefined)).toBe("unscored");
    expect(judgeHeard("s-ba", 42)).toBe("unscored");
    expect(judgeHeard("s-nope", "ba")).toBe("unscored");
  });

  it("normalises to lower-case letters with repeats collapsed", () => {
    expect(normalizeSpeech("Ba-ba!")).toBe("baba");
    expect(normalizeSpeech("Baaa")).toBe("ba");
  });
});

describe("decideCheck", () => {
  const T0 = Date.parse("2026-10-01T09:00:00Z");
  const row = (item_id: string, phase: string, ms: number) => ({ item_id, outcome: "correct", phase, created_at: new Date(T0 + ms).toISOString() });
  const sessionsOfPractice = (n: number) => Array.from({ length: n }, (_, i) => row("v-a", "practice", i * (SESSION_GAP_MS + 60_000)));

  it("starts a new child on the baseline (form A)", () => {
    expect(decideCheck([])).toEqual({ phase: "baseline", items: [...CHECK_FORMS.A] });
  });

  it("resumes a part-finished baseline with only the missing items", () => {
    const rows = CHECK_FORMS.A.slice(0, 4).map((id) => row(id, "baseline", 0));
    expect(decideCheck(rows)!.items).toEqual([...CHECK_FORMS.A.slice(4)]);
  });

  it("does not repeat a finished baseline before any practice", () => {
    expect(decideCheck(CHECK_FORMS.A.map((id) => row(id, "baseline", 0)))).toBeNull();
  });

  it("is not due until 5 practice sessions have passed", () => {
    expect(decideCheck(sessionsOfPractice(4))).toBeNull();
    expect(decideCheck(sessionsOfPractice(5))).toEqual({ phase: "checkpoint", items: [...CHECK_FORMS.B] });
  });

  it("is next due 5 sessions after a completed checkpoint", () => {
    const done = CHECK_FORMS.B.map((id) => row(id, "checkpoint", 0));
    expect(decideCheck([...sessionsOfPractice(9), ...done])).toBeNull();
    expect(decideCheck([...sessionsOfPractice(10), ...done])!.phase).toBe("checkpoint");
  });

  it("resumes a part-finished checkpoint", () => {
    const partial = CHECK_FORMS.B.slice(0, 3).map((id) => row(id, "checkpoint", 0));
    expect(decideCheck([...sessionsOfPractice(5), ...partial])!.items).toEqual([...CHECK_FORMS.B.slice(3)]);
  });
});

describe("instructions", () => {
  const check = { itemId: "s-ba", kind: "baseline" as const, first: true, phaseStart: false };
  const teach = { itemId: "s-ba", kind: "teach" as const, first: true, phaseStart: false };
  const model = { ...teach, stage: "model" as const };
  const together = { ...teach, stage: "together" as const, first: false };
  const alone = { ...teach, stage: "alone" as const, first: false };
  const review = { itemId: "s-ba", kind: "review" as const, first: false, phaseStart: false };

  it("never plays the sound for a check, always while modelling and saying together, only on retry otherwise", () => {
    expect(shouldPlayClip(check, false)).toBe(false);
    expect(shouldPlayClip(model, false)).toBe(true);
    expect(shouldPlayClip(together, false)).toBe(true);
    expect(shouldPlayClip(alone, false)).toBe(false);
    expect(shouldPlayClip(alone, true)).toBe(true);
    expect(shouldPlayClip(review, false)).toBe(false);
    expect(shouldPlayClip(review, true)).toBe(true);
  });

  it("modelling blends the sounds and does not ask the child to answer or report", () => {
    const p = promptInstruction(model, { isRetry: false, clipPlayed: true, clipExpected: true });
    expect(p).toMatch(/one at a time \("b", then "ah"\)/);
    expect(p).toMatch(/respelled here as "bah"/);
    expect(p).toMatch(/Do NOT ask the child to say it yet/);
    expect(p).toMatch(/Do NOT call report_attempt/);
    const word = promptInstruction({ ...model, itemId: "w-mama" }, { isRetry: false, clipPlayed: true, clipExpected: true });
    expect(word).toMatch(/each syllable slowly/);
    expect(word).toMatch(/respelled here as "mah-mah"/);
    const vowel = promptInstruction({ ...model, itemId: "v-a" }, { isRetry: false, clipPlayed: true, clipExpected: true });
    expect(vowel).toMatch(/sound "ah" once, slowly/);
  });

  it("saying together invites the child to join and is not scored", () => {
    const p = promptInstruction(together, { isRetry: false, clipPlayed: true, clipExpected: true });
    expect(p).toMatch(/together with you/);
    expect(p).toMatch(/Do NOT call report_attempt for this step/);
    expect(p).not.toMatch(/listen. When the child answers, call report_attempt/);
  });

  it("the alone step tells the child it is their turn and asks Ticha to listen and report", () => {
    const p = promptInstruction(alone, { isRetry: false, clipPlayed: false, clipExpected: false });
    expect(p).toMatch(/their turn to say it alone/);
    expect(p).toMatch(/call report_attempt with exactly what you heard/);
  });

  it("forbids hinting during a check and stays silent about right/wrong", () => {
    const p = promptInstruction(check, { isRetry: false, clipPlayed: false, clipExpected: false });
    expect(p).toMatch(/Do NOT say it/);
    expect(feedbackInstruction(check, "incorrect", { action: "next", movedOn: false })).toMatch(/Do NOT say whether/);
  });

  it("welcomes each new part of the lesson aloud, but not on a retry", () => {
    const start = { ...model, phaseStart: true };
    expect(promptInstruction(start, { isRetry: false, clipPlayed: true, clipExpected: true })).toMatch(/new magic sound together/);
    expect(promptInstruction({ ...alone, phaseStart: true }, { isRetry: true, clipPlayed: true, clipExpected: true })).not.toMatch(/new magic sound together/);
    expect(promptInstruction({ ...check, phaseStart: true }, { isRetry: false, clipPlayed: false, clipExpected: false })).toMatch(/fine not to know some/);
  });

  it("names what was practised in the goodbye", () => {
    const bye = feedbackInstruction(teach, "correct", { action: "end", movedOn: false }, ["a", "e", "i"]);
    expect(bye).toMatch(/a, e, i/);
    expect(bye).toMatch(/tutaonana/);
  });

  it("closes a stopped check kindly without saying anything was wrong", () => {
    const t = feedbackInstruction(check, "incorrect", { action: "next", movedOn: false, discontinued: true });
    expect(t).toMatch(/game is finished/);
    expect(t).toMatch(/Do NOT say whether/);
  });

  it("makes Ticha say the sound herself only when a recording was expected but missing", () => {
    expect(promptInstruction(model, { isRetry: false, clipPlayed: false, clipExpected: true })).toMatch(/Say the sound "bah" clearly yourself/);
    expect(promptInstruction(model, { isRetry: false, clipPlayed: true, clipExpected: true })).not.toMatch(/clearly yourself/);
  });

  it("asks for the goodbye word at the end so the app can close the lesson", () => {
    expect(feedbackInstruction(teach, "correct", { action: "end", movedOn: false })).toMatch(/tutaonana/);
  });
});

import { getReadingSystemPrompt } from "@/lib/reading/prompt";

describe("reading system prompt", () => {
  const p = getReadingSystemPrompt("Amani");
  it("names the child and keeps Ticha to Swahili with the app in charge", () => {
    expect(p).toMatch(/Amani/);
    expect(p).toMatch(/ONLY Swahili/);
    expect(p).toMatch(/report_attempt/);
    expect(p).toMatch(/never choose, skip, or change/);
    expect(p).toMatch(/do NOT decide whether the child was right/i);
    expect(p).toMatch(/empty string/);
  });
  it("stays short (the vocabulary prompt is ~20k tokens)", () => {
    expect(p.length).toBeLessThan(4500);
  });
});

import { readingTrack, trackKinds, effectiveTrack, EARLY_TRACK_MAX_AGE } from "@/lib/reading/track";
import { planLesson } from "@/lib/reading/lesson";
import { decideCheckForTrack } from "@/lib/reading/checks";
import { READING_ITEMS, getItem } from "@/lib/reading/curriculum";

describe("reading tracks by age", () => {
  const mastered = (n = 0) => [
    { sessionId: "s1", outcome: "correct" as const, at: n + 1 },
    { sessionId: "s1", outcome: "correct" as const, at: n + 2 },
    { sessionId: "s2", outcome: "correct" as const, at: n + 3 },
  ];

  it("gives ages 4 and under the early track, 5+ or unknown the full track", () => {
    expect(readingTrack(3)).toBe("early");
    expect(readingTrack(EARLY_TRACK_MAX_AGE)).toBe("early");
    expect(readingTrack(5)).toBe("full");
    expect(readingTrack(7)).toBe("full");
    expect(readingTrack(undefined)).toBe("full");
    expect(readingTrack(null)).toBe("full");
    expect(readingTrack(NaN)).toBe("full");
  });

  it("limits the early track to the five vowels", () => {
    expect(trackKinds("early")).toEqual(["vowel"]);
    const plan = planLesson({}, { kinds: trackKinds("early") });
    expect(plan.teach).toEqual(["v-a", "v-e", "v-i", "v-o", "v-u"]);
  });

  it("never offers syllables or words to the early track, even when every vowel is mastered", () => {
    const all: Record<string, ReturnType<typeof mastered>> = {};
    READING_ITEMS.filter((i) => i.kind === "vowel").forEach((i, idx) => { all[i.id] = mastered(idx * 10); });
    const plan = planLesson(all, { kinds: trackKinds("early") });
    expect(plan.teach).toEqual([]);
    [...plan.review, ...plan.teach, ...plan.mixed].forEach((id) => expect(getItem(id)!.kind).toBe("vowel"));
  });

  it("keeps syllables in the full track and gives the early track no check", () => {
    const vowels: Record<string, ReturnType<typeof mastered>> = {};
    READING_ITEMS.filter((i) => i.kind === "vowel").forEach((i, idx) => { vowels[i.id] = mastered(idx * 10); });
    expect(planLesson(vowels, { kinds: trackKinds("full") }).teach[0]).toBe("s-ba");
    expect(decideCheckForTrack("early", [])).toBeNull();
    expect(decideCheckForTrack("full", [])!.phase).toBe("baseline");
  });
});

describe("empty lesson", () => {
  it("says goodbye with the closing word so the app can end the session", () => {
    expect(nothingLeftInstruction).toMatch(/tutaonana/);
  });
});

describe("age is a starting point, not a ceiling", () => {
  const m = (base: number) => [
    { sessionId: "s1", outcome: "correct" as const, at: base + 1 },
    { sessionId: "s1", outcome: "correct" as const, at: base + 2 },
    { sessionId: "s2", outcome: "correct" as const, at: base + 3 },
  ];
  const vowelIds = ["v-a", "v-e", "v-i", "v-o", "v-u"];
  const masteredVowels = (n: number) => Object.fromEntries(vowelIds.slice(0, n).map((id, i) => [id, m(i * 10)]));

  it("starts a young child on the early track", () => {
    expect(effectiveTrack(3, {})).toBe("early");
    expect(effectiveTrack(4, masteredVowels(4))).toBe("early"); // one vowel still to master
  });

  it("moves a young child to the full track once all five vowels are mastered", () => {
    expect(effectiveTrack(3, masteredVowels(5))).toBe("full");
  });

  it("never holds back an older child or one with no age", () => {
    expect(effectiveTrack(6, {})).toBe("full");
    expect(effectiveTrack(undefined, {})).toBe("full");
  });

  it("then offers syllables to the child who has moved on", () => {
    const track = effectiveTrack(3, masteredVowels(5));
    expect(planLesson(masteredVowels(5), { kinds: trackKinds(track) }).teach[0]).toBe("s-ba");
  });
});

describe("pronunciation (Ticha read the vowel e as the English letter name, which sounds like Swahili i)", () => {
  const model = { itemId: "v-e", kind: "teach" as const, stage: "model" as const, first: true, phaseStart: false };

  it("respells Swahili units so the model cannot read them as English letter names", () => {
    expect(respellUnit("e")).toBe("eh");
    expect(respellUnit("i")).toBe("ee");
    expect(respellUnit("ba")).toBe("bah");
    expect(respellUnit("me")).toBe("meh");
    expect(respellUnit("so")).toBe("soh");
    expect(respellUnit("ku")).toBe("koo");
    expect(respellItem("w-soma")).toBe("soh-mah");
    expect(respellItem("w-nane")).toBe("nah-neh");
  });

  it("gives every vowel an unambiguous sound", () => {
    expect(Object.keys(VOWEL_SOUND).sort()).toEqual(["a", "e", "i", "o", "u"]);
    expect(VOWEL_SOUND.e).toMatch(/eh/);
    expect(VOWEL_SOUND.e).toMatch(/pesa/);
  });

  it("asks for the respelling, not the letter, when modelling the vowel e", () => {
    const p = promptInstruction(model, { isRetry: false, clipPlayed: true, clipExpected: true });
    expect(p).toMatch(/Say the sound "eh" once, slowly/);
    expect(p).toMatch(/exactly as respelled here: "eh"/);
    expect(p).toMatch(/never the English letter name/);
  });

  it("covers the vowels inside syllables and words too", () => {
    const syl = promptInstruction({ ...model, itemId: "s-me" }, { isRetry: false, clipPlayed: true, clipExpected: true });
    expect(syl).toMatch(/respelled here as "meh"/);
    expect(syl).toMatch(/The vowel "e" is "eh"/);
    const word = promptInstruction({ ...model, itemId: "w-nane" }, { isRetry: false, clipPlayed: true, clipExpected: true });
    expect(word).toMatch(/"nah-neh"/);
    expect(word).toMatch(/The vowel "a" is "ah"/);
  });

  it("puts the same rules in Ticha's standing prompt", () => {
    const p = getReadingSystemPrompt("Amani");
    expect(p).toMatch(/NEVER said "ee"/);
    expect(p).toMatch(/say EXACTLY that/);
    expect(p).toMatch(/Never say English letter names/);
  });
});

describe("a less robotic lesson", () => {
  it("opens with a real three-exchange chat before any teaching", () => {
    const w = warmupInstructions(() => 0);
    expect(w).toHaveLength(WARMUP_TURNS);
    expect(w[0]).toMatch(/how they are feeling today/);
    expect(w[1]).toMatch(/React to what the child just said/);
    expect(w[1]).toMatch(/favourite animal/);
    expect(w[2]).toMatch(/magic sounds/);
    expect(w[2]).toMatch(/ask if they are ready/);
    w.forEach((line) => {
      expect(line).toMatch(/Do NOT teach anything/);
      expect(line).toMatch(/Do NOT call report_attempt/);
      expect(line).toMatch(/stay silent and listen/);
    });
  });

  it("asks a different fun question each time", () => {
    const seen = new Set([0, 0.4, 0.8].map((r) => warmupInstructions(() => r)[1]));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("varies its praise", () => {
    const step = { itemId: "v-a", kind: "mixed" as const, first: false, phaseStart: false };
    const seen = new Set(PRAISES.map((_, i) => feedbackInstruction(step, "correct", { action: "next", movedOn: false }, [], () => i / PRAISES.length)));
    expect(seen.size).toBe(PRAISES.length);
    expect([...seen][0]).toMatch(/not scripted/);
  });

  it("keeps the standing prompt about a playful friend, slow pace and short turns", () => {
    const p = getReadingSystemPrompt("Amani");
    expect(p).toMatch(/cheerful, playful, patient friend/);
    expect(p).toMatch(/NOT a classroom teacher/);
    expect(p).toMatch(/Speak SLOWLY/);
    expect(p).toMatch(/Keep every turn short/);
  });

  it("plays a little game with the sound, unscored, and lets the child join in", () => {
    const play = { itemId: "v-a", kind: "teach" as const, stage: "play" as const, first: false, phaseStart: false };
    expect(isGuided(play)).toBe(true);
    expect(shouldPlayClip(play, false)).toBe(true);
    const p = promptInstruction(play, { isRetry: false, clipPlayed: true, clipExpected: true }, () => 0);
    expect(p).toMatch(/tiny playful game with the sound "ah"/);
    expect(p).toMatch(/mouse voice/);
    expect(p).toMatch(/let the child join in/);
    expect(p).toMatch(/Do NOT call report_attempt/);
    expect(promptInstruction(play, { isRetry: false, clipPlayed: true, clipExpected: true }, () => 0.99)).toMatch(/clap/);
  });

  it("adds a game after every second new item, and only then", () => {
    const steps = buildSteps({ plan: { review: [], teach: ["v-a", "v-e", "v-i", "v-o"], mixed: [] } });
    expect(steps.filter((s) => s.stage === "play").map((s) => s.itemId)).toEqual(["v-e", "v-o"]);
  });
});

describe("prompt: only report after the child has spoken", () => {
  it("tells the model not to call the function while waiting", () => {
    const p = getReadingSystemPrompt("Amani");
    expect(p).toMatch(/ONLY AFTER you have actually heard the child speak/);
    expect(p).toMatch(/wait silently/);
  });
});

describe("greeting", () => {
  it("meets a friend first: no mention of lessons yet", () => {
    const g = greetingInstruction("Amani");
    expect(g).toMatch(/Amani/);
    expect(g).toMatch(/Do NOT mention lessons or reading yet/);
  });
});

import { stageCaption } from "@/lib/reading/captions";
import { friendFor, SOUND_FRIENDS } from "@/lib/reading/friends";

describe("learning-side captions", () => {
  it("tells the child what to do at each stage, in Swahili and English", () => {
    expect(stageCaption({ kind: "teach", stage: "model" }, "sw")).toBe("Sikiliza");
    expect(stageCaption({ kind: "teach", stage: "model" }, "en")).toBe("Listen");
    expect(stageCaption({ kind: "teach", stage: "together" }, "sw")).toBe("Semeni pamoja!");
    expect(stageCaption({ kind: "teach", stage: "play" }, "en")).toBe("Let's play!");
    expect(stageCaption({ kind: "teach", stage: "alone" }, "sw")).toBe("Zamu yako!");
    expect(stageCaption({ kind: "review" }, "en")).toBe("Your turn!");
    expect(stageCaption({ kind: "baseline" }, "sw")).toBe("Soma kwa sauti");
    expect(stageCaption(null, "sw")).toBe("");
  });
});

describe("sound friends", () => {
  it("gives the five vowels five different friends, always the same for the same sound", () => {
    const vowels = ["v-a", "v-e", "v-i", "v-o", "v-u"];
    expect(new Set(vowels.map(friendFor)).size).toBe(5);
    expect(friendFor("v-a")).toBe(friendFor("v-a"));
    vowels.forEach((v) => expect(SOUND_FRIENDS).toContain(friendFor(v)));
  });
  it("never fails on an unknown item", () => {
    expect(SOUND_FRIENDS).toContain(friendFor("nope"));
  });
});
