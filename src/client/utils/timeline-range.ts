import type { EventType } from "../types";

export type TimelinePreset = "last_24h" | "today" | "yesterday" | "last_3d" | "last_7d" | "last_14d" | "last_30d" | "custom";

const knownPresets = new Set<TimelinePreset>(["last_24h", "today", "yesterday", "last_3d", "last_7d", "last_14d", "last_30d", "custom"]);

export function isPreset(value: string | null): value is TimelinePreset {
  return value != null && knownPresets.has(value as TimelinePreset);
}

export function presetFromParams(params: URLSearchParams): TimelinePreset {
  const rawPreset = params.get("preset");
  if (rawPreset === "custom") return "custom";
  if (params.get("start_date") || params.get("end_date")) return "custom";
  if (isPreset(rawPreset)) return rawPreset;
  return presetFromDays(params.get("days"));
}

export function buildRangeQuery(preset: TimelinePreset, startDate: string, endDate: string, eventTypes: EventType[]): string {
  const query = new URLSearchParams();
  if (preset === "custom") {
    query.set("preset", "custom");
    const normalized = normalizeCustomDates(startDate, endDate);
    if (normalized) {
      query.set("start_date", normalized.start_date);
      query.set("end_date", normalized.end_date);
    }
  } else {
    query.set("preset", preset);
  }
  if (eventTypes.length) query.set("event_types", eventTypes.join(","));
  return query.toString();
}

export function summaryQuery(preset: TimelinePreset, startDate: string, endDate: string, eventTypes: EventType[] = []): string {
  const query = new URLSearchParams();
  if (preset === "custom") {
    query.set("preset", "custom");
    const normalized = normalizeCustomDates(startDate, endDate);
    if (normalized) {
      query.set("start_date", normalized.start_date);
      query.set("end_date", normalized.end_date);
    }
  } else {
    query.set("preset", preset);
    if (preset === "last_3d") query.set("range", "3d");
    else if (preset === "last_7d") query.set("range", "7d");
    else query.set("range", "24h");
  }
  if (eventTypes.length) query.set("event_types", eventTypes.join(","));
  return query.toString();
}

export function hasCustomDateSelection(preset: TimelinePreset, startDate: string, endDate: string): boolean {
  return preset !== "custom" || Boolean(startDate || endDate);
}

function normalizeCustomDates(startDate: string, endDate: string): { start_date: string; end_date: string } | null {
  const start = startDate || endDate;
  const end = endDate || startDate;
  return start && end ? { start_date: start, end_date: end } : null;
}

function presetFromDays(days: string | null): TimelinePreset {
  if (days === "3") return "last_3d";
  if (days === "14") return "last_14d";
  if (days === "30") return "last_30d";
  return "last_7d";
}
