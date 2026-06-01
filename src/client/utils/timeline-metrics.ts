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
  { label: "喂养次数", key: "feeding_total_count", unit: "次", eventTypes: ["feed_breast", "feed_bottle"] },
  { label: "亲喂次数", key: "breast_count", unit: "次", eventTypes: ["feed_breast"] },
  { label: "亲喂时长", key: "breastfeeding_minutes_total", unit: "分钟", eventTypes: ["feed_breast"] },
  { label: "奶瓶 ml", key: "bottle_ml_total", unit: "ml", eventTypes: ["feed_bottle"] },
  { label: "小便", key: "pee_count", unit: "次", eventTypes: ["diaper_pee"] },
  { label: "大便", key: "poop_count", unit: "次", eventTypes: ["diaper_poop"] },
  { label: "睡眠总时长", key: "sleep_minutes_total", unit: "分钟", eventTypes: ["sleep_session"] },
  { label: "最长睡眠", key: "longest_sleep_minutes", unit: "分钟", headline: "max", eventTypes: ["sleep_session"] },
  { label: "最高体温", key: "temperature_max_c", unit: "°C", headline: "max", eventTypes: ["temperature"] },
  { label: "最新体重", key: "latest_weight_g", unit: "g", headline: "max", eventTypes: ["growth_measurement"] },
  { label: "症状次数", key: "symptom_count", unit: "次", eventTypes: ["symptom"] }
];

export const comparisonMetricItems: ComparisonMetricItem[] = [
  { label: "喂养次数", key: "feeding_total_count", unit: "次", eventTypes: ["feed_breast", "feed_bottle"] },
  { label: "亲喂次数", key: "breast_count", unit: "次", eventTypes: ["feed_breast"] },
  { label: "亲喂时长", key: "breast_minutes_total", unit: "分钟", eventTypes: ["feed_breast"] },
  { label: "奶瓶总量", key: "bottle_ml_total", unit: "ml", eventTypes: ["feed_bottle"] },
  { label: "湿尿布", key: "pee_count", unit: "次", eventTypes: ["diaper_pee"] },
  { label: "大便", key: "poop_count", unit: "次", eventTypes: ["diaper_poop"] },
  { label: "睡眠总时长", key: "sleep_minutes_total", unit: "分钟", eventTypes: ["sleep_session"] },
  { label: "最长睡眠", key: "longest_sleep_minutes", unit: "分钟", eventTypes: ["sleep_session"] },
  { label: "最高体温", key: "temperature_max_c", unit: "°C", eventTypes: ["temperature"] }
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
