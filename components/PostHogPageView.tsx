"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";

export default function PostHogPageView() {
  const pathname    = usePathname();
  const searchParams = useSearchParams();
  const posthog     = usePostHog();

  useEffect(() => {
    if (!pathname || !posthog) return;
    const url = window.origin + pathname + (searchParams.toString() ? `?${searchParams}` : "");
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, posthog]);

  return null;
}
