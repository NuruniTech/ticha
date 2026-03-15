"use client";

import { useEffect, useState } from "react";

export type AvatarState = "idle" | "talking" | "celebrating" | "connecting" | "listening";
type MouthShape = "smile" | "small" | "open";

interface Props {
  state: AvatarState;
  size?: number;
}

export default function TichaAvatar({ state, size = 220 }: Props) {
  const [mouth,     setMouth]     = useState<MouthShape>("smile");
  const [eyeOpen,   setEyeOpen]   = useState(true);
  const [headShift, setHeadShift] = useState(0);
  // ── Lip sync ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (state !== "talking") { setMouth("smile"); return; }
    const seq: MouthShape[] = ["smile","small","open","open","small","smile","small","open","small","smile"];
    let i = 0;
    const iv = setInterval(() => { setMouth(seq[i++ % seq.length]); }, 130);
    return () => clearInterval(iv);
  }, [state]);

  // ── Eye blink ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const blink = () => {
      const t = setTimeout(() => {
        setEyeOpen(false);
        setTimeout(() => { setEyeOpen(true); blink(); }, 140);
      }, 2500 + Math.random() * 2500);
      return t;
    };
    const t = blink();
    return () => clearTimeout(t);
  }, []);

  // ── Head bob ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (state === "connecting") { setHeadShift(0); return; }
    let angle = 0;
    const amp   = state === "celebrating" ? 7 : 2;
    const speed = state === "celebrating" ? 0.07 : 0.02;
    const iv = setInterval(() => {
      angle += speed;
      setHeadShift(Math.sin(angle) * amp);
    }, 16);
    return () => { clearInterval(iv); setHeadShift(0); };
  }, [state]);


  return (
    <div style={{
      width: size, height: size * 1.2,
      display: "inline-flex", alignItems: "flex-end", justifyContent: "center",
      filter: state === "celebrating"
        ? "drop-shadow(0 0 20px rgba(255,180,80,0.7))"
        : "drop-shadow(0 10px 16px rgba(0,0,0,0.3))",
      transition: "filter 0.4s",
    }}>
      <svg viewBox="0 0 200 240" width={size} height={size * 1.2} xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Skin tone — warm medium-dark African */}
          <radialGradient id="skinGrad" cx="45%" cy="35%" r="65%">
            <stop offset="0%"   stopColor="#C68642" />
            <stop offset="100%" stopColor="#8D5524" />
          </radialGradient>
          <radialGradient id="skinLightGrad" cx="40%" cy="30%" r="70%">
            <stop offset="0%"   stopColor="#D4956A" />
            <stop offset="100%" stopColor="#A0622E" />
          </radialGradient>
          {/* Dress — vibrant ankara-inspired orange/green */}
          <linearGradient id="dressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#E8540A" />
            <stop offset="50%"  stopColor="#F97316" />
            <stop offset="100%" stopColor="#DC6B0E" />
          </linearGradient>
          {/* Headwrap — deep green */}
          <linearGradient id="wrapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#2E8B2E" />
            <stop offset="100%" stopColor="#1A5C1A" />
          </linearGradient>
          <radialGradient id="eyeWhite" cx="40%" cy="35%" r="65%">
            <stop offset="0%"   stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F0EDE8" />
          </radialGradient>
        </defs>

        {/* ── Ground shadow ── */}
        <ellipse cx="100" cy="238" rx="52" ry="6" fill="rgba(0,0,0,0.15)" />

        {/* ── BODY / DRESS ── */}
        <g>
          {/* Main dress body */}
          <path d="M58 148 Q42 195 50 225 Q100 238 150 225 Q158 195 142 148 Q120 136 100 134 Q80 136 58 148 Z"
            fill="url(#dressGrad)" />
          {/* Ankara pattern overlay — horizontal stripes */}
          <path d="M58 148 Q80 136 100 134 Q120 136 142 148 L140 162 Q100 154 60 162 Z"
            fill="rgba(255,255,255,0.12)" />
          <path d="M55 175 Q57 170 60 168 Q100 160 140 168 Q143 170 145 175 L143 185 Q100 177 57 185 Z"
            fill="rgba(0,0,0,0.08)" />
          <path d="M50 200 Q100 190 150 200 L150 210 Q100 202 50 210 Z"
            fill="rgba(255,255,255,0.10)" />
          {/* Collar */}
          <ellipse cx="100" cy="147" rx="16" ry="7" fill="#C04A08" />
          {/* Neck */}
          <rect x="89" y="131" width="22" height="18" rx="8" fill="url(#skinGrad)" />
        </g>

        {/* ── LEFT ARM ── */}
        <g style={{
          transform: `rotate(0deg)`,
          transformOrigin: "58px 152px",
          transformBox: "fill-box",
          transition: state === "celebrating" ? "none" : "transform 0.3s ease-out",
        }}>
          {/* Shoulder */}
          <ellipse cx="58" cy="152" rx="13" ry="13" fill="url(#dressGrad)" />
          {/* Upper arm */}
          <rect x="47" y="152" width="22" height="44" rx="11" fill="url(#skinGrad)" />
          {/* Hand */}
          <circle cx="58" cy="202" r="12" fill="url(#skinGrad)" />
          {/* Palm highlight */}
          <ellipse cx="55" cy="198" rx="4" ry="3" fill="rgba(255,255,255,0.2)" />
        </g>

        {/* ── RIGHT ARM ── */}
        <g style={{
          transform: `rotate(0deg)`,
          transformOrigin: "142px 152px",
          transformBox: "fill-box",
          transition: state === "celebrating" ? "none" : "transform 0.3s ease-out",
        }}>
          {/* Shoulder */}
          <ellipse cx="142" cy="152" rx="13" ry="13" fill="url(#dressGrad)" />
          {/* Upper arm */}
          <rect x="131" y="152" width="22" height="44" rx="11" fill="url(#skinGrad)" />
          {/* Hand */}
          <circle cx="142" cy="202" r="12" fill="url(#skinGrad)" />
          <ellipse cx="139" cy="198" rx="4" ry="3" fill="rgba(255,255,255,0.2)" />
        </g>

        {/* ── HEAD GROUP (bobs) ── */}
        <g style={{ transform: `translateY(${headShift}px)`, transition: "transform 0.05s linear" }}>

          {/* Head base */}
          <circle cx="100" cy="88" r="56" fill="url(#skinGrad)" />
          {/* Chin/jaw shading */}
          <ellipse cx="100" cy="132" rx="38" ry="10" fill="rgba(0,0,0,0.10)" />

          {/* ── HEADWRAP ── */}
          {/* Main wrap band */}
          <path d="M46 78 Q48 42 100 36 Q152 42 154 78 Q152 68 100 64 Q48 68 46 78 Z"
            fill="url(#wrapGrad)" />
          {/* Wrap top dome */}
          <path d="M52 72 Q55 40 100 34 Q145 40 148 72 Q145 58 100 54 Q55 58 52 72 Z"
            fill="#2E8B2E" />
          {/* Wrap knot / bow on top-right */}
          <ellipse cx="140" cy="52" rx="12" ry="8" fill="#1A5C1A" transform="rotate(-20 140 52)" />
          <ellipse cx="148" cy="46" rx="9" ry="6" fill="#2E8B2E" transform="rotate(-20 148 46)" />
          <circle  cx="144" cy="49" r="4" fill="#1A5C1A" />
          {/* Wrap fold details */}
          <path d="M52 72 Q76 62 100 64 Q124 62 148 72" stroke="rgba(255,255,255,0.15)" strokeWidth="2" fill="none" />

          {/* ── EARS ── */}
          <ellipse cx="44"  cy="92" rx="9" ry="12" fill="url(#skinGrad)" />
          <ellipse cx="156" cy="92" rx="9" ry="12" fill="url(#skinGrad)" />
          {/* Earrings — small gold hoops */}
          <circle cx="44"  cy="100" r="5" fill="none" stroke="#F59E0B" strokeWidth="2.5" />
          <circle cx="156" cy="100" r="5" fill="none" stroke="#F59E0B" strokeWidth="2.5" />

          {/* ── EYES ── */}
          <g style={{
            transform: eyeOpen ? "scaleY(1)" : "scaleY(0.07)",
            transformBox: "fill-box",
            transformOrigin: "center",
            transition: "transform 0.07s",
          }}>
            {/* Left eye */}
            <circle cx="78"  cy="88" r="13" fill="url(#eyeWhite)" />
            <circle cx="80"  cy="90" r="8"  fill="#1A0A00" />
            <circle cx="77"  cy="87" r="3.5" fill="white" />
            <circle cx="83"  cy="93" r="1.5" fill="rgba(255,255,255,0.5)" />
            {/* Right eye */}
            <circle cx="122" cy="88" r="13" fill="url(#eyeWhite)" />
            <circle cx="120" cy="90" r="8"  fill="#1A0A00" />
            <circle cx="117" cy="87" r="3.5" fill="white" />
            <circle cx="123" cy="93" r="1.5" fill="rgba(255,255,255,0.5)" />
          </g>

          {/* ── EYEBROWS — natural full brows ── */}
          <path d="M66 74 Q78 69 90 73" stroke="#3B1A00" strokeWidth="4" fill="none" strokeLinecap="round"
            style={{ transform: state === "celebrating" ? "translateY(-3px)" : "translateY(0)", transition: "transform 0.3s" }} />
          <path d="M110 73 Q122 69 134 74" stroke="#3B1A00" strokeWidth="4" fill="none" strokeLinecap="round"
            style={{ transform: state === "celebrating" ? "translateY(-3px)" : "translateY(0)", transition: "transform 0.3s" }} />

          {/* ── NOSE ── */}
          <ellipse cx="100" cy="104" rx="7" ry="5" fill="rgba(0,0,0,0.12)" />
          <circle  cx="94"  cy="106" r="3.5" fill="rgba(0,0,0,0.15)" />
          <circle  cx="106" cy="106" r="3.5" fill="rgba(0,0,0,0.15)" />

          {/* ── CHEEKS ── */}
          <ellipse cx="66"  cy="108" rx="11" ry="7" fill="rgba(180,80,40,0.25)" />
          <ellipse cx="134" cy="108" rx="11" ry="7" fill="rgba(180,80,40,0.25)" />

          {/* ── MOUTH ── */}
          {mouth === "smile" && (
            <path d="M84 118 Q100 130 116 118"
              stroke="#3B1A00" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          )}
          {mouth === "small" && (
            <>
              <ellipse cx="100" cy="120" rx="10" ry="6" fill="#3B1A00" />
              <ellipse cx="100" cy="117" rx="8"  ry="3" fill="#F5C5A0" opacity="0.9" />
              <ellipse cx="100" cy="124" rx="7"  ry="3" fill="#CC3311" opacity="0.5" />
            </>
          )}
          {mouth === "open" && (
            <>
              <ellipse cx="100" cy="121" rx="14" ry="10" fill="#3B1A00" />
              <ellipse cx="100" cy="117" rx="11" ry="5"  fill="#F5C5A0" opacity="0.95" />
              <ellipse cx="100" cy="127" rx="9"  ry="4"  fill="#CC3311" opacity="0.6" />
            </>
          )}

          {/* ── TEETH (visible when mouth open/small) ── */}
          {(mouth === "open" || mouth === "small") && (
            <ellipse cx="100" cy="118" rx="7" ry="2.5" fill="white" opacity="0.9" />
          )}
        </g>

        {/* ── Celebrating sparkles ── */}
        {state === "celebrating" && (
          <>
            <text x="12"  y="58"  fontSize="18" className="sparkle-1">⭐</text>
            <text x="160" y="44"  fontSize="16" className="sparkle-2">✨</text>
            <text x="168" y="90"  fontSize="14" className="sparkle-3">🌟</text>
            <text x="8"   y="112" fontSize="14" className="sparkle-2">💫</text>
          </>
        )}

        {/* ── Connecting dots ── */}
        {state === "connecting" && (
          <>
            <circle cx="82"  cy="220" r="5" fill="#2E8B2E" className="sparkle-1" />
            <circle cx="100" cy="220" r="5" fill="#2E8B2E" className="sparkle-2" />
            <circle cx="118" cy="220" r="5" fill="#2E8B2E" className="sparkle-3" />
          </>
        )}
      </svg>
    </div>
  );
}
