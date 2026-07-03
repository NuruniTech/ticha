"use client";

import { useEffect } from "react";

interface PendingXp { childId: string; xp: number; ts: number; }

// Flushes any quiz XP that was earned while offline.
// Runs silently in the background on every page load.
// XP is awarded through /api/quiz-results (server-side, ownership-checked)
// rather than by writing to the database directly from the browser.
export default function XpSyncOnLoad() {
  useEffect(() => {
    if (!navigator.onLine) return;

    async function flush() {
      try {
        const raw = localStorage.getItem("ticha_pending_xp");
        if (!raw) return;
        const pending: PendingXp[] = JSON.parse(raw);
        if (!pending.length) return;

        const remaining: PendingXp[] = [];
        for (const item of pending) {
          try {
            const res = await fetch("/api/quiz-results", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ childId: item.childId, stars: item.xp, words: [] }),
            });
            // 404 = child deleted since; drop the entry rather than retry forever
            if (!res.ok && res.status !== 404) throw new Error(String(res.status));
          } catch {
            remaining.push(item); // keep for next attempt
          }
        }
        localStorage.setItem("ticha_pending_xp", JSON.stringify(remaining));
      } catch { /* ignore */ }
    }

    flush();
  }, []);

  return null;
}
