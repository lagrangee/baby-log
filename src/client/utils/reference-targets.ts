import type { ReferenceTargetItem } from "../types";
import { getCurrentLanguage, localizedText } from "../i18n";

export type SummaryReferenceSlot = "feeding" | "pee" | "poop" | "sleep" | "temperature" | "bottle";

const slotKeys: Record<SummaryReferenceSlot, string[]> = {
  feeding: ["feeding_frequency_newborn_0_30d"],
  pee: ["wet_diapers_day_5_30", "wet_diapers_day_3_4", "wet_diapers_early_day_1_2_reference_only"],
  poop: ["stools_day_5_30_breastfed", "stools_day_3_4"],
  sleep: ["newborn_sleep_0_30d"],
  temperature: ["temperature_under_3_months_38c"],
  bottle: ["formula_volume_first_week", "formula_volume_first_month"]
};

export function referenceForSlot(items: ReferenceTargetItem[] | undefined, slot: SummaryReferenceSlot): ReferenceTargetItem | null {
  if (!items?.length) return null;
  const keys = slotKeys[slot];
  return items.find((item) => keys.includes(item.key)) ?? null;
}

export function referenceBadgeText(item: ReferenceTargetItem | null): string | null {
  if (!item) return null;
  if (item.key === "feeding_frequency_newborn_0_30d") return localizedText({ en: "8-12 feeds", zh: "8-12 次" });
  if (item.key === "newborn_sleep_0_30d") return localizedText({ en: "14-17 hr", zh: "14-17 小时" });
  if (!item.target_label) return localizedText({ en: "Stage reference", zh: "阶段参考" });
  return compactTargetLabel(item.target_label);
}

export function referenceStatusClass(item: ReferenceTargetItem | null): string {
  if (!item) return "";
  if (item.status === "below_reference" || item.status === "above_reference" || item.status === "red_flag_recorded") return "attention";
  if (item.status === "within_reference") return "ok";
  return "";
}

function compactTargetLabel(label: string): string {
  const compact = label
    .replace(/\s+/g, " ")
    .replace(/ wet diapers\/24h/g, " wet")
    .replace(/ times\/24h/g, " times")
    .replace(/ min\/24h/g, " min")
    .replace(/ml\/feed/g, "ml/feed")
    .replace(/个\/24h/g, "个")
    .replace(/次\/24h/g, "次")
    .replace(/分钟\/24h/g, "分钟")
    .replace(/ C/g, " °C")
    .replace(/°C/g, "°C");
  if (getCurrentLanguage() !== "zh") return compact;
  return compact
    .replace(/ wet\b/g, " 个湿尿布")
    .replace(/ times\b/g, " 次")
    .replace(/ min\b/g, " 分钟")
    .replace(/ml\/feed/g, "ml/次");
}
