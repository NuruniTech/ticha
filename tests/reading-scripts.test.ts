import { describe, it, expect } from "vitest";
import { allFixedEntries, GREETING, LESSON_END, VOWELS, teachModel, teachTogether, WARMUP_ANIMAL_WORDS, WARMUP_FOOD_WORDS, WARMUP_COLOUR_WORDS } from "@/lib/reading/scripts";

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

  it("has a model and together line for all five vowels, each mentioning that vowel's anchor sound", () => {
    for (const v of VOWELS) {
      expect(teachModel(v).text).toMatch(new RegExp(v));
      expect(teachTogether(v).text).toMatch(new RegExp(v));
    }
  });

  it("warmup reaction word lists have no accidental overlap across categories", () => {
    const all = [...WARMUP_ANIMAL_WORDS, ...WARMUP_FOOD_WORDS, ...WARMUP_COLOUR_WORDS];
    expect(new Set(all).size).toBe(all.length);
  });
});
