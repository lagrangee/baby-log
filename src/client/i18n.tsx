import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { normalizeLanguage, type Language } from "../shared/i18n";

export type { Language };
export type LocalizedText = Record<Language, string>;

const LANGUAGE_STORAGE_KEY = "baby-log-language";

type TranslationParams = Record<string, string | number | null | undefined>;

const translations = {
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
  "nav.growth": { en: "Growth", zh: "成长曲线" },
  "nav.timeline": { en: "Timeline", zh: "时间线" },
  "nav.checklist": { en: "Checklist", zh: "清单" },
  "nav.more": { en: "More", zh: "更多" }
} as const satisfies Record<string, LocalizedText>;

export type TranslationKey = keyof typeof translations;

const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
}>({
  language: getCurrentLanguage(),
  setLanguage: () => undefined
});

export function getCurrentLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const browserLanguage = window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
  return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY), browserLanguage);
}

export function t(key: TranslationKey, params?: TranslationParams, language = getCurrentLanguage()): string {
  return interpolate(translations[key][language], params);
}

export function localizedText(value: LocalizedText, params?: TranslationParams, language = getCurrentLanguage()): string {
  return interpolate(value[language], params);
}

export function languageQuery(language = getCurrentLanguage()): string {
  return `lang=${language}`;
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
  return useMemo(() => ({
    ...context,
    t: (key: TranslationKey, params?: TranslationParams) => t(key, params, context.language),
    text: (value: LocalizedText, params?: TranslationParams) => localizedText(value, params, context.language)
  }), [context]);
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

function interpolate(value: string, params: TranslationParams = {}): string {
  return value.replace(/\{(\w+)\}/g, (_match, key: string) => String(params[key] ?? ""));
}
