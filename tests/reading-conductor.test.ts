import { describe, it, expect } from "vitest";
import { buildSteps, startConductor, applyVerdict, advanceGuided, currentStep, isGuided, MAX_TRIES, DISCONTINUE_AFTER, type ConductorState } from "@/lib/reading/conductor";
import { decideCheckForCategory } from "@/lib/reading/checks";
import { CHECK_FORMS, isKnownItemId, getItem as getItemTop } from "@/lib/reading/curriculum";
import { greetingInstruction, shouldPlayClip, promptInstruction, feedbackInstruction, nothingLeftInstruction, warmupInstructions, WARMUP_TURNS, PRAISES, VOWEL_SOUND } from "@/lib/reading/instructions";
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
  it("weaves review in ahead of each new sound instead of front-loading it, and marks first appearances", () => {
    const steps = buildSteps({ plan, check: { phase: "baseline", items: ["s-ba"] } });
    // review["v-a"] appears right before the FIRST new sound, not all review before all teaching;
    // each new item is taught in three stages: model, together, alone (+ play on the 2nd)
    expect(steps.map((s) => s.kind)).toEqual(["baseline", "review", "teach", "teach", "teach", "teach", "teach", "teach", "teach", "mixed", "mixed", "mixed"]);
    expect(steps.filter((s) => s.kind === "review").map((s) => s.itemId)).toEqual(["v-a"]);
    expect(steps.indexOf(steps.find((s) => s.kind === "review")!)).toBeLessThan(steps.indexOf(steps.find((s) => s.kind === "teach")!));
    expect(steps.filter((s) => s.kind === "teach").map((s) => `${s.itemId}:${s.stage}`)).toEqual([
      "v-e:model", "v-e:together", "v-e:alone", "v-i:model", "v-i:together", "v-i:alone", "v-i:play",
    ]);
    expect(steps.find((s) => s.itemId === "v-e" && s.stage === "model")!.first).toBe(true);
    expect(steps.find((s) => s.itemId === "v-e" && s.stage === "alone")!.first).toBe(false);
    expect(steps.find((s) => s.itemId === "v-e" && s.kind === "mixed")!.first).toBe(false);
  });

  it("spreads several review items across several new sounds, one ahead of each", () => {
    const manyPlan = { review: ["v-a", "v-o"], teach: ["v-e", "v-i"], mixed: [] };
    const steps = buildSteps({ plan: manyPlan });
    const order = steps.map((s) => (s.kind === "review" ? `review:${s.itemId}` : s.stage ? `${s.itemId}:${s.stage}` : s.kind));
    expect(order).toEqual([
      "review:v-a", "v-e:model", "v-e:together", "v-e:alone",
      "review:v-o", "v-i:model", "v-i:together", "v-i:alone", "v-i:play",
    ]);
  });

  it("appends any leftover review after the last new sound if there is more review than teaching", () => {
    const steps = buildSteps({ plan: { review: ["v-a", "v-o", "v-u"], teach: ["v-e"], mixed: [] } });
    expect(steps.filter((s) => s.kind === "review").map((s) => s.itemId)).toEqual(["v-a", "v-o", "v-u"]);
    expect(steps[0]).toMatchObject({ kind: "review", itemId: "v-a" });
    expect(steps.at(-1)).toMatchObject({ kind: "review", itemId: "v-u" });
  });

  it("still reviews plainly (all up front) when there is nothing new to teach", () => {
    const steps = buildSteps({ plan: { review: ["v-a", "v-o"], teach: [], mixed: ["v-a"] } });
    expect(steps.map((s) => s.kind)).toEqual(["review", "review", "mixed"]);
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

describe("decideCheckForCategory: consonants (reuses the curated forms, vowel entries dropped)", () => {
  const T0 = Date.parse("2026-10-01T09:00:00Z");
  const row = (item_id: string, phase: string, ms: number) => ({ item_id, outcome: "correct", phase, created_at: new Date(T0 + ms).toISOString() });
  const sessionsOfPractice = (n: number) => Array.from({ length: n }, (_, i) => row("s-ba", "practice", i * (SESSION_GAP_MS + 60_000)));
  const formA = CHECK_FORMS.A.filter((id) => getItemTop(id)!.kind !== "vowel");
  const formB = CHECK_FORMS.B.filter((id) => getItemTop(id)!.kind !== "vowel");

  it("drops the vowel entries from each curated form (vowels are proven mastered to even get here)", () => {
    expect(formA.every((id) => getItemTop(id)!.kind !== "vowel")).toBe(true);
    expect(formA.length).toBe(CHECK_FORMS.A.length - 2);
  });

  it("starts a new child on the baseline", () => {
    expect(decideCheckForCategory("consonants", [])).toEqual({ phase: "baseline", items: formA });
  });

  it("resumes a part-finished baseline with only the missing items", () => {
    const rows = formA.slice(0, 4).map((id) => row(id, "baseline", 0));
    expect(decideCheckForCategory("consonants", rows)!.items).toEqual(formA.slice(4));
  });

  it("does not repeat a finished baseline before any practice", () => {
    expect(decideCheckForCategory("consonants", formA.map((id) => row(id, "baseline", 0)))).toBeNull();
  });

  it("is not due until 5 practice sessions have passed", () => {
    expect(decideCheckForCategory("consonants", sessionsOfPractice(4))).toBeNull();
    expect(decideCheckForCategory("consonants", sessionsOfPractice(5))).toEqual({ phase: "checkpoint", items: formB });
  });

  it("is next due 5 sessions after a completed checkpoint", () => {
    const done = formB.map((id) => row(id, "checkpoint", 0));
    expect(decideCheckForCategory("consonants", [...sessionsOfPractice(9), ...done])).toBeNull();
    expect(decideCheckForCategory("consonants", [...sessionsOfPractice(10), ...done])!.phase).toBe("checkpoint");
  });

  it("resumes a part-finished checkpoint", () => {
    const partial = formB.slice(0, 3).map((id) => row(id, "checkpoint", 0));
    expect(decideCheckForCategory("consonants", [...sessionsOfPractice(5), ...partial])!.items).toEqual(formB.slice(3));
  });
});

describe("decideCheckForCategory: vowels (only 5 items — same set used before and after)", () => {
  const VOWEL_IDS = ["v-a", "v-e", "v-i", "v-o", "v-u"];
  const T0 = Date.parse("2026-10-01T09:00:00Z");
  const row = (item_id: string, phase: string, ms: number) => ({ item_id, outcome: "correct", phase, created_at: new Date(T0 + ms).toISOString() });

  it("baselines on all 5 vowels for a brand-new child", () => {
    expect(decideCheckForCategory("vowels", [])).toEqual({ phase: "baseline", items: VOWEL_IDS });
  });

  it("checkpoints on all 5 vowels again after 5 practice sessions", () => {
    const sessions = Array.from({ length: 5 }, (_, i) => row("v-a", "practice", i * (SESSION_GAP_MS + 60_000)));
    expect(decideCheckForCategory("vowels", sessions)).toEqual({ phase: "checkpoint", items: VOWEL_IDS });
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

  it("modelling says the real spelling (no fabricated respelling) and does not ask the child to answer or report", () => {
    const p = promptInstruction(model, { isRetry: false, clipPlayed: true, clipExpected: true });
    expect(p).toMatch(/blend them into "ba"/);
    expect(p).toMatch(/do not ask them to answer yet/);
    expect(p).not.toMatch(/report_attempt/); // not mentioned at all here — the standing prompt already covers it
    const word = promptInstruction({ ...model, itemId: "w-mama" }, { isRetry: false, clipPlayed: true, clipExpected: true });
    expect(word).toMatch(/Say each part slowly/);
    expect(word).toMatch(/whole word "mama"/);
    const vowel = promptInstruction({ ...model, itemId: "v-a" }, { isRetry: false, clipPlayed: true, clipExpected: true });
    expect(vowel).toMatch(/Say the vowel "a" once, slowly/);
  });

  it("saying together invites the child to join and is not scored", () => {
    const p = promptInstruction(together, { isRetry: false, clipPlayed: true, clipExpected: true });
    expect(p).toMatch(/invite them to say it with you/);
    expect(p).not.toMatch(/report_attempt/);
  });

  it("the alone step tells the child it is their turn", () => {
    const p = promptInstruction(alone, { isRetry: false, clipPlayed: false, clipExpected: false });
    expect(p).toMatch(/their turn to say it alone/);
  });

  it("forbids hinting during a check and stays silent about right/wrong", () => {
    const p = promptInstruction(check, { isRetry: false, clipPlayed: false, clipExpected: false });
    expect(p).toMatch(/do not say it or hint at it/);
    expect(feedbackInstruction(check, "incorrect", { action: "next", movedOn: false })).toMatch(/Do not say whether/);
  });

  it("welcomes each new part of the lesson aloud, but not on a retry", () => {
    const start = { ...model, phaseStart: true };
    expect(promptInstruction(start, { isRetry: false, clipPlayed: true, clipExpected: true })).toMatch(/new sound together/);
    expect(promptInstruction({ ...alone, phaseStart: true }, { isRetry: true, clipPlayed: true, clipExpected: true })).not.toMatch(/new sound together/);
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
    expect(t).toMatch(/Do not say whether/);
  });

  it("makes Ticha say the sound herself (the real spelling) only when a recording was expected but missing", () => {
    expect(promptInstruction(model, { isRetry: false, clipPlayed: false, clipExpected: true })).toMatch(/Say "ba" clearly yourself/);
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

import { CATEGORY_KINDS, isCategoryUnlocked, isCategoryMastered, isReadingCategory } from "@/lib/reading/categories";
import { planLesson } from "@/lib/reading/lesson";
import { READING_ITEMS, getItem } from "@/lib/reading/curriculum";

describe("reading categories (a child picks Vowels or Consonants, like a game topic)", () => {
  const mastered = (n = 0) => [
    { sessionId: "s1", outcome: "correct" as const, at: n + 1 },
    { sessionId: "s1", outcome: "correct" as const, at: n + 2 },
    { sessionId: "s2", outcome: "correct" as const, at: n + 3 },
  ];
  const allVowelsMastered = () => {
    const attempts: Record<string, ReturnType<typeof mastered>> = {};
    READING_ITEMS.filter((i) => i.kind === "vowel").forEach((i, idx) => { attempts[i.id] = mastered(idx * 10); });
    return attempts;
  };

  it("Vowels is always unlocked; Consonants is locked until every vowel is mastered", () => {
    expect(isCategoryUnlocked("vowels", {})).toBe(true);
    expect(isCategoryUnlocked("consonants", {})).toBe(false);
    expect(isCategoryUnlocked("consonants", allVowelsMastered())).toBe(true);
  });

  it("stays locked if even one vowel is still unmastered — a child one vowel short does not get syllables", () => {
    const attempts = allVowelsMastered();
    delete attempts["v-u"]; // one vowel never attempted
    expect(isCategoryUnlocked("consonants", attempts)).toBe(false);
  });

  it("limits the Vowels category to the five vowels only — nothing else, ever", () => {
    expect(CATEGORY_KINDS.vowels).toEqual(["vowel"]);
    const plan = planLesson({}, { kinds: CATEGORY_KINDS.vowels });
    expect(plan.teach).toEqual(["v-a", "v-e", "v-i", "v-o", "v-u"]);
  });

  it("never offers syllables or words inside the Vowels category, even once every vowel is mastered", () => {
    const plan = planLesson(allVowelsMastered(), { kinds: CATEGORY_KINDS.vowels });
    expect(plan.teach).toEqual([]);
    [...plan.review, ...plan.teach, ...plan.mixed].forEach((id) => expect(getItem(id)!.kind).toBe("vowel"));
  });

  // This is the exact bug a real test session found: by lesson 2, a child who had
  // only ONE attempt per vowel (not yet mastered) was already being taught brand
  // new syllables. The Consonants category's own `kinds` filter is irrelevant
  // here — THIS is the gate that must hold regardless of which category a lesson
  // asks to run, which is why isCategoryUnlocked exists as a separate check the
  // app enforces before it ever offers the Consonants tile.
  it("regression: a child with vowels merely attempted (not mastered) does not unlock Consonants", () => {
    const oneAttemptEach: Record<string, ReturnType<typeof mastered>> = {};
    READING_ITEMS.filter((i) => i.kind === "vowel").forEach((i) => { oneAttemptEach[i.id] = [{ sessionId: "s1", outcome: "correct", at: 1 }]; });
    expect(isCategoryUnlocked("consonants", oneAttemptEach)).toBe(false);
  });

  it("offers syllables inside Consonants once it is actually unlocked", () => {
    expect(planLesson(allVowelsMastered(), { kinds: CATEGORY_KINDS.consonants }).teach[0]).toBe("s-ba");
  });

  it("isCategoryMastered is true only once every item of that category's kinds is mastered", () => {
    expect(isCategoryMastered("vowels", {})).toBe(false);
    expect(isCategoryMastered("vowels", allVowelsMastered())).toBe(true);
  });

  it("isReadingCategory recognises only the real category ids", () => {
    expect(isReadingCategory("vowels")).toBe(true);
    expect(isReadingCategory("consonants")).toBe(true);
    expect(isReadingCategory("sentences")).toBe(false);
    expect(isReadingCategory("")).toBe(false);
  });
});

describe("empty lesson", () => {
  it("says goodbye with the closing word so the app can end the session", () => {
    expect(nothingLeftInstruction).toMatch(/tutaonana/);
  });
});

describe("pronunciation (real Swahili spelling, no fabricated respellings to read aloud)", () => {
  const model = { itemId: "v-e", kind: "teach" as const, stage: "model" as const, first: true, phaseStart: false };

  it("gives every vowel a clear Swahili sound, anchored to a real word, never a made-up spelling", () => {
    expect(Object.keys(VOWEL_SOUND).sort()).toEqual(["a", "e", "i", "o", "u"]);
    expect(VOWEL_SOUND.e).toMatch(/eh/);
    expect(VOWEL_SOUND.e).toMatch(/pesa/);
    expect(VOWEL_SOUND.e).toMatch(/never the English letter name/);
  });

  it("tells Ticha to say the REAL spelling, with a parenthetical pronunciation reminder — no invented word to read", () => {
    const p = promptInstruction(model, { isRetry: false, clipPlayed: true, clipExpected: true });
    expect(p).toMatch(/Say the vowel "e" once, slowly/);
    expect(p).toMatch(/\(Say "e" the Swahili way — "eh"/);
    expect(p).not.toMatch(/"eh"\)/); // no fabricated respelling anywhere, including the clip-play line
  });

  it("covers the vowels inside syllables and words too, always using the real spelling", () => {
    const syl = promptInstruction({ ...model, itemId: "s-me" }, { isRetry: false, clipPlayed: true, clipExpected: true });
    expect(syl).toMatch(/blend them into "me"/);
    expect(syl).toMatch(/"e" the Swahili way — "eh"/);
    const word = promptInstruction({ ...model, itemId: "w-nane" }, { isRetry: false, clipPlayed: true, clipExpected: true });
    expect(word).toMatch(/whole word "nane"/);
    expect(word).toMatch(/"a" the Swahili way — "ah"/);
  });

  it("puts the same rules in Ticha's standing prompt, without the old 'say this respelling' instruction", () => {
    const p = getReadingSystemPrompt("Amani");
    expect(p).toMatch(/NEVER said "ee"/);
    expect(p).not.toMatch(/say EXACTLY that/);
    expect(p).toMatch(/exactly as it is spelled/);
  });
});

describe("a less robotic lesson", () => {
  it("opens with a real three-exchange chat before any teaching", () => {
    const w = warmupInstructions(() => 0);
    expect(w).toHaveLength(WARMUP_TURNS);
    expect(w[0]).toMatch(/how they are feeling today/);
    expect(w[1]).toMatch(/React warmly to what they just said/);
    expect(w[1]).toMatch(/favourite animal/);
    expect(w[2]).toMatch(/sauti za kufurahisha/);
    expect(w[2]).toMatch(/ask if they are ready/);
    // Kept short: the standing prompt already says to stay silent until spoken to
    // and never call report_attempt outside a scored step, so these turns don't
    // repeat those rules — they just end by saying to listen.
    w.forEach((line) => expect(line).toMatch(/listen/));
    expect(w[0]).toMatch(/not a lesson yet/);
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
    expect(p).toMatch(/playful moment with "a"/);
    expect(p).toMatch(/mouse voice/);
    expect(p).toMatch(/let them join in/);
    expect(p).not.toMatch(/report_attempt/); // relies on the standing prompt; not repeated per turn
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
    expect(g).toMatch(/Do not mention lessons or reading yet/);
  });
});

describe("safe wording for fun sounds — never let the model translate it itself", () => {
  it("gives the exact safe Swahili phrase instead of asking the model to translate magic/fun", () => {
    const firstTeach = { itemId: "s-ba", kind: "teach" as const, stage: "model" as const, first: true, phaseStart: true };
    const teachIntro = promptInstruction(firstTeach, { isRetry: false, clipPlayed: true, clipExpected: true });
    const warmup3 = warmupInstructions(() => 0)[2];
    for (const text of [teachIntro, warmup3]) {
      expect(text).toMatch(/sauti za kufurahisha/);
      expect(text.toLowerCase()).not.toMatch(/magic/);
      expect(text.toLowerCase()).toMatch(/kichawi/); // named only to forbid it
      expect(text).toMatch(/never|do not|do NOT/i);
    }
  });

  it("also forbids the witchcraft word once, globally, in Ticha's standing prompt", () => {
    const p = getReadingSystemPrompt("Amani");
    expect(p).toMatch(/kichawi/);
    expect(p).toMatch(/witchcraft/i);
    expect(p).toMatch(/Never say the word "kichawi"/);
  });
});

describe("celebration close and a proud, specific goodbye", () => {
  it("frames the final mixed round as a celebration, not a drill", () => {
    const firstMixed = { itemId: "v-a", kind: "mixed" as const, first: false, phaseStart: true };
    const intro = promptInstruction(firstMixed, { isRetry: false, clipPlayed: false, clipExpected: false });
    expect(intro).toMatch(/celebration/);
  });

  it("names the sounds learned and says Ticha is proud of the child for each one", () => {
    const bye = feedbackInstruction({ itemId: "v-a", kind: "mixed", first: false, phaseStart: false }, "correct", { action: "end", movedOn: false }, ["a", "e", "i"]);
    expect(bye).toMatch(/proud of them/);
    expect(bye).toMatch(/a, e, i/);
    expect(bye).toMatch(/tutaonana/);
  });

  it("still says it is proud of the child even with nothing specific to list", () => {
    const bye = feedbackInstruction({ itemId: "v-a", kind: "mixed", first: false, phaseStart: false }, "correct", { action: "end", movedOn: false }, []);
    expect(bye).toMatch(/proud of them/);
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

import { VOWEL_ANCHORS, anchorFor } from "@/lib/reading/anchors";

describe("anchor words (isolate the sound, then anchor it in a real word)", () => {
  it("has a real, concrete anchor word for every vowel", () => {
    expect(Object.keys(VOWEL_ANCHORS).sort()).toEqual(["a", "e", "i", "o", "u"]);
    for (const v of Object.keys(VOWEL_ANCHORS)) {
      expect(VOWEL_ANCHORS[v].word[0]).toBe(v); // the anchor word genuinely starts with its vowel
      expect(VOWEL_ANCHORS[v].emoji.length).toBeGreaterThan(0);
    }
  });

  it("resolves an anchor only for vowel items, not syllables or words", () => {
    expect(anchorFor("v-a")!.word).toBe("asali");
    expect(anchorFor("s-ba")).toBeNull();
    expect(anchorFor("w-mama")).toBeNull();
  });

  it("mentions the anchor word while modelling a vowel, and says nothing extra for a syllable", () => {
    const model = { itemId: "v-a", kind: "teach" as const, stage: "model" as const, first: true, phaseStart: false };
    const p = promptInstruction(model, { isRetry: false, clipPlayed: true, clipExpected: true });
    expect(p).toMatch(/first sound in "asali"/);
    const syl = promptInstruction({ ...model, itemId: "s-ba" }, { isRetry: false, clipPlayed: true, clipExpected: true });
    expect(syl).not.toMatch(/first sound in/);
  });

  it("chants the five vowels in order to open the closing round of an all-vowels lesson, but not a mixed consonants round", () => {
    const firstMixedVowel = { itemId: "v-a", kind: "mixed" as const, first: false, phaseStart: true };
    const vowelChant = promptInstruction(firstMixedVowel, { isRetry: false, clipPlayed: false, clipExpected: false });
    expect(vowelChant).toMatch(/sing or chant the five vowels/);
    expect(vowelChant).toMatch(/a, e, i, o, u/);
    expect(vowelChant).toMatch(/celebration/); // still ends with the usual celebration framing

    const firstMixedConsonant = { itemId: "s-ba", kind: "mixed" as const, first: false, phaseStart: true };
    const consonantMixed = promptInstruction(firstMixedConsonant, { isRetry: false, clipPlayed: false, clipExpected: false });
    expect(consonantMixed).not.toMatch(/chant/);
    expect(consonantMixed).toMatch(/celebration/);
  });

  it("does not chant on a retry, even mid-way through an all-vowels mixed round", () => {
    const retry = { itemId: "v-a", kind: "mixed" as const, first: false, phaseStart: true };
    const p = promptInstruction(retry, { isRetry: true, clipPlayed: false, clipExpected: false });
    expect(p).not.toMatch(/chant/);
  });
});
