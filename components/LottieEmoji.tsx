"use client";

import { useState } from "react";
import FluentEmoji from "./FluentEmoji";
import { getAnimatedUrl } from "@/lib/fluentEmoji";

interface Props {
  emoji: string;
  size?: number;
  // loop prop kept for API compatibility but APNG loops natively
  loop?: boolean;
}

export default function LottieEmoji({ emoji, size = 80 }: Props) {
  const [failed, setFailed] = useState(false);
  const url = getAnimatedUrl(emoji);

  // No animated version in the map — use Fluent 3D static PNG
  if (!url || failed) {
    return <FluentEmoji emoji={emoji} size={size} />;
  }

  // APNG animates natively in the browser — no JS player needed
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={emoji}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{ objectFit: "contain", display: "inline-block" }}
    />
  );
}
