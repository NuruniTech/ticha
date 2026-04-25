"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Lang = "en" | "sw";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      // If user has already chosen a language, respect that choice
      const saved = localStorage.getItem("ticha_lang") as Lang | null;
      if (saved === "en" || saved === "sw") { setLangState(saved); return; }

      // Auto-detect from browser locale — default to Swahili for East African countries
      const swahiliLocales = ["sw", "sw-TZ", "sw-KE", "sw-UG", "sw-RW", "sw-BI", "sw-CD", "sw-MZ"];
      const swahiliCountries = ["TZ", "KE", "UG", "RW", "BI", "CD", "MZ", "SO"];

      const browserLang = navigator.language || "";
      const languages   = navigator.languages || [browserLang];

      const isSwahili =
        languages.some(l => swahiliLocales.some(sl => l.toLowerCase().startsWith(sl.toLowerCase()))) ||
        swahiliCountries.some(c => browserLang.toUpperCase().endsWith(c));

      if (isSwahili) setLangState("sw");
    } catch { /* ignore */ }
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    try { localStorage.setItem("ticha_lang", l); } catch { /* ignore */ }
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
