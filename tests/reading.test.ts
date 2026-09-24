import { describe, it, expect } from "vitest";
import { READING_ITEMS, getItem, isKnownItemId, VOWELS, CONSONANTS } from "@/lib/reading/curriculum";
import { itemState, isMastered, type Attempt } from "@/lib/reading/mastery";
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

  it("starts a brand-new child on the first three items, in order", () => {
    const plan = planLesson({});
    expect(plan.review).toEqual([]);
    expect(plan.teach).toEqual(READING_ITEMS.slice(0, 3).map((i) => i.id));
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
