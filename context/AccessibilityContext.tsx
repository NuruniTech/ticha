"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { AppSettings, DEFAULT_SETTINGS } from "@/types";

interface AccessibilityContextValue {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

const AccessibilityContext = createContext<AccessibilityContextValue>({
  settings: DEFAULT_SETTINGS,
  updateSetting: () => {},
});

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ticha_settings");
      if (saved) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
    } catch { /* ignore */ }
  }, []);

  // Apply CSS variables whenever settings change
  useEffect(() => {
    const root = document.documentElement;
    // Font size
    const fontMap = { normal: "16px", large: "19px", xlarge: "22px" };
    root.style.setProperty("--base-font", fontMap[settings.fontSize]);
    // High contrast
    if (settings.highContrast || settings.theme === "high-contrast") {
      root.setAttribute("data-theme", "high-contrast");
    } else if (settings.theme === "colorblind") {
      root.setAttribute("data-theme", "colorblind");
    } else {
      root.setAttribute("data-theme", "default");
    }
    // Reduce motion
    if (settings.reduceMotion) {
      root.setAttribute("data-reduce-motion", "true");
    } else {
      root.removeAttribute("data-reduce-motion");
    }
  }, [settings]);

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem("ticha_settings", JSON.stringify(next));
      return next;
    });
  }

  return (
    <AccessibilityContext.Provider value={{ settings, updateSetting }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  return useContext(AccessibilityContext);
}
