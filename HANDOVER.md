# Handover — Gemini Live latency investigation

**Date:** 23 September 2026
**Branch:** `fix/live-audio-pipeline` (10 commits ahead of `main`, all deployed to production)
**Status:** Root cause identified and measured. The fix is designed but **not built**.

---

## The problem

Ticha greets the child, answers a few turns, then takes 20+ seconds per reply or
stops replying entirely. Reported by three testers and reproduced by the founder
on a MacBook, an iPhone and a Samsung tablet, all on good US broadband.

**Critical context:** the app worked end-to-end ~2 months ago (lessons completed,
quiz after the session ran). There are **no commits between 4 July and 11
September 2026** — the app's own code did not change in the window where it broke.

---

## What is PROVEN (from on-device logs, not theory)

### 1. The stall is a turn-detection timeout, not model latency

`💬 REPLY STARTED after Xs` values from one MacBook session, default config:

```
20.3, 6.1, 20.4, 3.3, 24.0, 3.4, 74.9, 23.8, 20.0
```

Five of nine land between **20.0 and 24.0 s**. That tight a cluster is a timeout
firing, not variable inference time. Gemini is not thinking for 20 seconds — it is
waiting for the *child's* turn to end, failing to detect the end, and a server-side
cap eventually closes it.

The 3.3–6.1 s replies are what the app feels like when a turn closes cleanly. The
model is fast. Turn detection is what is broken.

### 2. No VAD sensitivity value fixes it

| profile | result |
|---|---|
| `START_SENSITIVITY_HIGH` (default) | room noise keeps the turn open → ~20 s timeout |
| `START_SENSITIVITY_LOW` (`?vad=low`) | child's speech never registers → **zero replies in 2+ min** |

Both fail for the same reason: the mic streams continuously and Google's VAD is
being asked to infer turn boundaries from an always-open mic in a real room.

### 3. The mic path is healthy

50 batches per ~5 s = 10/s × 96 ms = exactly realtime. Audio reaches Gemini
throughout every stall (mic counter climbs while zero audio comes back). The
silence is server-side.

### 4. Rolling the model back does not fix it

| model | gaps after turnComplete | audio delivery (`lead`) |
|---|---|---|
| `native-audio-preview-12-2025` (default) | 17 s, 65 s, 55 s+ | bursts: 3690, 5567, **9261 ms** |
| `native-audio-preview-09-2025` (`?model=prev`) | 45 s | trickles: 607, 87, 197, **50 ms** |

Both stall. **Stay on the pinned default** — a 50 ms lead is nearly starved and any
jitter underruns the playback queue, which is likely the "scratching" on the older
snapshot.

### 5. Only two Live models are reachable

Verified by waiting for the server's `setupComplete`, with a fake model name as a
control:

```
native-audio-preview-12-2025    VALID
native-audio-preview-09-2025    VALID
gemini-live-2.5-flash-preview   REJECTED 1008 not found
gemini-live-2.5-flash           REJECTED 1008 not found
gemini-2.0-flash-live-001       REJECTED 1008 not found
gemini-totally-fake-model-xyz   REJECTED 1008 not found   ← control
```

**Half-cascade is NOT available** while authenticating with ephemeral tokens.
⚠️ `onopen` fires for ANY model string — the socket opens before the server
validates the model. Socket-open proves nothing. Always wait for `setupComplete`.

---

## RULED OUT (do not re-investigate)

- **Echo / self-interruption.** Zero `⚡ Barge-in` events across multiple full
  sessions. Was my leading theory; the logs killed it.
- **Network.** Founder is on good US broadband; mic throughput is exactly realtime.
- **Mic batching.** Verified correct at 96 ms/batch.
- **Service worker.** Had a real `clone()` bug (fixed, `be9d26d`) but it never
  touched `/api/` and was caching nothing anyway.
- **Bandwidth/model alias as sole cause.** Alias was a genuine risk (now pinned) but
  rolling back the snapshot did not fix the stalls.

---

## THE RECOMMENDED FIX (designed, not built)

**Disable server-side VAD and drive turns from the client.**

```ts
realtimeInputConfig: {
  automaticActivityDetection: { disabled: true }
}
```

Then send explicit `activityStart` / `activityEnd` signals. **Both verified present
in the installed `@google/genai` SDK** (`genai.d.ts:11`, `:34`, `:6733`, `:6735`;
`AutomaticActivityDetection.disabled` at `:605-607`).

The app already has the plumbing from an earlier push-to-talk design:
`pttActiveRef`, `setPttActive` in `components/VoiceSession.tsx`.

**Why this and nothing else:** it removes the guessing entirely. A turn ends when
the app says it ends — no timeouts, no ambient-noise sensitivity tuning. It also
closes the mic while Ticha speaks, which removes the echo path as a bonus.

**Trade-off the founder has accepted in principle but not seen:** hands-free is
lost; the child taps to talk. For a 4-year-old that is worse pedagogy than
open-mic — but open-mic currently produces a 20 s wait or nothing. Hands-free can
return later via *client-side* energy VAD, where we own the thresholds.

**Suggested rollout:** build behind `?turn=manual` so one deploy confirms it on a
real device, then flip to default. The founder explicitly approved building it and
asked for it in the next deploy.

---

## Debug tooling built this session (all live)

Append to the session URL. Session URL already has params, so use `&`, not `?`.

| param | effect |
|---|---|
| `&debug=1` | on-screen log panel + console. **Sticky per device** (localStorage). `&debug=0` clears. |
| `&model=prev` | roll back to `native-audio-preview-09-2025`. Not sticky. |
| `&vad=low` | `START_SENSITIVITY_LOW` + 700 ms silence window. Not sticky. |

The panel pins model + VAD profile in a yellow header that cannot scroll away, keeps
150 lines, and has a **copy** button that includes the header.

Key log lines: `💬 REPLY STARTED after Xs of silence` is the metric that matters.
`🔊 audio chunk #N ... lead=Xms` is the playback backlog. `🎤 mic batches sent: N`
proves input is flowing.

---

## Still open, NOT yet addressed

1. **System prompt is 20,493 tokens** (animals 81,971 chars; colors 70,739). Two
   sections are 45% of it: `HOW TO TEACH ONE WORD` (5,743 tok) and `LESSON FLOW`
   (3,401 tok). Scanned for mechanical redundancy — only 344 wasted chars, so
   shrinking it means cutting real pedagogy. **That is the founder's call, not an
   agent's.** Google lists growing context as an aggravator for the native-audio
   truncation defect.
2. **Pronunciation** — `mbu` and `chui` rules added (`568af4f`), unverified by ear.
   The founder is a fluent Swahili speaker and can review directly.
3. **Playback resampling** — `playCtx` runs at system rate (48 kHz) while chunks are
   24 kHz AudioBuffers, so every chunk boundary is a resampler discontinuity
   (audible clicking). **Do NOT fix by constructing the context at 24 kHz** — that
   was tried and some Android builds accept it then output silence (`be9d26d`
   reverts it). Needs a stateful resampler on our side.
4. **Known Google defect** — [python-genai #2117](https://github.com/googleapis/python-genai/issues/2117):
   native-audio models end their own turn early, P2 for ~8 months, worsens as
   sessions progress, aggravated by non-English languages and growing context.
   Unresolved upstream. Ticha is Swahili with a 20k prompt.

---

## Gotchas that cost time — read before repeating

- **`timeout` does not exist on macOS.** `timeout 60 node script.mjs` fails with
  "command not found" and the script never runs. Several probes silently produced
  nothing because of this.
- **Deploy before testing.** Two test rounds were wasted running against builds that
  did not contain the change. Confirm from the debug header before trusting a log.
- **Do not ship unverified audio changes.** Two did real damage: the 24 kHz context
  silenced a tablet, and `?model=half` pointed at a model that does not exist.
  Verify on a device or with a control before committing.
- **Node probes:** pipe to a file, not `| tail` — tail buffers until EOF and you see
  nothing.

---

## Commits this session (oldest → newest)

```
166f140  Fix real-time audio pipeline: batch mic input, match playback rate
568af4f  Fix word selection and Swahili pronunciation rules
dca0f37  Raise the anonymous token limit above the reconnect ladder
be9d26d  Revert 24 kHz playback context; fix service worker clone bug
6fd74a3  Enable the debug log on deployed builds via ?debug=1
622bdeb  Make ?debug=1 sticky per device
0344c3f  Pin the Live model and add ?model=half to A/B the architecture
5937713  Correct the model switch: half-cascade is unavailable, offer 09-2025
db673e6  Make the debug panel readable: pin the model, measure reply latency
9c1a9ee  Add ?vad=low — the model rollback did not fix the stalls
```

Working tree clean. `npm run build`, `npx tsc --noEmit` and `npx vitest run`
(4 tests) all pass.

---

## Context on urgency

The founder is a solo non-technical founder preparing to test with real users and
tracking a Y Combinator RFS deadline. Time and token budget are real constraints.
**Converge on the manual-turn fix; do not restart the hypothesis sweep.** The 20 s
cluster is a measurement, and it points at one change.
