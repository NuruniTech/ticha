"use client";

import { useState } from "react";
import { getFluentUrl } from "@/lib/fluentEmoji";

interface Props {
  emoji: string;
  size?: number;
  alt?: string;
  style?: React.CSSProperties;
  className?: string;
}

export default function FluentEmoji({ emoji, size = 40, alt, style, className }: Props) {
  const [failed, setFailed] = useState(false);
  const url = getFluentUrl(emoji);

  if (!url || failed) {
    return (
      <span
        role="img"
        aria-label={alt || emoji}
        className={className}
        style={{ fontSize: size * 0.72, lineHeight: 1, display: "inline-block", ...style }}
      >
        {emoji}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt || emoji}
      width={size}
      height={size}
      className={className}
      onError={() => setFailed(true)}
      style={{ objectFit: "contain", display: "inline-block", ...style }}
    />
  );
}
