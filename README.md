<div align="center">

# Ticha — AI Voice Language Tutor for African Children

**Google Gemini Live Agent Challenge 2026**

Ticha is a real-time AI voice companion that teaches children to speak **Swahili ↔ English** through natural conversation — no reading, no typing, just talk.

</div>

---

## What is Ticha?

Ticha ("teacher" in Swahili) is an AI-powered language tutor built specifically for African children. A child simply presses a button and starts talking — Ticha listens, responds, celebrates progress, and guides them through a structured vocabulary lesson entirely by voice.

The app supports two learning directions:
- **English speaker learning Swahili** — Ticha speaks English, teaches Swahili words
- **Swahili speaker learning English** — Ticha speaks Swahili, teaches English words

Topics include **Animals, Colors, Numbers, Body Parts, and People**.

---

## Live Demo

🌐 **[ticha.app](https://ticha.app)**

---

## How Gemini Live API Powers Ticha

Ticha is built on **Gemini 2.5 Flash Live Audio** (`gemini-2.5-flash-native-audio-latest`) for real-time, bidirectional voice streaming.

| Feature | Implementation |
|---------|---------------|
| Real-time voice conversation | `@google/genai` `client.live.connect()` WebSocket session |
| Microphone capture | `AudioWorklet` (`MicProcessor`) at 16 kHz, zero main-thread jitter |
| Audio playback | Dual `AudioContext` — one for capture (16 kHz), one for playback (24 kHz). Gapless via `AudioBufferSourceNode` queue |
| Voice Activity Detection | Gemini's built-in VAD — `realtimeInputConfig.automaticActivityDetection` |
| Barge-in / interruption | Mic always open — child can speak mid-sentence; queued audio cancelled instantly |
| Structured lesson | ~12 KB system prompt encodes a 5-step CEFR A1 lesson with 3 exchanges per word |
| Bilingual teaching | Language direction selected per child profile; trigger phrase and hooks adapt automatically |
| Session auto-end | `"Tutaonana"` phrase in Ticha's transcript signals lesson complete → quiz transition |
| Session persistence | Supabase stores transcript, XP earned, words practiced, and duration |

**Core session loop:**

1. Parent sets up a child profile (name, age, learning direction)
2. Child chooses a topic and taps the mic button
3. Ticha greets them by name (Step 1 — warm-up question)
4. Transition into 5 vocabulary words — 3 exchanges each:
   - Exchange 1: vivid hook + connecting question
   - Exchange 2: syllable breakdown + repetition drill
   - Exchange 3: personal lock-in question (binary for young children)
5. Review game: rapid-fire recall of all 5 words
6. Goodbye: Ticha celebrates, announces the quiz
7. Picture quiz: 5-question matching game, XP awarded, session saved

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, TypeScript) |
| AI | Google Gemini 2.5 Flash Live Audio API (`@google/genai`) |
| Auth & DB | Supabase (Auth + PostgreSQL with RLS + Google OAuth) |
| Styling | CSS-in-JS inline styles + globals.css animations |
| Deployment | Vercel |

---

## Features

### For Children
- 🎙️ **Voice-only UI** — no reading or typing required; ideal for pre-literate children
- 🦁 **5 topic categories** — Animals, Colors, Numbers, Body Parts, People
- 🌍 **Swahili ↔ English** — both directions supported
- ⭐ **Gamified progress** — XP, streaks, star ratings, and level titles (Mwanafunzi → Msomi → Hodari → Bingwa)
- 🎮 **Picture quiz** after every session
- 🎨 **Animated Ticha avatar** — live lip sync, eye blink, head bob (custom SVG, no image assets)
- 🌳 **Adaptive difficulty** — word selection and teaching style adjust per child's XP and age

### For Parents
- 👨‍👩‍👧 **Parent dashboard** — add multiple child profiles with individual settings
- 📊 **Progress screen** — session history, XP earned, words practiced
- 🔐 **Google OAuth or email/password** signup

### Accessibility
- 🐢 **Slow Speech Mode** — Ticha speaks at half pace for young beginners
- 👁️ **Visual Mode** — for deaf/hard-of-hearing learners; emoji animations replace audio feedback
- ⬛ **High Contrast theme** — maximum contrast for low vision
- 👁️‍🗨️ **Colorblind-safe theme** — optimised colour palette
- ✋ **Reduce Motion** — all CSS animations disabled
- 🗣️ **Voice selection** — Aoede or Kore (both female voices)

---

## Local Setup

### Prerequisites

- Node.js 20+
- A [Google AI Studio](https://aistudio.google.com) API key with Gemini Live access
- A [Supabase](https://supabase.com) project

### 1. Clone and install

```bash
git clone https://github.com/NuruniTech/ticha.git
cd ticha
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 3. Set up the Supabase database

In the Supabase dashboard, open the **SQL Editor** and run the contents of [`lib/schema.sql`](lib/schema.sql).

This creates four tables with Row Level Security:
- `profiles` — parent accounts (auto-created on signup via trigger)
- `children` — child profiles linked to parents
- `sessions` — voice lesson history
- `progress` — per-word spaced repetition data

### 4. Configure Supabase Auth

In Supabase → Authentication → URL Configuration:
- **Site URL:** `https://ticha.app` (or your Vercel URL)
- **Redirect URLs:** add `https://ticha.app/auth/callback`

For local dev, also add `http://localhost:3000/auth/callback`.

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

> **Microphone access is required.** The browser will prompt for permission when you start a session. Use Chrome or Edge for best AudioWorklet support.

---

## Project Structure

```
ticha/
├── app/
│   ├── page.tsx              # Landing page
│   ├── login/page.tsx        # Login (email + Google OAuth)
│   ├── signup/page.tsx       # Parent signup
│   ├── dashboard/page.tsx    # Parent dashboard (child management)
│   ├── child/[id]/page.tsx   # Child home (stats, topic picker, word games)
│   ├── session/page.tsx      # Voice session page (hosts VoiceSession)
│   ├── progress/[id]/page.tsx # Progress & history view
│   ├── settings/page.tsx     # Accessibility + voice settings
│   └── auth/callback/page.tsx # Supabase OAuth callback
├── components/
│   ├── VoiceSession.tsx      # Core AI voice session — Gemini Live, audio pipeline, state machine
│   ├── TichaAvatar.tsx       # Animated SVG avatar (lip sync, eye blink, head bob)
│   └── QuizOverlay.tsx       # Post-session picture-matching quiz
├── context/
│   └── AccessibilityContext.tsx # Global settings (theme, voice, slow speech, etc.)
├── lib/
│   ├── supabase.ts           # Supabase browser client
│   └── schema.sql            # Database schema (run once in Supabase)
├── public/
│   ├── mic-processor.js      # AudioWorklet processor (16 kHz mic capture)
│   └── images/               # Logo and character images
└── types/
    └── index.ts              # Shared TypeScript interfaces
```

---

## How the Voice Pipeline Works

```
Browser mic → AudioWorklet (mic-processor.js, 16 kHz)
           → Float32 PCM chunks → encoded to base64 Int16
           → Gemini Live WebSocket (sendRealtimeInput)
           → Gemini streams audio back (base64 PCM, 24 kHz)
           → AudioBufferSourceNode queue → speaker (gapless)
```

- The `AudioWorklet` runs on a dedicated thread — no main-thread jitter or dropped frames
- Gemini's VAD detects when the child stops speaking and triggers a response automatically
- Audio output is queued as `AudioBufferSourceNode` chains so playback is seamless across many small chunks
- On barge-in: all queued nodes are cancelled instantly so Ticha stops and listens

---

## Lesson Design

The system prompt (~12 KB) encodes a research-backed 5-step lesson structure:

| Step | Purpose |
|------|---------|
| 1 — Greeting | Welcome by name, one warm-up question |
| 2 — Transition | Bridge from child's answer into Word 1 |
| 3 — Teach 5 words | 3 exchanges per word: hook → say it → lock it in |
| 4 — Review game | Rapid-fire recall of all 5 words |
| 5 — Goodbye | Celebrate, announce quiz, say tutaonana |

Lesson level adapts per child XP and age:
- **Level 1 (0–99 XP):** 5 foundational words
- **Level 2 (100–299 XP):** next 5 words per category
- **Levels 3–4 (300+ XP):** random selection + mastery mode (no translation given — child must recall)

---

## Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

Add the three environment variables in your Vercel project settings, then deploy.

---

## Built for the Gemini Live Agent Challenge

Ticha demonstrates Gemini Live's ability to power deeply personalised, low-latency voice agents for real-world educational impact. The challenge: build something where real-time voice is not just a feature, but the entire product.

For 200 million Swahili speakers — and the diaspora children growing up between two worlds — Ticha is that product.

---

*Built with the Google Gemini Live Audio API · Next.js · Supabase*
*© Grow Wise Africa · Built by Nuruni Tech*
