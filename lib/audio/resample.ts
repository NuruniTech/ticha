// Continuous (stateful) linear resampler for streamed audio.
//
// Gemini sends Ticha's voice as many small 24 kHz chunks, but most devices play at
// 44.1/48 kHz. If each chunk is handed to the browser as its own 24 kHz AudioBuffer,
// the browser resamples every chunk in isolation, and the edge of each chunk is
// wrong — an audible click ("scratching") at every join. Here the position and the
// unfinished tail carry over from one chunk to the next, so the output is the same
// as if the whole stream had been resampled at once.
//
// (Do NOT solve this by creating the playback AudioContext at 24 kHz: some Android
// builds accept it and then play silence. See HANDOVER.md.)

export class StreamResampler {
  private tail = new Float32Array(0);
  private pos = 0; // position of the next output sample, in input samples, relative to `tail`
  private readonly step: number;

  constructor(inRate: number, outRate: number) {
    this.step = inRate / outRate;
  }

  process(chunk: Float32Array): Float32Array<ArrayBuffer> {
    const buf = new Float32Array(this.tail.length + chunk.length);
    buf.set(this.tail, 0);
    buf.set(chunk, this.tail.length);

    const out: number[] = [];
    let p = this.pos;
    while (p + 1 < buf.length) {
      const i = Math.floor(p);
      const frac = p - i;
      out.push(buf[i] * (1 - frac) + buf[i + 1] * frac);
      p += this.step;
    }

    const keep = Math.min(Math.floor(p), buf.length);
    this.tail = buf.slice(keep);
    this.pos = p - keep;
    const result = new Float32Array(new ArrayBuffer(out.length * 4));
    result.set(out);
    return result;
  }
}
