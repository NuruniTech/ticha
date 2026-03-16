export default function TermsOfService() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px", fontFamily: "system-ui, sans-serif", color: "#1e293b", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ color: "#64748b", marginBottom: 32 }}>Last updated: March 16, 2026</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32 }}>1. Acceptance</h2>
      <p>By creating an account on Ticha, you agree to these Terms of Service. If you do not agree, please do not use the app.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32 }}>2. Use of the Service</h2>
      <ul>
        <li>Ticha is intended for educational use by children under parental supervision.</li>
        <li>You must be at least 18 years old to create a parent account.</li>
        <li>You are responsible for maintaining the security of your account credentials.</li>
        <li>You agree not to misuse the service or attempt to disrupt its operation.</li>
      </ul>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32 }}>3. Voice & Data</h2>
      <p>During voice sessions, audio is streamed to the Google Gemini API for real-time processing. By using Ticha, you consent to this data processing. See our <a href="/privacy" style={{ color: "#16a34a" }}>Privacy Policy</a> for full details.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32 }}>4. Intellectual Property</h2>
      <p>All content, design, and code in Ticha is owned by Nuruni Tech / Grow Wise Africa. You may not copy, modify, or distribute any part of the app without written permission.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32 }}>5. Disclaimer</h2>
      <p>Ticha is provided "as is" without warranties of any kind. We are not liable for any damages arising from use of the app. Language learning outcomes may vary.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32 }}>6. Changes</h2>
      <p>We may update these terms at any time. Continued use of Ticha after changes constitutes acceptance of the new terms.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32 }}>7. Contact</h2>
      <p>Questions? Email us at <a href="mailto:support@ticha.app" style={{ color: "#16a34a" }}>support@ticha.app</a>.</p>

      <p style={{ marginTop: 48, color: "#94a3b8", fontSize: 14 }}>© 2026 Grow Wise Africa / Nuruni Tech</p>
    </div>
  );
}
