// Game sound effects + haptics — synthesized with WebAudio so there are no
// audio assets to load (important on slow connections). Every call is a
// no-op when the "Game Sounds" setting is off, during SSR, or if audio is
// unavailable.
//
// Deliberately NOT used inside VoiceSession: the mic is open during voice
// lessons and UI chimes would leak into the conversation and fight the
// echo canceller.

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch { return null; }
}

function isEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const s = JSON.parse(localStorage.getItem("ticha_settings") || "{}");
    return s.soundEffects !== false; // default ON when unset
  } catch { return true; }
}

// One enveloped oscillator note. All times relative to "now + at".
function note(
  freq: number, at: number, dur: number,
  type: OscillatorType = "sine", peak = 0.12, glideTo?: number,
) {
  const ac = audioCtx();
  if (!ac) return;
  const t0 = ac.currentTime + at;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function buzz(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch { /* unsupported */ }
}

export const sfx = {
  // Soft click when selecting a tile / flipping a card
  tap() {
    if (!isEnabled()) return;
    note(620, 0, 0.06, "sine", 0.06);
  },

  // Rising major arpeggio — correct answer
  correct() {
    if (!isEnabled()) return;
    note(523.25, 0.00, 0.14, "triangle", 0.12); // C5
    note(659.25, 0.09, 0.14, "triangle", 0.12); // E5
    note(783.99, 0.18, 0.22, "triangle", 0.12); // G5
    buzz(25);
  },

  // Gentle low double-thud — wrong answer (never harsh: young kids)
  wrong() {
    if (!isEnabled()) return;
    note(196, 0.00, 0.16, "sine", 0.10, 150);
    note(147, 0.14, 0.22, "sine", 0.10, 120);
    buzz([50, 40, 50]);
  },

  // Sparkling upward gliss — combo streak
  combo() {
    if (!isEnabled()) return;
    note(440, 0, 0.28, "sawtooth", 0.05, 1760);
    note(1318.5, 0.20, 0.18, "sine", 0.09); // E6 sparkle on top
    buzz([20, 20, 20]);
  },

  // Descending boop — time ran out
  timeout() {
    if (!isEnabled()) return;
    note(520, 0, 0.30, "sine", 0.10, 220);
    buzz(60);
  },

  // Little fanfare — all games cleared
  complete() {
    if (!isEnabled()) return;
    note(523.25, 0.00, 0.16, "triangle", 0.12); // C5
    note(659.25, 0.12, 0.16, "triangle", 0.12); // E5
    note(783.99, 0.24, 0.16, "triangle", 0.12); // G5
    note(1046.5, 0.36, 0.42, "triangle", 0.13); // C6
    buzz([30, 30, 30, 30, 80]);
  },

  // Soft descending pair — out of lives (sympathetic, not punishing)
  gameover() {
    if (!isEnabled()) return;
    note(392, 0.00, 0.30, "sine", 0.09, 330);
    note(294, 0.24, 0.42, "sine", 0.09, 262);
    buzz(80);
  },
};
