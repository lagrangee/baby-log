import type { DisplayEventRecord, EventType, JsonRecord, PrimaryEventType } from "../types";
import { getCurrentLanguage, type Language } from "../i18n";
import { formatDuration, minutesBetween } from "./time";

type LocalizedText = Record<Language, string>;

const eventLabels: Record<EventType, LocalizedText> = {
  feed_breast: { en: "Breastfeed", zh: "母乳" },
  feed_bottle: { en: "Bottle", zh: "奶瓶" },
  diaper_pee: { en: "Pee", zh: "小便" },
  diaper_poop: { en: "Poop", zh: "大便" },
  sleep_session: { en: "Sleep", zh: "睡眠" },
  temperature: { en: "Temperature", zh: "体温" },
  medicine: { en: "Medicine", zh: "用药" },
  note: { en: "Note", zh: "备注" },
  symptom: { en: "Symptom", zh: "症状" },
  tummy_time: { en: "Tummy time", zh: "趴趴时间" },
  growth_measurement: { en: "Growth", zh: "生长测量" }
};

const categoryLabels: Record<string, LocalizedText> = {
  feeding: { en: "Feeding", zh: "喂养" },
  diaper: { en: "Diaper", zh: "尿布" },
  sleep: { en: "Sleep", zh: "睡眠" },
  health: { en: "Health", zh: "健康" },
  note: { en: "Log", zh: "记录" }
};

const actionMarks: Record<PrimaryEventType, LocalizedText> = {
  feed_breast: { en: "BF", zh: "乳" },
  feed_bottle: { en: "BT", zh: "瓶" },
  diaper_pee: { en: "P", zh: "尿" },
  diaper_poop: { en: "BM", zh: "便" },
  sleep_session: { en: "SL", zh: "眠" },
  temperature: { en: "T", zh: "温" },
  medicine: { en: "Rx", zh: "药" },
  note: { en: "N", zh: "记" }
};

const primaryActionTypes: Array<{ type: PrimaryEventType; category: keyof typeof categoryLabels }> = [
  { type: "feed_breast", category: "feeding" },
  { type: "feed_bottle", category: "feeding" },
  { type: "diaper_pee", category: "diaper" },
  { type: "diaper_poop", category: "diaper" },
  { type: "sleep_session", category: "sleep" },
  { type: "temperature", category: "health" },
  { type: "medicine", category: "health" },
  { type: "note", category: "note" }
];

export const PRIMARY_ACTIONS: ReadonlyArray<{ type: PrimaryEventType; label: string; category: string; mark: string }> = primaryActionTypes.map((item) => ({
  type: item.type,
  get label() {
    return localized(eventLabels[item.type]);
  },
  get category() {
    return localized(categoryLabels[item.category]);
  },
  get mark() {
    return localized(actionMarks[item.type]);
  }
}));

export const SECONDARY_ACTIONS: ReadonlyArray<{ type: EventType; label: string }> = (["symptom", "tummy_time"] as EventType[]).map((type) => ({
  type,
  get label() {
    return localized(eventLabels[type]);
  }
}));

export const EVENT_LABELS: Record<EventType, string> = new Proxy({} as Record<EventType, string>, {
  get(_target, property) {
    return typeof property === "string" && property in eventLabels ? localized(eventLabels[property as EventType]) : undefined;
  },
  has(_target, property) {
    return typeof property === "string" && property in eventLabels;
  },
  ownKeys() {
    return Object.keys(eventLabels);
  },
  getOwnPropertyDescriptor(_target, property) {
    return typeof property === "string" && property in eventLabels ? { enumerable: true, configurable: true } : undefined;
  }
});

const colorLabels: Record<string, LocalizedText> = {
  black_tar: { en: "black/tarry", zh: "黑色柏油样" },
  green: { en: "green", zh: "绿色" },
  yellow: { en: "yellow", zh: "黄色" },
  brown: { en: "brown", zh: "棕色" },
  red: { en: "red", zh: "红色" },
  white: { en: "white", zh: "白色" },
  other: { en: "other", zh: "其他" }
};

const textureLabels: Record<string, LocalizedText> = {
  watery: { en: "watery", zh: "水样" },
  loose: { en: "loose", zh: "稀" },
  seedy: { en: "seedy", zh: "颗粒" },
  pasty: { en: "pasty", zh: "糊状" },
  hard: { en: "hard", zh: "硬" },
  mucus: { en: "mucus", zh: "黏液" },
  other: { en: "other", zh: "其他" }
};

export function eventLabel(type: string): string {
  return type in EVENT_LABELS ? EVENT_LABELS[type as EventType] : type;
}

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

export function formatTemperature(value: number | null): string {
  return value == null ? "—" : `${formatNumber(value)} °C`;
}

export function formatMetricDelta(delta: number | null, unit = ""): string {
  if (delta == null) return "—";
  const prefix = delta > 0 ? "+" : "";
  return `${prefix}${formatNumber(delta)}${unit ? ` ${unit}` : ""}`;
}

export function formatEventValue(event: DisplayEventRecord): string {
  const details = event.details_json ?? {};
  switch (event.event_type) {
    case "feed_bottle":
      return compact([event.amount_value == null ? eventLabel("feed_bottle") : `${formatNumber(event.amount_value)} ml`, milkTypeLabel(details.milk_type)]).join(" · ");
    case "feed_breast":
      return compact([sideLabel(details.side), breastfeedingDurationLabel(event)]).join(" · ") || eventLabel("feed_breast");
    case "diaper_poop":
      return compact([valueLabel(details.color, colorLabels), valueLabel(details.texture, textureLabels)]).join(" · ") || eventLabel("diaper_poop");
    case "sleep_session":
      return event.ended_at ? formatDuration(minutesBetween(event.occurred_at, event.ended_at)) : text({ en: "In progress", zh: "进行中" });
    case "temperature":
      return formatTemperature(event.amount_value);
    case "growth_measurement":
      return compact([growthTypeLabel(details.measure_type), event.amount_value == null ? "" : formatGrowthAmount(event.amount_value, details.measure_type), growthUnit(details.measure_type)]).join(" ");
    case "symptom":
      return compact([severityLabel(details.severity), symptomTags(details.symptom_tags), event.note ? trim(event.note, 24) : ""]).join(" · ");
    case "tummy_time":
      return compact([numericDetail(details.duration_min, text({ en: "min", zh: "分钟" })), event.ended_at ? formatDuration(minutesBetween(event.occurred_at, event.ended_at)) : ""]).join(" · ") || eventLabel("tummy_time");
    case "medicine":
      return compact([
        typeof details.name === "string" ? details.name : "",
        typeof details.dose === "string" ? details.dose : medicineAmount(event)
      ]).join(" · ") || eventLabel("medicine");
    case "note":
      return event.note ? trim(event.note, 28) : eventLabel("note");
    default:
      return compact([event.amount_value == null ? "" : formatNumber(event.amount_value), event.amount_unit ?? "", event.note ? trim(event.note, 24) : ""]).join(" ");
  }
}

export function temperatureMethodLabel(value: unknown): string {
  if (value === "rectal") return text({ en: "rectal", zh: "肛温" });
  if (value === "ear") return text({ en: "ear", zh: "耳温" });
  if (value === "forehead") return text({ en: "forehead", zh: "额温" });
  if (value === "armpit") return text({ en: "armpit", zh: "腋温" });
  if (value === "oral") return text({ en: "oral", zh: "口温" });
  if (value === "other") return text({ en: "other", zh: "其他" });
  return text({ en: "not set", zh: "未填" });
}

export function detailText(details: JsonRecord, key: string): string {
  const value = details[key];
  return typeof value === "string" ? value.trim() : "";
}

function medicineAmount(event: DisplayEventRecord): string {
  if (event.amount_value == null && !event.amount_unit) return "";
  return compact([event.amount_value == null ? "" : formatNumber(event.amount_value), event.amount_unit ?? ""]).join(" ");
}

function numericDetail(value: unknown, unit: string): string {
  return typeof value === "number" && Number.isFinite(value) ? `${formatNumber(value)} ${unit}` : "";
}

function breastfeedingDurationLabel(event: DisplayEventRecord): string {
  const recordedDuration = event.details_json.duration_min;
  if (typeof recordedDuration === "number" && Number.isFinite(recordedDuration) && recordedDuration > 0) {
    return `${formatNumber(recordedDuration)} ${text({ en: "min", zh: "分钟" })}`;
  }
  return event.ended_at ? formatDuration(minutesBetween(event.occurred_at, event.ended_at)) : "";
}

function sideLabel(value: unknown): string {
  if (value === "left") return text({ en: "left", zh: "左侧" });
  if (value === "right") return text({ en: "right", zh: "右侧" });
  if (value === "both") return text({ en: "both", zh: "双侧" });
  if (value === "unknown") return text({ en: "side unknown", zh: "侧别不确定" });
  return "";
}

function milkTypeLabel(value: unknown): string {
  if (value === "formula") return text({ en: "formula", zh: "配方奶" });
  if (value === "breastmilk") return text({ en: "expressed milk", zh: "母乳瓶喂" });
  if (value === "mixed") return text({ en: "mixed", zh: "混合" });
  if (value === "other") return text({ en: "other", zh: "其他" });
  return "";
}

function growthTypeLabel(value: unknown): string {
  if (value === "weight_kg") return text({ en: "weight", zh: "体重" });
  if (value === "length_cm") return text({ en: "length", zh: "身长" });
  if (value === "head_circumference_cm") return text({ en: "head circumference", zh: "头围" });
  return "";
}

function growthUnit(value: unknown): string {
  if (value === "weight_kg") return "kg";
  if (value === "length_cm" || value === "head_circumference_cm") return "cm";
  return "";
}

function formatGrowthAmount(value: number, measureType: unknown): string {
  if (measureType === "weight_kg") {
    return value.toFixed(3).replace(/\.?0+$/, "");
  }
  return formatNumber(value);
}

function severityLabel(value: unknown): string {
  if (value === "mild") return text({ en: "mild", zh: "轻微" });
  if (value === "moderate") return text({ en: "moderate", zh: "中等" });
  if (value === "severe") return text({ en: "severe", zh: "较重" });
  if (value === "unknown") return text({ en: "unrated", zh: "未分级" });
  return "";
}

function symptomTags(value: unknown): string {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean).join(text({ en: ", ", zh: "、" })) : "";
}

function valueLabel(value: unknown, labels: Record<string, LocalizedText>): string {
  return typeof value === "string" ? (labels[value] ? localized(labels[value]) : value) : "";
}

function compact(values: Array<string | null | undefined>): string[] {
  return values.map((item) => item?.trim() ?? "").filter(Boolean);
}

function trim(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}...` : value;
}

function localized(value: LocalizedText): string {
  return value[getCurrentLanguage()];
}

function text(value: LocalizedText): string {
  return localized(value);
}
