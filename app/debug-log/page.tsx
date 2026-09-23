"use client";

import { useEffect, useState } from "react";

// Shows the debug log of the last lesson. The on-screen panel is wiped when the
// lesson ends and redirects to the quiz; VoiceSession also writes each line here.
export default function DebugLogPage() {
  const [lines, setLines] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try { setLines(JSON.parse(localStorage.getItem("ticha_last_log") ?? "[]")); } catch { /* empty */ }
  }, []);

  const text = lines.join("\n");
  return (
    <main style={{ padding: 16, fontFamily: "monospace", fontSize: 12 }}>
      <button
        onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true))}
        style={{ padding: "10px 18px", fontSize: 16, marginBottom: 12 }}
      >
        {copied ? "Copied ✓" : `Copy log (${lines.length} lines)`}
      </button>
      <pre style={{ whiteSpace: "pre-wrap" }}>{text || "No log yet. Run a lesson with &debug=1."}</pre>
    </main>
  );
}
