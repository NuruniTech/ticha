"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { console.error("[Ticha] Unhandled error:", error); }, [error]);

  return (
    <main style={{ minHeight: "100vh", background: "#FFFBF0", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ maxWidth: "400px", width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: "64px", marginBottom: "16px" }}>😔</div>
        <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: "24px", fontWeight: 800, color: "#1E3A5F", marginBottom: "10px" }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: "14px", color: "#6B7280", lineHeight: 1.7, marginBottom: "28px" }}>
          Ticha ran into a problem. Your progress is safe — try again or go back to the dashboard.
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button
            onClick={reset}
            style={{ padding: "12px 24px", background: "#FF8C00", color: "white", border: "none", borderRadius: "12px", fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "15px", cursor: "pointer", boxShadow: "0 3px 0 #CC6A00" }}
          >
            Try Again
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            style={{ padding: "12px 24px", background: "white", color: "#6B7280", border: "2px solid #E5E7EB", borderRadius: "12px", fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "15px", cursor: "pointer" }}
          >
            Dashboard
          </button>
        </div>
      </div>
    </main>
  );
}
