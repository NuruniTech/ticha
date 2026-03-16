export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px", fontFamily: "system-ui, sans-serif", color: "#1e293b", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: "#64748b", marginBottom: 32 }}>Last updated: March 16, 2026</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32 }}>1. Who We Are</h2>
      <p>Ticha is an AI-powered voice language tutor for children, built by Nuruni Tech / Grow Wise Africa. Our app teaches Swahili and English through real-time voice conversation powered by Google Gemini.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32 }}>2. Information We Collect</h2>
      <ul>
        <li><strong>Account information:</strong> email address and display name when you sign up.</li>
        <li><strong>Child profiles:</strong> name, age, and selected language direction (Swahili ↔ English).</li>
        <li><strong>Session data:</strong> lesson transcripts, words practiced, XP earned, and session duration.</li>
        <li><strong>Voice audio:</strong> captured during sessions and streamed directly to the Google Gemini API. Audio is not stored by Ticha.</li>
      </ul>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32 }}>3. How We Use Your Information</h2>
      <ul>
        <li>To provide and personalise the language learning experience for each child.</li>
        <li>To display progress history and XP to parents.</li>
        <li>To improve lesson quality and app performance.</li>
      </ul>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32 }}>4. Third-Party Services</h2>
      <ul>
        <li><strong>Google Gemini API</strong> — processes voice audio for real-time language tutoring. Subject to <a href="https://policies.google.com/privacy" style={{ color: "#16a34a" }}>Google's Privacy Policy</a>.</li>
        <li><strong>Supabase</strong> — stores account and session data securely with Row Level Security.</li>
        <li><strong>Google OAuth</strong> — optional sign-in method. We only receive your email and name.</li>
      </ul>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32 }}>5. Children's Privacy</h2>
      <p>Ticha is designed for use by children under parental supervision. Parents create and manage all child profiles. We do not knowingly collect personal data directly from children without parental consent.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32 }}>6. Data Retention</h2>
      <p>You may delete your account and all associated data at any time by contacting us at <a href="mailto:support@ticha.app" style={{ color: "#16a34a" }}>support@ticha.app</a>.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32 }}>7. Contact</h2>
      <p>Questions? Email us at <a href="mailto:support@ticha.app" style={{ color: "#16a34a" }}>support@ticha.app</a>.</p>

      <p style={{ marginTop: 48, color: "#94a3b8", fontSize: 14 }}>© 2026 Grow Wise Africa / Nuruni Tech</p>
    </div>
  );
}
