import { describe, it, expect } from "vitest";
import { allFixedEntries, GREETING, LESSON_END, VOWELS, teachModel, togetherCount, WARMUP_ANIMAL_WORDS, WARMUP_FOOD_WORDS, WARMUP_COLOUR_WORDS, resolveLineText, matchFeelingReaction, matchFunWord } from "@/lib/reading/scripts";

describe("scripted lines: well-formed before spending TTS generation on them", () => {
  it("has no duplicate ids", () => {
    const ids = allFixedEntries().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no empty or placeholder-left-in text", () => {
    for (const e of allFixedEntries()) {
      expect(e.text.trim().length).toBeGreaterThan(0);
      expect(e.text).not.toMatch(/\{.*\}/); // {name} etc. must never leak into a FIXED (pre-cached) line
    }
  });

  it("name-dependent lines actually substitute the name", () => {
    expect(GREETING("Neema")).toMatch(/Neema/);
    expect(GREETING("Neema")).not.toMatch(/\{name\}/);
    expect(LESSON_END("Neema")).toMatch(/Neema/);
  });

  it("has a model line and a counted together line for all five vowels, each mentioning that vowel's sound", () => {
    for (const v of VOWELS) {
      expect(teachModel(v).text).toMatch(new RegExp(v));
      expect(togetherCount(v).text).toMatch(new RegExp(v));
      expect(togetherCount(v).text).toMatch(/moja, mbili, tatu/i); // the count-in is always there
    }
  });

  it("warmup reaction word lists have no accidental overlap across categories", () => {
    const all = [...WARMUP_ANIMAL_WORDS, ...WARMUP_FOOD_WORDS, ...WARMUP_COLOUR_WORDS];
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("resolveLineText: the one place an id turns into words (pipeline + API route both use it)", () => {
  it("resolves every fixed id to its exact text", () => {
    for (const e of allFixedEntries()) expect(resolveLineText(e.id)).toBe(e.text);
  });

  it("resolves name-dependent ids only when given a name, never guesses one", () => {
    expect(resolveLineText("greeting", { name: "Neema" })).toBe(GREETING("Neema"));
    expect(resolveLineText("lesson_end", { name: "Neema" })).toBe(LESSON_END("Neema"));
    expect(resolveLineText("greeting")).toBeNull();
    expect(resolveLineText("lesson_end")).toBeNull();
  });

  it("resolves the reaction-word template only when given a word", () => {
    expect(resolveLineText("warmup_q_reaction_word", { word: "simba" })).toMatch(/simba/);
    expect(resolveLineText("warmup_q_reaction_word")).toBeNull();
  });

  it("returns null for an unknown id rather than silently falling back", () => {
    expect(resolveLineText("not_a_real_id")).toBeNull();
  });
});

describe("matching a child's warmup answer to a scripted reaction", () => {
  it("matches a feeling word to its reaction group, case-insensitively", () => {
    expect(matchFeelingReaction("Nzuri sana")?.groupId).toBe("feeling_positive");
    expect(matchFeelingReaction("nimechoka kidogo")?.groupId).toBe("feeling_tired");
    expect(matchFeelingReaction("blah blah")).toBeNull();
  });

  it("matches a fun-question answer to a known word in the right category only", () => {
    expect(matchFunWord("animal", "ni simba")).toBe("simba");
    expect(matchFunWord("food", "ni simba")).toBeNull(); // right word, wrong category
    expect(matchFunWord("colour", "nyekundu")).toBe("nyekundu");
  });
});
