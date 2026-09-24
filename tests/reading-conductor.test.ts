import { describe, it, expect } from "vitest";
import { buildSteps, startConductor, applyVerdict, currentStep, MAX_TRIES } from "@/lib/reading/conductor";
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
  const check = { itemId: "s-ba", kind: "baseline" as const, first: true };
  const teach = { itemId: "s-ba", kind: "teach" as const, first: true };
  const review = { itemId: "s-ba", kind: "review" as const, first: false };

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

  it("makes Ticha say the sound herself only when a recording was expected but missing", () => {
    expect(promptInstruction(teach, { isRetry: false, clipPlayed: false, clipExpected: true })).toMatch(/say the sound "ba"/);
    expect(promptInstruction(teach, { isRetry: false, clipPlayed: true, clipExpected: true })).not.toMatch(/say the sound/);
  });

  it("asks for the goodbye word at the end so the app can close the lesson", () => {
    expect(feedbackInstruction(teach, "correct", { action: "end", movedOn: false })).toMatch(/tutaonana/);
  });
});
