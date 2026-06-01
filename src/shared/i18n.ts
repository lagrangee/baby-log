export type Language = "en" | "zh";

export function normalizeLanguage(value: unknown, fallback: Language = "en"): Language {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "zh" || normalized.startsWith("zh-")) return "zh";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  return fallback;
}
