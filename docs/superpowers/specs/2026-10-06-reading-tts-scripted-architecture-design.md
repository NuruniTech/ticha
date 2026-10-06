# Reading tutor: scripted-TTS voice architecture

**Date:** 2026-10-06
**Branch:** `fix/live-audio-pipeline`
**Status:** Approved by founder, ready to implement (starting with the Vowels category)

## Problem

Across two real device recordings this session, every quality issue in the reading
lesson traced back to the same root cause: Ticha's spoken lines are **improvised
live** by Gemini's native-audio Live model from an English stage-direction (e.g.
"praise the child warmly"), not spoken from a fixed script. Confirmed symptoms:

- Raw `[APP]` instruction text (in English) voiced aloud, with a stray `<ctrl46>`
  token, before the real reply
- "Let me check" said in English — not present anywhere in our prompts, almost
  certainly the model's own tool-call reasoning leaking into speech
- The five-vowel chant, which must say "a, e, i, o, u" in that exact order, came
  back as "a, i, u, o" — a vowel dropped, order scrambled
- A hallucinated Bengali word mid-Swahili-sentence (from an earlier session)

These are not prompt-wording bugs to patch one at a time. They are the predictable
cost of asking a creative, general-purpose voice model to freestyle a tightly
scripted children's lesson instead of simply speaking one. Google does not offer
fine-tuning for the Live API (confirmed — no fine-tuning capability exists for
Gemini's Live/native-audio models, and Google has no stated plans to add it), so
"train the model to comply" is not an available path. Amira's own architecture
(researched, not assumed) separates speech recognition, instructional reasoning,
and a mastery classifier into distinct purpose-built pieces rather than one
model improvising dialogue — this design follows that same separation.

## Goals

- Ticha's scripted lines (greeting, vowel intros, teaching lines, feedback,
  the chant, closing) are **exact, pre-written Swahili text**, reviewed by the
  founder, with no live paraphrasing possible.
- The child's spoken answers are still understood and judged by AI — that part
  already works well and stays.
- Open-ended moments (reacting to "what's your favourite animal") stay warm and
  responsive without going through the same pipeline that caused the leaks.
- Latency per turn stays reasonable — most lines play instantly (pre-generated),
  nothing regresses to multi-second dead air as a *default* experience.

## Non-goals (this pass)

- Visual/engagement features from the founder's reference script (mouth-shape
  animations, picture flashcards, tracing, a synced song, a badge ceremony) —
  a separate, later decision; this pass is the voice/dialogue architecture only.
- The Consonants category — ride the same pattern once Vowels is proven, not
  built in the same pass.
- The vocabulary tutor (non-reading game modes) — untouched; it keeps using
  Gemini Live as before. This change is scoped to reading mode only.

## Measured facts this design relies on

- Gemini's TTS model (`gemini-3.8-flash-tts`) supports Swahili (one of the 130
  languages on the full Flash TTS model; confirmed via Google's own docs).
- A live smoke test round-tripped a TTS-generated sentence back through
  transcription and the five-vowel sequence came back **word-perfect, in
  order** — the exact content the live model has twice gotten wrong.
- TTS generation for a short line takes **~3.2s**; one-shot transcription of a
  short answer takes **~1.7s** (both measured directly against the live API,
  not estimated). On-the-fly generation for *every* line would mean ~5s of dead
  air per turn — worse than today. This is why pre-generation is the default,
  not on-the-fly generation.

## Architecture

Three independent pieces replace the single Gemini Live conversational session:

### 1. Scripted narration (pre-generated, the default for almost everything)

Every fixed line — vowel intros, teaching lines, feedback templates, the
chant, the closing — is written as exact Swahili text, TTS-generated **once**
offline (same pipeline already built and proven tonight for the 160
pronunciation clips: generate → verify by independent transcription → human
ear on anything ambiguous → ship as a static file), and played at runtime with
zero generation latency, exactly like the existing recorded practice-item
clips. Variety (so repeated praise doesn't feel robotic) comes from writing
several pre-generated variants per feedback type and picking one at random —
the same pattern `PRAISES` already uses, just extended to actual audio files
instead of text handed to a live model.

### 2. Listening (one-shot, AI-judged, no live session)

The child's answer is captured exactly as today (client-side VAD detects
start/end of speech), then sent as a single audio clip to a one-shot
`generateContent` transcription call (~1.7s) — the same mechanism already
proven in tonight's pronunciation-verification pipeline. The conductor judges
the transcript exactly as it does now (`judgeHeard`, unchanged). No live
session, no function-calling, no coupling to a voice-generation pipeline —
which is precisely the pathway that caused every leak this session found.

### 3. Open-ended reactions (templated first, generation as fallback)

The few genuinely open moments (reacting to a favourite animal/food/colour)
are handled by simple keyword matching, not a model call: each of the three
`FUN_QUESTIONS` already has a bounded, predictable answer space for a young
child (common Swahili animal/food/colour words), so the transcribed answer is
matched against a known word list per question and paired with a warm
pre-written reaction template with the word spliced in, TTS'd once and cached
the first time that word is heard. Only an answer that matches no known word
falls back to a short text-only completion (fast, no audio generation, no
function-calling) whose resulting text is *then* TTS'd and cached for next
time — never spoken live.

## Content pipeline (script → audio file)

1. I draft every line in Swahili (adapting the founder's reference script +
   what already exists in `instructions.ts`).
2. Founder reviews/corrects wording (same role as reviewing the pronunciation
   clips).
3. A build script (parallel to tonight's `split_pipeline`) TTS-generates each
   line, verifies it by transcribing it back, and flags anything that doesn't
   round-trip cleanly for a listen before it ships.
4. Approved files land in `public/audio/reading-script/{id}.mp3` (new
   directory, parallel to the existing `public/audio/reading/` pronunciation
   clips) and a generated lookup table maps script-line IDs to files.

## Code changes

- `lib/reading/instructions.ts`: functions stop producing English
  stage-directions for a model to paraphrase. Each becomes a lookup into a
  fixed table of `{ audioFile, text, variants? }` for the current step —
  same inputs (`Step`, retry/clip state) as today, different output shape.
- `hooks/useReadingLesson.ts`: `send(text)` (push an instruction into a live
  model turn) is replaced by `speak(lineId)` (play a pre-generated file) and
  `listen()` (capture + one-shot transcribe the child's next utterance). The
  conductor (`conductor.ts`), mastery rules, check logic, and judge are
  **unchanged** — this is a swap of the voice layer underneath an already-
  correct lesson state machine, not a rewrite of the pedagogy engine.
- `components/VoiceSession.tsx`: the Gemini Live connection, roll/reconnect
  machinery, and system-prompt wiring for reading mode are removed; replaced
  with calls to the new speak/listen pair. The vocabulary tutor's Live
  session is untouched.
- A new `scripts/reading-narration/` pipeline (split/generate/verify) parallel
  to tonight's scratchpad tooling, promoted into the repo since it's now a
  repeatable, ongoing content process rather than a one-off.

## Testing

- `lib/reading/instructions.ts`'s new lookup-table functions get the same kind
  of pure-function tests already covering the old text-generating ones.
- A script-coverage test asserts every line ID the conductor can reach has a
  corresponding audio file before a deploy ships (catches a missing clip at
  build time, not in front of a child).
- Existing `conductor.ts`/`mastery.ts`/`checks.ts`/`judge.ts` tests are
  untouched — the pedagogy logic they protect does not change.

## Risks, named rather than hidden

- **Losing the live model's spontaneous warmth.** A fixed script, even with
  randomised variants, is less dynamically responsive than live generation.
  Mitigated by writing generous variant pools for anything repeated often
  (praise, retry framing) — but this is a real trade-off, not a free win.
- **Content review load.** Every line needs the founder's Swahili review
  before it ships, same as the pronunciation clips — more upfront review work
  than trusting a live model to "just handle it," in exchange for actually
  controlling what gets said.
- **Audio asset growth.** Vowels alone will need on the order of 30-60 short
  narration clips (several per step type × variants). Small in absolute size
  (the 160 pronunciation clips totalled 1.2MB), but it is a new content
  category to maintain alongside the pronunciation clips.
- **Name-dependent and reactive-fallback lines still pay the ~3s TTS latency.**
  Kept to the smallest possible set (greeting, maybe closing, uncached
  reaction fallback) rather than eliminated outright.
