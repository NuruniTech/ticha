"use client";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useLanguage } from "@/context/LanguageContext";
import { T } from "@/lib/translations";

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { lang } = useLanguage();
  const t = T[lang].offline;

  if (isOnline) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
      background: "#FF8C00",
      color: "white",
      textAlign: "center",
      padding: "8px 16px",
      fontSize: "13px",
      fontWeight: 700,
      fontFamily: "'Nunito', sans-serif",
      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    }}>
      📡 {t.banner}
    </div>
  );
}
