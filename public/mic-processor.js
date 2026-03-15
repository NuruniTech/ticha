/**
 * mic-processor.js — AudioWorkletProcessor for microphone input.
 *
 * Runs in the dedicated AudioWorklet thread (not the main thread), avoiding
 * the jank and audio glitches caused by the deprecated ScriptProcessorNode.
 *
 * Receives 128-sample blocks (render quantum) at whatever sample rate the
 * AudioContext was created with (16 kHz for Ticha's mic context).
 * Each block is copied and posted to the main thread for encoding + sending
 * to Gemini.
 */
class MicProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel && channel.length > 0) {
      // .slice() copies the data — the worklet's internal buffer gets reused
      // each render quantum so we must copy before posting.
      this.port.postMessage(channel.slice());
    }
    // Return true to keep the processor alive
    return true;
  }
}

registerProcessor("mic-processor", MicProcessor);
