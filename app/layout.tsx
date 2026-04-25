import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { AccessibilityProvider } from "@/context/AccessibilityContext";
import { LanguageProvider } from "@/context/LanguageContext";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import XpSyncOnLoad from "@/components/XpSyncOnLoad";
import OfflineBanner from "@/components/OfflineBanner";
import PostHogProvider from "@/components/PostHogProvider";
import PostHogPageView from "@/components/PostHogPageView";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // prevents iOS zoom-on-input which breaks the session UI
  themeColor: "#FF8C00",
};

const TITLE       = "Ticha — Your Child's English and African Language Tutor";
const DESCRIPTION = "Help your child speak Swahili and English through fun voice conversations with Ticha, their friendly language tutor. No reading, no typing — just talk! Free to start.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.ticha.app"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: "https://www.ticha.app",
    siteName: "Ticha",
    images: [{ url: "https://www.ticha.app/opengraph-image", width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["https://www.ticha.app/opengraph-image"],
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/images/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/images/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/images/icon-512.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased" suppressHydrationWarning>
        <PostHogProvider>
          <LanguageProvider>
            <AccessibilityProvider>
              <Suspense>
                <PostHogPageView />
              </Suspense>
              <OfflineBanner />
              {children}
            </AccessibilityProvider>
          </LanguageProvider>
        </PostHogProvider>
        <ServiceWorkerRegistration />
        <XpSyncOnLoad />
        <Analytics />
      </body>
    </html>
  );
}
