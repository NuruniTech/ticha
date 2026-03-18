import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Ticha: AI Language Tutor for African Children";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const heroUrl = new URL("/images/ticha-hero.PNG", "https://www.ticha.app").toString();
  const logoUrl = new URL("/images/ticha-logo-v2.PNG", "https://www.ticha.app").toString();

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          background: "linear-gradient(135deg, #047857 0%, #065f46 100%)",
          fontFamily: "serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: -80, right: -80, width: 400, height: 400, borderRadius: "50%", background: "rgba(255,255,255,0.06)", display: "flex" }} />
        <div style={{ position: "absolute", bottom: -60, left: 400, width: 300, height: 300, borderRadius: "50%", background: "rgba(255,255,255,0.04)", display: "flex" }} />

        {/* Left content */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "52px 52px", width: 640, zIndex: 10 }}>

          {/* Logo */}
          <img src={logoUrl} width={260} height={80} style={{ objectFit: "contain", objectPosition: "left", marginBottom: 28 }} />

          {/* Gold divider */}
          <div style={{ width: 100, height: 3, background: "#F5C842", marginBottom: 28, borderRadius: 2, display: "flex" }} />

          {/* Headline */}
          <div style={{ fontSize: 50, fontWeight: 700, color: "white", lineHeight: 1.15, marginBottom: 16, display: "flex", flexDirection: "column" }}>
            <span>Your child speaks.</span>
            <span>
              Ticha{" "}
              <span style={{ color: "#FCD34D" }}>listens</span>
              {" & teaches."}
            </span>
          </div>

          {/* Subtext */}
          <div style={{ fontSize: 19, color: "rgba(255,255,255,0.82)", marginBottom: 32, lineHeight: 1.6, display: "flex", flexDirection: "column" }}>
            <span>AI Language Tutor for African Children.</span>
            <span>Free to start. No reading required.</span>
          </div>

          {/* CTA */}
          <div style={{ background: "#F5C842", borderRadius: 32, padding: "14px 32px", fontSize: 19, fontWeight: 800, color: "#000", display: "flex", width: "fit-content" }}>
            Try it Free → ticha.app
          </div>

          {/* Bottom tagline */}
          <div style={{ position: "absolute", bottom: 24, left: 52, fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 2, display: "flex" }}>
            BUILT BY NURUNITECH · A GROW WISE AFRICA INITIATIVE
          </div>
        </div>

        {/* Right: Ticha avatar */}
        <div style={{ position: "absolute", right: 0, bottom: 0, width: 580, height: 630, display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}>
          <img src={heroUrl} width={560} height={600} style={{ objectFit: "contain", objectPosition: "bottom right" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
