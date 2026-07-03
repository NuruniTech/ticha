"use client";

import { useSyncExternalStore } from "react";

// Online/offline status via useSyncExternalStore — the canonical pattern for
// subscribing to browser state (no setState-in-effect, SSR-safe: the server
// snapshot reports "online" so pages never render the offline wall during SSR).
function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
