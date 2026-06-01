import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Language = "en" | "zh";

const LANGUAGE_STORAGE_KEY = "baby-log-language";

type TranslationKey =
  | "app.loading"
  | "api.requestFailed"
  | "language.label"
  | "language.english"
  | "language.chinese"
  | "login.admin"
  | "login.read"
  | "login.password"
  | "login.submit"
  | "login.failed"
  | "nav.record"
  | "nav.yesterday"
  | "nav.timeline"
  | "nav.checklist"
  | "nav.more";

const translations: Record<TranslationKey, Record<Language, string>> = {
  "app.loading": { en: "Opening the log...", zh: "正在打开记录台..." },
  "api.requestFailed": { en: "Request failed", zh: "请求失败" },
  "language.label": { en: "Language", zh: "语言" },
  "language.english": { en: "EN", zh: "EN" },
  "language.chinese": { en: "中文", zh: "中文" },
  "login.admin": { en: "Admin", zh: "管理端" },
  "login.read": { en: "Family read-only", zh: "家人只读" },
  "login.password": { en: "Password", zh: "密码" },
  "login.submit": { en: "Log in", zh: "登录" },
  "login.failed": { en: "Login failed", zh: "登录失败" },
  "nav.record": { en: "Record", zh: "记录" },
  "nav.yesterday": { en: "Yesterday", zh: "昨日" },
  "nav.timeline": { en: "Timeline", zh: "时间线" },
  "nav.checklist": { en: "Checklist", zh: "清单" },
  "nav.more": { en: "More", zh: "更多" }
};

const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
}>({
  language: getCurrentLanguage(),
  setLanguage: () => undefined
});

export function getCurrentLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === "en" || stored === "zh") return stored;
  return window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function t(key: TranslationKey, language = getCurrentLanguage()): string {
  return translations[key][language];
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => getCurrentLanguage());

  const setLanguage = (nextLanguage: Language) => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    setLanguageState(nextLanguage);
  };

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const context = useContext(LanguageContext);
  return {
    ...context,
    t: (key: TranslationKey) => t(key, context.language)
  };
}

export function LanguageToggle() {
  const { language, setLanguage, t: translate } = useI18n();
  return (
    <div className="language-toggle" aria-label={translate("language.label")}>
      <button type="button" className={language === "en" ? "active" : ""} aria-pressed={language === "en"} onClick={() => setLanguage("en")}>
        {translate("language.english")}
      </button>
      <button type="button" className={language === "zh" ? "active" : ""} aria-pressed={language === "zh"} onClick={() => setLanguage("zh")}>
        {translate("language.chinese")}
      </button>
    </div>
  );
}
