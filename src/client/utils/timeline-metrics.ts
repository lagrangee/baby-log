import { localizedText, type LocalizedText } from "../i18n";
import type { EventType } from "../types";

export type TrendMetricKey =
  | "feeding_total_count"
  | "breast_count"
  | "breastfeeding_minutes_total"
  | "bottle_ml_total"
  | "pee_count"
  | "poop_count"
  | "sleep_minutes_total"
  | "longest_sleep_minutes"
  | "temperature_max_c"
  | "latest_weight_g"
  | "symptom_count";

export type ComparisonMetricKey =
  | "feeding_total_count"
  | "breast_count"
  | "breast_minutes_total"
  | "bottle_ml_total"
  | "pee_count"
  | "poop_count"
  | "sleep_minutes_total"
  | "longest_sleep_minutes"
  | "temperature_max_c";

export interface TrendMetricItem {
  key: TrendMetricKey;
  label: string;
  unit: string;
  headline?: "sum" | "max";
  eventTypes: EventType[];
}

export interface ComparisonMetricItem {
  key: ComparisonMetricKey;
  label: string;
  unit: string;
  eventTypes: EventType[];
}

export const trendMetricItems: TrendMetricItem[] = [
  trendItem({ en: "Feeding count", zh: "喂养次数" }, "feeding_total_count", countUnit(), ["feed_breast", "feed_bottle"]),
  trendItem({ en: "Breastfeed count", zh: "亲喂次数" }, "breast_count", countUnit(), ["feed_breast"]),
  trendItem({ en: "Breastfeed duration", zh: "亲喂时长" }, "breastfeeding_minutes_total", minuteUnit(), ["feed_breast"]),
  trendItem({ en: "Bottle ml", zh: "奶瓶 ml" }, "bottle_ml_total", "ml", ["feed_bottle"]),
  trendItem({ en: "Pee", zh: "小便" }, "pee_count", countUnit(), ["diaper_pee"]),
  trendItem({ en: "Poop", zh: "大便" }, "poop_count", countUnit(), ["diaper_poop"]),
  trendItem({ en: "Sleep duration", zh: "睡眠总时长" }, "sleep_minutes_total", minuteUnit(), ["sleep_session"]),
  trendItem({ en: "Longest sleep", zh: "最长睡眠" }, "longest_sleep_minutes", minuteUnit(), ["sleep_session"], "max"),
  trendItem({ en: "Highest temperature", zh: "最高体温" }, "temperature_max_c", "°C", ["temperature"], "max"),
  trendItem({ en: "Latest weight", zh: "最新体重" }, "latest_weight_g", "g", ["growth_measurement"], "max"),
  trendItem({ en: "Symptom count", zh: "症状次数" }, "symptom_count", countUnit(), ["symptom"])
];

export const comparisonMetricItems: ComparisonMetricItem[] = [
  comparisonItem({ en: "Feeding count", zh: "喂养次数" }, "feeding_total_count", countUnit(), ["feed_breast", "feed_bottle"]),
  comparisonItem({ en: "Breastfeed count", zh: "亲喂次数" }, "breast_count", countUnit(), ["feed_breast"]),
  comparisonItem({ en: "Breastfeed duration", zh: "亲喂时长" }, "breast_minutes_total", minuteUnit(), ["feed_breast"]),
  comparisonItem({ en: "Bottle total", zh: "奶瓶总量" }, "bottle_ml_total", "ml", ["feed_bottle"]),
  comparisonItem({ en: "Wet diapers", zh: "湿尿布" }, "pee_count", countUnit(), ["diaper_pee"]),
  comparisonItem({ en: "Poop", zh: "大便" }, "poop_count", countUnit(), ["diaper_poop"]),
  comparisonItem({ en: "Sleep duration", zh: "睡眠总时长" }, "sleep_minutes_total", minuteUnit(), ["sleep_session"]),
  comparisonItem({ en: "Longest sleep", zh: "最长睡眠" }, "longest_sleep_minutes", minuteUnit(), ["sleep_session"]),
  comparisonItem({ en: "Highest temperature", zh: "最高体温" }, "temperature_max_c", "°C", ["temperature"])
];

export function visibleTrendMetricItems(eventTypes: EventType[]): TrendMetricItem[] {
  return filterMetricItems(trendMetricItems, eventTypes);
}

export function visibleComparisonMetricItems(eventTypes: EventType[]): ComparisonMetricItem[] {
  return filterMetricItems(comparisonMetricItems, eventTypes);
}

function filterMetricItems<Item extends { eventTypes: EventType[] }>(items: Item[], eventTypes: EventType[]): Item[] {
  if (!eventTypes.length) return items;
  return items.filter((item) => item.eventTypes.some((type) => eventTypes.includes(type)));
}

function trendItem(label: LocalizedText, key: TrendMetricKey, unit: string, eventTypes: EventType[], headline?: "sum" | "max"): TrendMetricItem {
  return {
    key,
    unit,
    eventTypes,
    headline,
    get label() {
      return localizedText(label);
    }
  };
}

function comparisonItem(label: LocalizedText, key: ComparisonMetricKey, unit: string, eventTypes: EventType[]): ComparisonMetricItem {
  return {
    key,
    unit,
    eventTypes,
    get label() {
      return localizedText(label);
    }
  };
}

function countUnit(): string {
  return localizedText({ en: "times", zh: "次" });
}

function minuteUnit(): string {
  return localizedText({ en: "min", zh: "分钟" });
}
