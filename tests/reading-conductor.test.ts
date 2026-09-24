import { describe, it, expect } from "vitest";
import { buildSteps, startConductor, applyVerdict, currentStep, MAX_TRIES, DISCONTINUE_AFTER } from "@/lib/reading/conductor";
import { decideCheck } from "@/lib/reading/checks";
import { CHECK_FORMS, isKnownItemId } from "@/lib/reading/curriculum";
import { shouldPlayClip, promptInstruction, feedbackInstruction } from "@/lib/reading/instructions";
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
    expect(steps.map((s) => s.kind)).toEqual(["baseline", "review", "teach", "teach", "mixed", "mixed", "mixed"]);
    expect(steps.find((s) => s.itemId === "v-e" && s.kind === "teach")!.first).toBe(true);
    expect(steps.find((s) => s.itemId === "v-e" && s.kind === "mixed")!.first).toBe(false);
  });
});

describe("conductor", () => {
  const run = (kinds: ("correct" | "incorrect" | "unscored")[], planIn = plan, check?: Parameters<typeof buildSteps>[0]["check"]) => {
    let s = startConductor(buildSteps({ plan: planIn, check }));
    const advances: string[] = [];
    for (const k of kinds) { const r = applyVerdict(s, k); s = r.state; advances.push(r.advance.action); }
    return { s, advances };
  };

  it("advances on a correct answer", () => {
    expect(run(["correct"]).advances).toEqual(["next"]);
  });

  it("retries a miss, then moves on after the maximum tries", () => {
    const { advances, s } = run(Array(MAX_TRIES).fill("incorrect"));
    expect(advances).toEqual(["retry", "retry", "next"]);
    expect(s.index).toBe(1);
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
    let s = startConductor(buildSteps({ plan }));
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
  const review = { itemId: "s-ba", kind: "review" as const, first: false, phaseStart: false };

  it("never plays the sound for a check, always for teaching, only on retry for review", () => {
    expect(shouldPlayClip(check, false)).toBe(false);
    expect(shouldPlayClip(teach, false)).toBe(true);
    expect(shouldPlayClip(review, false)).toBe(false);
    expect(shouldPlayClip(review, true)).toBe(true);
  });

  it("forbids hinting during a check and stays silent about right/wrong", () => {
    const p = promptInstruction(check, { isRetry: false, clipPlayed: false, clipExpected: false });
    expect(p).toMatch(/Do NOT say it/);
    expect(feedbackInstruction(check, "incorrect", { action: "next", movedOn: false })).toMatch(/Do NOT say whether/);
  });

  it("welcomes each new part of the lesson aloud, but not on a retry", () => {
    const start = { ...teach, phaseStart: true };
    expect(promptInstruction(start, { isRetry: false, clipPlayed: true, clipExpected: true })).toMatch(/learn something new/);
    expect(promptInstruction(start, { isRetry: true, clipPlayed: true, clipExpected: true })).not.toMatch(/learn something new/);
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
    expect(promptInstruction(teach, { isRetry: false, clipPlayed: false, clipExpected: true })).toMatch(/Say the sound "ba" clearly yourself/);
    expect(promptInstruction(teach, { isRetry: false, clipPlayed: true, clipExpected: true })).not.toMatch(/Say the sound/);
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
    expect(p.length).toBeLessThan(3000);
  });
});
