import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import en from "./en.json";

// Each language doubles as the country signal for a submission
// (docs/CROSS_BORDER_AND_DPG.md) — there's no separate country switcher UI;
// picking Portuguese is how a citizen tells Pramaan they're reporting in
// Brazil. countryCode must be a COUNTRY_PROFILES key (@pramaan/shared-types).
export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", speechLang: "en-IN", countryCode: "IN" },
  { code: "hi", label: "हिन्दी", speechLang: "hi-IN", countryCode: "IN" },
  { code: "bn", label: "বাংলা", speechLang: "bn-IN", countryCode: "IN" },
  { code: "te", label: "తెలుగు", speechLang: "te-IN", countryCode: "IN" },
  { code: "mr", label: "मराठी", speechLang: "mr-IN", countryCode: "IN" },
  { code: "ta", label: "தமிழ்", speechLang: "ta-IN", countryCode: "IN" },
  { code: "gu", label: "ગુજરાતી", speechLang: "gu-IN", countryCode: "IN" },
  { code: "kn", label: "ಕನ್ನಡ", speechLang: "kn-IN", countryCode: "IN" },
  { code: "ml", label: "മലയാളം", speechLang: "ml-IN", countryCode: "IN" },
  { code: "pa", label: "ਪੰਜਾਬੀ", speechLang: "pa-IN", countryCode: "IN" },
  { code: "pt", label: "Português", speechLang: "pt-BR", countryCode: "BR" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];
type Dictionary = Record<string, string>;

// English ships in the main bundle; every other language is fetched on demand, so a citizen who reads
// Hindi never downloads the other nine dictionaries.
const LOADERS: Record<Exclude<LanguageCode, "en">, () => Promise<{ default: Dictionary }>> = {
  hi: () => import("./hi.json"),
  bn: () => import("./bn.json"),
  te: () => import("./te.json"),
  mr: () => import("./mr.json"),
  ta: () => import("./ta.json"),
  gu: () => import("./gu.json"),
  kn: () => import("./kn.json"),
  ml: () => import("./ml.json"),
  pa: () => import("./pa.json"),
  pt: () => import("./pt.json"),
};

const STORAGE_KEY = "pramaan.language";
const isSupported = (code: string | null | undefined): code is LanguageCode => SUPPORTED_LANGUAGES.some((l) => l.code === code);

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  /** The chosen language's dictionary has loaded, so t() now returns text in it. */
  ready: boolean;
  /** Looks up `key` and substitutes any `{placeholder}` tokens from `vars`. */
  t: (key: string, vars?: Record<string, string | number>) => string;
  speechLang: string;
  countryCode: string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function initialLanguage(): LanguageCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isSupported(stored)) return stored;
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through to the browser's language.
  }
  // First visit: honour the browser's language when we have it (pt-BR -> pt, hi-IN -> hi).
  const guess = typeof navigator !== "undefined" ? navigator.language?.slice(0, 2).toLowerCase() : "";
  return isSupported(guess) ? guess : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(initialLanguage);
  const [dictionary, setDictionary] = useState<Dictionary>(en);
  const [loaded, setLoaded] = useState<LanguageCode>("en");

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Non-fatal — just won't persist across reloads.
    }
  };

  useEffect(() => {
    document.documentElement.lang = language;
    if (language === "en") {
      setDictionary(en);
      setLoaded("en");
      return;
    }
    let live = true;
    LOADERS[language]()
      .then((m) => {
        if (!live) return;
        setDictionary(m.default);
        setLoaded(language);
      })
      // A failed download leaves the previous dictionary in place; missing keys fall back to English anyway.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => {
    const entry = SUPPORTED_LANGUAGES.find((l) => l.code === language);
    return {
      language,
      setLanguage,
      ready: loaded === language,
      speechLang: entry?.speechLang ?? "en-IN",
      countryCode: entry?.countryCode ?? "IN",
      t: (key, vars) => {
        // A key missing from the active language falls back to English, never to the raw key.
        let text = dictionary[key] ?? (en as Dictionary)[key] ?? key;
        if (vars) {
          for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
        }
        return text;
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, dictionary, loaded]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
