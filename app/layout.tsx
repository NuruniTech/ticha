import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { AccessibilityProvider } from "@/context/AccessibilityContext";

export const metadata: Metadata = {
  title: "Ticha — Your African Language Companion",
  description: "Help your child speak Swahili and English through fun, real-time AI voice conversations.",
  openGraph: {
    title: "Ticha — Your African Language Companion",
    description: "Help your child speak Swahili and English through fun, real-time AI voice conversations.",
    type: "website",
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
