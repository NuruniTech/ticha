import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const alt = "Ticha: AI Language Tutor for African Children";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logoData = readFileSync(join(process.cwd(), "public/images/ticha-logo-v2.PNG")).toString("base64");
  const heroData = readFileSync(join(process.cwd(), "public/images/ticha-hero.PNG")).toString("base64");
  const logo = `data:image/png;base64,${logoData}`;
  const hero = `data:image/png;base64,${heroData}`;

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", background: "linear-gradient(135deg, #047857, #065f46)", overflow: "hidden", position: "relative" }}>

        {/* Avatar right side */}
        <div style={{ position: "absolute", right: 0, bottom: 0, display: "flex" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero} width={500} height={560} style={{ objectFit: "contain" }} alt="" />
        </div>

        {/* Left panel */}
        <div style={{ display: "flex", flexDirection: "column", padding: "50px", width: 650, gap: 0 }}>
          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={220} height={66} style={{ objectFit: "contain", objectPosition: "left" }} alt="Ticha" />

          {/* Divider */}
          <div style={{ width: 80, height: 3, background: "#F5C842", marginTop: 20, marginBottom: 24, display: "flex" }} />

          {/* Line 1 */}
          <div style={{ fontSize: 44, fontWeight: 700, color: "white", marginBottom: 10, display: "flex" }}>
            Your child speaks.
          </div>

          {/* Line 2 */}
          <div style={{ fontSize: 44, fontWeight: 700, marginBottom: 24, display: "flex", gap: 12 }}>
            <span style={{ color: "white" }}>Ticha</span>
            <span style={{ color: "#FCD34D" }}>listens</span>
            <span style={{ color: "white" }}>&amp; teaches.</span>
          </div>

          {/* Sub */}
          <div style={{ fontSize: 18, color: "rgba(255,255,255,0.82)", marginBottom: 6, display: "flex" }}>
            AI Language Tutor for African Children.
          </div>
          <div style={{ fontSize: 18, color: "rgba(255,255,255,0.82)", marginBottom: 30, display: "flex" }}>
            Free to start. No reading required.
          </div>

          {/* CTA */}
          <div style={{ background: "#F5C842", borderRadius: 30, padding: "13px 26px", fontSize: 18, fontWeight: 800, color: "#000000", display: "flex", alignSelf: "flex-start" }}>
            Try it Free → ticha.app
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: "absolute", bottom: 18, left: 50, fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 2, display: "flex" }}>
          BUILT BY NURUNITECH · A GROW WISE AFRICA INITIATIVE
        </div>
      </div>
    ),
    { ...size }
  );
}
