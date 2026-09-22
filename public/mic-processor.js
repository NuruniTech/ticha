/**
 * mic-processor.js — AudioWorkletProcessor for microphone input.
 *
 * Runs in the dedicated AudioWorklet thread (not the main thread), avoiding
 * the jank and audio glitches caused by the deprecated ScriptProcessorNode.
 *
 * Receives 128-sample blocks (render quantum) at whatever sample rate the
 * AudioContext was created with (16 kHz for Ticha's mic context).
 *
 * Blocks are ACCUMULATED here and posted in ~96 ms batches rather than one
 * message per render quantum. At 16 kHz a 128-sample quantum is only 8 ms, so
 * posting every block meant 125 messages/second, each of which the main thread
 * had to base64-encode and push through the WebSocket as its own
 * sendRealtimeInput call. That was enough main-thread work to starve audio
 * scheduling on mid-range phones and tablets — the "scratching", stalling and
 * pausing reported on Samsung/iPhone — and it floods the socket for no benefit.
 * Google's Live API guidance is ~100 ms chunks.
 *
 * 1536 = 12 render quanta exactly, so no partial-block bookkeeping is needed.
 */
const BATCH_SAMPLES = 1536; // 96 ms @ 16 kHz

class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = new Float32Array(BATCH_SAMPLES);
    this._filled = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel && channel.length > 0) {
      let offset = 0;
      while (offset < channel.length) {
        const room = BATCH_SAMPLES - this._filled;
        const take = Math.min(room, channel.length - offset);
        this._buf.set(channel.subarray(offset, offset + take), this._filled);
        this._filled += take;
        offset += take;

        if (this._filled === BATCH_SAMPLES) {
          // Post a copy — this._buf is reused for the next batch.
          this.port.postMessage(this._buf.slice());
          this._filled = 0;
        }
      }
    }
    // Return true to keep the processor alive
    return true;
  }
}

registerProcessor("mic-processor", MicProcessor);
