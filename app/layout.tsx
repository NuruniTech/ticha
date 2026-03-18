import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { AccessibilityProvider } from "@/context/AccessibilityContext";

export const metadata: Metadata = {
  title: "Ticha: AI Language Tutor for African Children",
  description: "Help your child speak Swahili and English through fun, real-time AI conversations. Free to start.",
  openGraph: {
    title: "Ticha: AI Language Tutor for African Children",
    description: "Help your child speak Swahili and English through fun, real-time AI conversations. Free to start.",
    type: "website",
    url: "https://www.ticha.app",
    siteName: "Ticha",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Ticha — AI Language Tutor for African Children" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ticha: AI Language Tutor for African Children",
    description: "Help your child speak Swahili and English through fun, real-time AI conversations. Free to start.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased" suppressHydrationWarning>
        <AccessibilityProvider>
          {children}
        </AccessibilityProvider>
        <Analytics />
      </body>
    </html>
  );
}
