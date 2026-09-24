import { describe, it, expect } from "vitest";
import { StreamResampler } from "@/lib/audio/resample";

const concat = (parts: Float32Array[]) => {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const signal = (n: number, f = 440, rate = 24000) => Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * f * i) / rate));

describe("StreamResampler", () => {
  it("doubles the sample count for 24 kHz -> 48 kHz (within one sample of the tail)", () => {
    const r = new StreamResampler(24000, 48000);
    const out = r.process(signal(2400));
    expect(Math.abs(out.length - 4800)).toBeLessThanOrEqual(2);
  });

  it("keeps a constant signal constant (no clicks or gain change)", () => {
    const r = new StreamResampler(24000, 48000);
    const out = concat([r.process(new Float32Array(500).fill(0.5)), r.process(new Float32Array(731).fill(0.5))]);
    for (const v of out) expect(v).toBeCloseTo(0.5, 6);
  });

  it("gives the same result however the stream is cut into chunks", () => {
    const whole = signal(6000);
    const all = new StreamResampler(24000, 48000).process(whole);

    const r = new StreamResampler(24000, 48000);
    const cuts = [1, 7, 480, 33, 1024, 2000, 2455]; // awkward sizes, sums to 6000
    let offset = 0;
    const parts: Float32Array[] = [];
    for (const c of cuts) { parts.push(r.process(whole.subarray(offset, offset + c))); offset += c; }
    const chunked = concat(parts);

    expect(offset).toBe(6000);
    const n = Math.min(all.length, chunked.length);
    expect(Math.abs(all.length - chunked.length)).toBeLessThanOrEqual(2);
    for (let i = 0; i < n; i++) expect(chunked[i]).toBeCloseTo(all[i], 5);
  });

  it("has no jump at a chunk boundary for a smooth signal", () => {
    const r = new StreamResampler(24000, 48000);
    const a = r.process(signal(480).subarray(0, 480));
    const b = r.process(Float32Array.from({ length: 480 }, (_, i) => Math.sin((2 * Math.PI * 440 * (480 + i)) / 24000)));
    const jump = Math.abs(b[0] - a[a.length - 1]);
    const typical = Math.abs(a[a.length - 1] - a[a.length - 2]);
    expect(jump).toBeLessThan(typical * 3 + 0.01);
  });

  it("works for non-integer ratios such as 24 kHz -> 44.1 kHz", () => {
    const out = new StreamResampler(24000, 44100).process(signal(2400));
    expect(Math.abs(out.length - 4410)).toBeLessThanOrEqual(2);
    for (const v of out) expect(Math.abs(v)).toBeLessThanOrEqual(1.0001);
  });
});
