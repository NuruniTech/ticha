"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface PendingXp { childId: string; xp: number; ts: number; }

// Flushes any quiz XP that was earned while offline.
// Runs silently in the background on every page load.
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
            const { data } = await supabase
              .from("children").select("xp").eq("id", item.childId).single();
            if (data) {
              await supabase.from("children")
                .update({ xp: data.xp + item.xp }).eq("id", item.childId);
            }
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
