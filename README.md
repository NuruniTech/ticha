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

Topics include Animals, Colors, Numbers, Body Parts, and People (greetings).

---

## How Gemini Live API Powers Ticha

Ticha is built on **Gemini 2.5 Flash Live Audio** (`gemini-2.5-flash-native-audio-latest`) for real-time, bidirectional voice streaming.

| Feature | Implementation |
|---------|---------------|
| Real-time voice conversation | `@google/genai` `client.live.connect()` WebSocket session |
| Microphone capture | `AudioWorklet` (`MicProcessor`) at 16 kHz, zero main-thread jitter |
| Audio playback | Dual `AudioContext` — one for capture (16 kHz), one for playback (24 kHz). Gapless via `AudioBufferSourceNode` queue |
| Voice Activity Detection | Gemini's built-in VAD — `realtimeInputConfig.automaticActivityDetection` |
| Structured lesson | System prompt encodes a 3-exchange CEFR A1 lesson per topic per session |
| Bilingual teaching | Language direction selected per child profile; trigger phrase and hooks adapt automatically |
| Session persistence | Supabase stores transcript, XP earned, words practiced, and duration |

**Core session loop:**

1. Parent sets up a child profile (name, age, learning direction, topic)
2. Child taps "Start" — Ticha greets them and launches Exchange 1 (introduce a word with a memorable hook)
3. Exchange 2: Ticha drills the word in context
4. Exchange 3: Ticha asks a personalised question to lock the word in memory
5. After 5 words: REPETITION DRILL → MASTERY GATE quiz → MEMORY MOMENT reflection
6. XP awarded, session saved, child sees their stars on the dashboard

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| AI | Google Gemini 2.5 Flash Live Audio API (`@google/genai`) |
| Auth & DB | Supabase (Auth + PostgreSQL with RLS) |
| Styling | Tailwind CSS v4 |
| Deployment | Vercel |

---

## Features

- **Voice-only UI** — no reading or typing required; ideal for pre-literate children
- **Gamified progress** — XP, streaks, star ratings, and level titles (Beginner → Champion)
- **Parent dashboard** — session history, words practiced, XP growth per child
- **Multiple child profiles** — one parent account, multiple children
- **Accessibility** — high contrast, large touch targets, slow-speech option, visual mode
- **Bilingual** — full English ↔ Swahili support with authentic East African warmth in every prompt

---

## Local Setup

### Prerequisites

- Node.js 20+
- A [Google AI Studio](https://aistudio.google.com) API key with Gemini Live access
- A [Supabase](https://supabase.com) project

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/ticha.git
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

### 4. Run the development server

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
│   ├── page.tsx          # Landing page
│   ├── login/            # Auth pages
│   ├── signup/
│   ├── dashboard/        # Parent dashboard (child management)
│   ├── child/            # Child home (pick topic + start)
│   ├── session/          # Voice session page (hosts VoiceSession)
│   ├── progress/         # Progress & history view
│   ├── quiz/             # Post-session quiz
│   └── settings/         # Child profile settings
├── components/
│   ├── VoiceSession.tsx  # Core AI voice session component
│   ├── TichaAvatar.tsx   # Animated avatar (idle/listening/speaking)
│   └── QuizOverlay.tsx   # End-of-session quiz overlay
├── lib/
│   ├── supabase.ts       # Supabase browser client
│   └── schema.sql        # Database schema (run once in Supabase)
├── public/
│   └── mic-processor.js  # AudioWorklet processor (16 kHz mic capture)
└── types/                # Shared TypeScript types
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
- Audio output is queued as `AudioBufferSourceNode` chains so playback is seamless even across many small chunks

---

## Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

Add the three environment variables (`NEXT_PUBLIC_GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in your Vercel project settings, then deploy.

---

## Built for the Gemini Live Agent Challenge

Ticha demonstrates Gemini Live's ability to power deeply personalised, low-latency voice agents for real-world educational impact. The challenge: build something where real-time voice is not just a feature, but the entire product.

For 200 million Swahili speakers — and the diaspora children growing up between two worlds — Ticha is that product.

---

*Built with the Google Gemini Live Audio API · Next.js · Supabase*
