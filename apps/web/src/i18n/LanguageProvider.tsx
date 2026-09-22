import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import en from "./en.json";
import hi from "./hi.json";
import ta from "./ta.json";
import pt from "./pt.json";

// Each language doubles as the country signal for a submission
// (docs/CROSS_BORDER_AND_DPG.md) — there's no separate country switcher UI;
// picking Portuguese is how a citizen tells JanSetu they're reporting in
// Brazil. countryCode must be a COUNTRY_PROFILES key (@jansetu/shared-types).
export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", speechLang: "en-IN", countryCode: "IN" },
  { code: "hi", label: "हिन्दी", speechLang: "hi-IN", countryCode: "IN" },
  { code: "ta", label: "தமிழ்", speechLang: "ta-IN", countryCode: "IN" },
  { code: "pt", label: "Português", speechLang: "pt-BR", countryCode: "BR" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

const DICTIONARIES: Record<LanguageCode, Record<string, string>> = { en, hi, ta, pt };
const STORAGE_KEY = "jansetu.language";

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  /** Looks up `key` and substitutes any `{placeholder}` tokens from `vars`. */
  t: (key: string, vars?: Record<string, string | number>) => string;
  speechLang: string;
  countryCode: string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredLanguage(): LanguageCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in DICTIONARIES) return stored as LanguageCode;
  } catch {
    // localStorage unavailable (private mode, etc.) — fall back to default.
  }
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(readStoredLanguage);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Non-fatal — just won't persist across reloads.
    }
  };

  const value = useMemo<LanguageContextValue>(() => {
    const dictionary = DICTIONARIES[language];
    const languageEntry = SUPPORTED_LANGUAGES.find((l) => l.code === language);
    const speechLang = languageEntry?.speechLang ?? "en-IN";
    const countryCode = languageEntry?.countryCode ?? "IN";
    return {
      language,
      setLanguage,
      speechLang,
      countryCode,
      t: (key, vars) => {
        // A key missing from the active language falls back to English, never to the raw key.
        let value = dictionary[key] ?? DICTIONARIES.en[key] ?? key;
        if (vars) {
          for (const [k, v] of Object.entries(vars)) {
            value = value.replace(`{${k}}`, String(v));
          }
        }
        return value;
      },
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
