import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";
export const alt = "Ticha: AI Language Tutor for African Children";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logoData = readFileSync(join(process.cwd(), "public/images/ticha-logo-v2.PNG"));
  const heroData = readFileSync(join(process.cwd(), "public/images/ticha-hero.PNG"));
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;
  const heroSrc = `data:image/png;base64,${heroData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          background: "linear-gradient(135deg, #047857 0%, #065f46 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: -80, right: -80, width: 400, height: 400, borderRadius: "50%", background: "rgba(255,255,255,0.06)", display: "flex" }} />
        <div style={{ position: "absolute", bottom: -60, left: 380, width: 300, height: 300, borderRadius: "50%", background: "rgba(255,255,255,0.04)", display: "flex" }} />

        {/* Left content */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "52px", width: 620, zIndex: 10 }}>

          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={240} height={72} style={{ objectFit: "contain", objectPosition: "left", marginBottom: 24 }} alt="Ticha" />

          {/* Gold divider */}
          <div style={{ width: 90, height: 3, background: "#F5C842", marginBottom: 24, borderRadius: 2, display: "flex" }} />

          {/* Headline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            <span style={{ fontSize: 48, fontWeight: 700, color: "white", lineHeight: 1.1 }}>Your child speaks.</span>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 48, fontWeight: 700, color: "white", lineHeight: 1.1 }}>Ticha</span>
              <span style={{ fontSize: 48, fontWeight: 700, color: "#FCD34D", lineHeight: 1.1 }}>listens</span>
              <span style={{ fontSize: 48, fontWeight: 700, color: "white", lineHeight: 1.1 }}>&amp; teaches.</span>
            </div>
          </div>

          {/* Subtext */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 28 }}>
            <span style={{ fontSize: 18, color: "rgba(255,255,255,0.82)" }}>AI Language Tutor for African Children.</span>
            <span style={{ fontSize: 18, color: "rgba(255,255,255,0.82)" }}>Free to start. No reading required.</span>
          </div>

          {/* CTA */}
          <div style={{ background: "#F5C842", borderRadius: 32, padding: "14px 28px", fontSize: 18, fontWeight: 800, color: "#000", display: "flex", width: "fit-content" }}>
            Try it Free → ticha.app
          </div>
        </div>

        {/* Right: Ticha avatar */}
        <div style={{ position: "absolute", right: 0, bottom: 0, width: 560, height: 630, display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroSrc} width={540} height={590} style={{ objectFit: "contain", objectPosition: "bottom" }} alt="Ticha tutor" />
        </div>

        {/* Bottom tagline */}
        <div style={{ position: "absolute", bottom: 20, left: 52, fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 2, display: "flex" }}>
          BUILT BY NURUNITECH · A GROW WISE AFRICA INITIATIVE
        </div>
      </div>
    ),
    { ...size }
  );
}
