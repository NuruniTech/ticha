import { describe, it, expect } from "vitest";
import { READING_ITEMS, getItem, isKnownItemId, VOWELS, CONSONANTS } from "@/lib/reading/curriculum";
import { itemState, isMastered, type Attempt } from "@/lib/reading/mastery";
import { judgeHeard } from "@/lib/reading/judge";
import { planLesson } from "@/lib/reading/lesson";

const a = (sessionId: string, outcome: Attempt["outcome"], at = 0): Attempt => ({ sessionId, outcome, at });

describe("curriculum", () => {
  it("has the v1 shape: 5 vowels, 8 consonants x 5 vowels, and words", () => {
    expect(READING_ITEMS.filter((i) => i.kind === "vowel")).toHaveLength(VOWELS.length);
    expect(READING_ITEMS.filter((i) => i.kind === "syllable")).toHaveLength(CONSONANTS.length * VOWELS.length);
    expect(READING_ITEMS.filter((i) => i.kind === "word").length).toBeGreaterThanOrEqual(15);
  });

  it("has unique ids and a contiguous step order", () => {
    const ids = READING_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    READING_ITEMS.forEach((item, idx) => expect(item.step).toBe(idx));
  });

  it("builds every word only from syllables the curriculum teaches", () => {
    for (const w of READING_ITEMS.filter((i) => i.kind === "word")) {
      expect(w.syllables.join("")).toBe(w.text);
      for (const s of w.syllables) expect(isKnownItemId(`s-${s}`) || isKnownItemId(`v-${s}`)).toBe(true);
    }
  });

  it("introduces every syllable of a word before the word itself", () => {
    for (const w of READING_ITEMS.filter((i) => i.kind === "word")) {
      for (const req of w.requires) expect(getItem(req)!.step).toBeLessThan(w.step);
    }
  });

  it("points each item at a predictable recording path", () => {
    expect(getItem("s-ba")!.audio).toBe("/audio/reading/s-ba.mp3");
  });
});

describe("mastery", () => {
  it("is unseen with no scored attempts, and ignores unscored ones", () => {
    expect(itemState([])).toBe("unseen");
    expect(itemState([a("s1", "unscored")])).toBe("unseen");
  });

  it("is learning after any scored attempt", () => {
    expect(itemState([a("s1", "incorrect")])).toBe("learning");
  });

  it("needs 3 correct across at least 2 sessions", () => {
    expect(isMastered([a("s1", "correct"), a("s1", "correct"), a("s1", "correct")])).toBe(false); // one session only
    expect(isMastered([a("s1", "correct"), a("s2", "correct")])).toBe(false);                      // too few
    expect(isMastered([a("s1", "correct"), a("s1", "correct"), a("s2", "correct")])).toBe(true);
  });

  it("is not undone by a later miss", () => {
    const attempts = [a("s1", "correct"), a("s1", "correct"), a("s2", "correct"), a("s3", "incorrect")];
    expect(itemState(attempts)).toBe("mastered");
  });
});

describe("planLesson", () => {
  const master = (id: string): Attempt[] => [a("s1", "correct", 1), a("s1", "correct", 2), a("s2", "correct", 3)];

  it("starts a brand-new child on the five vowels together, in order", () => {
    const plan = planLesson({});
    expect(plan.review).toEqual([]);
    expect(plan.teach).toEqual(["v-a", "v-e", "v-i", "v-o", "v-u"]);
  });

  it("teaches at most 3 new items once past the vowels", () => {
    const vowels: Record<string, Attempt[]> = {};
    for (const v of ["v-a", "v-e", "v-i", "v-o", "v-u"]) vowels[v] = master(v);
    expect(planLesson(vowels).teach).toEqual(["s-ba", "s-be", "s-bi"]);
  });

  it("reviews at most two mastered items, least recently seen first", () => {
    const attemptsByItem = {
      "v-a": [a("s1", "correct", 10), a("s1", "correct", 11), a("s2", "correct", 12)],
      "v-e": [a("s1", "correct", 1), a("s1", "correct", 2), a("s2", "correct", 3)],
      "v-i": [a("s1", "correct", 5), a("s1", "correct", 6), a("s2", "correct", 7)],
    };
    expect(planLesson(attemptsByItem).review).toEqual(["v-e", "v-i"]);
  });

  it("does not add new items while 6 or more are still being learned", () => {
    const learning: Record<string, Attempt[]> = {};
    READING_ITEMS.slice(0, 6).forEach((i) => { learning[i.id] = [a("s1", "incorrect", 1)]; });
    const plan = planLesson(learning);
    expect(plan.teach.every((id) => id in learning)).toBe(true); // practises, does not add
  });

  it("holds a word back until each of its syllables has 2 correct attempts", () => {
    const word = READING_ITEMS.find((i) => i.kind === "word")!;
    const partial: Record<string, Attempt[]> = {};
    for (const i of READING_ITEMS.filter((x) => x.step < word.step)) partial[i.id] = master(i.id);
    // Undo one requirement so it has only 1 correct
    partial[word.requires[0]] = [a("s1", "correct", 1)];
    expect(planLesson(partial).teach).not.toContain(word.id);
  });

  it("builds the mixed round from the teach and review items", () => {
    const plan = planLesson({});
    expect(new Set(plan.mixed)).toEqual(new Set([...plan.teach, ...plan.review]));
  });

  it("never returns an id outside the curriculum", () => {
    const plan = planLesson({ "zz-nope": [a("s1", "correct")] });
    [...plan.review, ...plan.teach, ...plan.mixed].forEach((id) => expect(isKnownItemId(id)).toBe(true));
  });
});

import { parseAttempt } from "@/lib/reading/validate";

describe("parseAttempt", () => {
  const good = { childId: "c1", sessionId: "s1", itemId: "s-ba", outcome: "correct" };

  it("accepts a valid attempt and defaults the phase to practice", () => {
    const r = parseAttempt(good);
    expect(r.ok && r.value.phase).toBe("practice");
  });

  it("rejects items that are not in the curriculum", () => {
    expect(parseAttempt({ ...good, itemId: "s-zz" }).ok).toBe(false);
  });

  it("rejects bad outcomes, phases and non-objects", () => {
    expect(parseAttempt({ ...good, outcome: "great" }).ok).toBe(false);
    expect(parseAttempt({ ...good, phase: "exam" }).ok).toBe(false);
    expect(parseAttempt(null).ok).toBe(false);
    expect(parseAttempt("x").ok).toBe(false);
  });

  it("rejects missing or oversized ids", () => {
    expect(parseAttempt({ ...good, childId: "" }).ok).toBe(false);
    expect(parseAttempt({ ...good, sessionId: "x".repeat(65) }).ok).toBe(false);
  });

  it("drops absurd latencies instead of storing them", () => {
    const r = parseAttempt({ ...good, latencyMs: 9_999_999 });
    expect(r.ok && r.value.latencyMs).toBeNull();
    const ok = parseAttempt({ ...good, latencyMs: 1234.6 });
    expect(ok.ok && ok.value.latencyMs).toBe(1235);
  });
});

import { resolvePhase, countServerSessions, BASELINE_ITEMS, MIN_PRACTICE_SESSIONS_FOR_CHECK, SESSION_GAP_MS } from "@/lib/reading/validate";

describe("resolvePhase (server decides the phase)", () => {
  const T0 = Date.parse("2026-10-01T09:00:00Z");
  const at = (ms: number) => new Date(T0 + ms).toISOString();
  // n practice sessions, each one attempt, separated by more than the session gap
  const practiceSessions = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ phase: "practice", created_at: at(i * (SESSION_GAP_MS + 60_000)) }));

  it("always allows practice", () => {
    expect(resolvePhase("practice", [])).toBe("practice");
  });

  it("allows baseline only before any practice, and only for the first items", () => {
    expect(resolvePhase("baseline", [])).toBe("baseline");
    expect(resolvePhase("baseline", practiceSessions(1))).toBe("practice");
    const full = Array.from({ length: BASELINE_ITEMS }, () => ({ phase: "baseline", created_at: at(0) }));
    expect(resolvePhase("baseline", full)).toBe("practice");
  });

  it("refuses checkpoint and final until enough real sessions exist", () => {
    expect(resolvePhase("checkpoint", [])).toBe("practice");
    expect(resolvePhase("final", practiceSessions(MIN_PRACTICE_SESSIONS_FOR_CHECK - 1))).toBe("practice");
    expect(resolvePhase("checkpoint", practiceSessions(MIN_PRACTICE_SESSIONS_FOR_CHECK))).toBe("checkpoint");
  });

  it("cannot be unlocked by many attempts in one sitting", () => {
    const burst = Array.from({ length: 200 }, (_, i) => ({ phase: "practice", created_at: at(i * 1000) }));
    expect(resolvePhase("final", burst)).toBe("practice");
  });
});

describe("countServerSessions", () => {
  it("counts a new session after a 30 minute gap, from server timestamps", () => {
    const t = Date.parse("2026-10-01T09:00:00Z");
    const rows = [0, 60_000, SESSION_GAP_MS + 120_000, SESSION_GAP_MS + 180_000, 3 * SESSION_GAP_MS]
      .map((ms) => ({ phase: "practice", created_at: new Date(t + ms).toISOString() }));
    expect(countServerSessions(rows)).toBe(3);
    expect(countServerSessions([])).toBe(0);
  });
});

describe("judgeHeard accepts the respelled pronunciation Ticha is told to use", () => {
  it("does not mark a correctly respelled vowel wrong (the bug: 'eh' for target 'e')", () => {
    expect(judgeHeard("v-e", "eh")).toBe("correct");
    expect(judgeHeard("v-a", "ah")).toBe("correct");
    expect(judgeHeard("v-o", "oh")).toBe("correct");
  });
  it("still accepts the raw spelling too", () => {
    expect(judgeHeard("v-e", "e")).toBe("correct");
  });
  it("accepts a respelled syllable and word", () => {
    expect(judgeHeard("s-me", "meh")).toBe("correct");
    expect(judgeHeard("w-soma", "soh-mah")).toBe("correct");
    expect(judgeHeard("w-soma", "sohmah")).toBe("correct");
  });
  it("still rejects a genuinely different sound", () => {
    expect(judgeHeard("v-e", "oh")).toBe("incorrect");
    expect(judgeHeard("s-ba", "pah")).toBe("incorrect");
  });
});
