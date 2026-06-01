import type { EventRecord, Store, TodaySummary } from "../types";
import { addDays, localDateForTimezone, overlapMinutes, utcForLocalDateStart } from "../utils/time";

export async function buildTodaySummary(store: Store, nowIso: string): Promise<TodaySummary> {
  const profile = await store.getProfile();
  const date = localDateForTimezone(nowIso, profile.timezone);
  return buildSummaryForDate(store, date, nowIso);
}

export async function buildSummaryForDate(
  store: Store,
  date: string,
  nowIso: string,
  options: { includeOpenSessions?: boolean; latestScope?: "global" | "day" } = {}
): Promise<TodaySummary> {
  const profile = await store.getProfile();
  const events = await store.listEventsByLocalDate(date);
  const openSessions =
    options.includeOpenSessions === false
      ? undefined
      : [
          ...(await store.listOpenSleepSessions()),
          ...(await store.listOpenEventsByType("feed_breast")).filter(isOpenTimedBreastSession),
          ...(await store.listOpenEventsByType("tummy_time"))
        ];
  const temperatures = events.filter((event) => event.event_type === "temperature" && event.amount_value != null);
  const medicines = events.filter((event) => event.event_type === "medicine");
  const breastEvents = events.filter((event) => event.event_type === "feed_breast");
  const bottleEvents = events.filter((event) => event.event_type === "feed_bottle");
  const latestSourceEvents = options.latestScope === "day" ? events.slice().sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)) : await store.listEvents({ limit: 200 });
  const latestTemperatureEvent = latestSourceEvents.find((event) => event.event_type === "temperature" && event.amount_value != null) ?? null;
  const latestTemperature = latestTemperatureEvent?.amount_value ?? null;
  const latestGrowthEvents = (options.latestScope === "day" ? events : latestSourceEvents).filter((event) => event.event_type === "growth_measurement" && event.amount_value != null);
  const latestMedicine = medicines.at(-1)
    ? {
        occurred_at: medicines.at(-1)!.occurred_at,
        name: medicines.at(-1)!.details_json.name ?? null,
        dose: medicines.at(-1)!.details_json.dose ?? null,
        amount_value: medicines.at(-1)!.amount_value,
        amount_unit: medicines.at(-1)!.amount_unit,
        route: medicines.at(-1)!.details_json.route ?? null
      }
    : null;
  const sleepRangeStart = utcForLocalDateStart(date, profile.timezone);
  const sleepRangeEnd = utcForLocalDateStart(addDays(date, 1), profile.timezone);
  const sleepEvents = await store.listSleepEventsOverlappingRange(sleepRangeStart, sleepRangeEnd, nowIso);
  const sleepMinutes = sleepEvents.reduce((total, event) => total + overlapMinutes(event.occurred_at, event.ended_at ?? nowIso, sleepRangeStart, sleepRangeEnd), 0);
  const systemFlags: string[] = [];
  if (temperatures.some((event) => (event.amount_value ?? 0) >= 38.0)) {
    systemFlags.push("temperature_high_neutral_notice");
  }

  return {
    date,
    feed_breast_count: breastEvents.length,
    feed_bottle_count: bottleEvents.length,
    bottle_ml_total: bottleEvents.reduce((total, event) => total + (event.amount_value ?? 0), 0),
    bottle_formula_ml_total: bottleEvents.filter((event) => event.details_json.milk_type === "formula").reduce((total, event) => total + (event.amount_value ?? 0), 0),
    bottle_breastmilk_ml_total: bottleEvents.filter((event) => event.details_json.milk_type === "breastmilk").reduce((total, event) => total + (event.amount_value ?? 0), 0),
    breast_minutes_total: breastEvents.reduce((total, event) => total + breastfeedingMinutes(event), 0),
    breast_left_minutes_total: breastEvents.reduce((total, event) => total + breastfeedingMinutesForSide(event, "left"), 0),
    breast_right_minutes_total: breastEvents.reduce((total, event) => total + breastfeedingMinutesForSide(event, "right"), 0),
    pee_count: events.filter((event) => event.event_type === "diaper_pee").length,
    poop_count: events.filter((event) => event.event_type === "diaper_poop").length,
    sleep_session_count: sleepEvents.length,
    sleep_minutes_total: sleepMinutes,
    latest_feeding_at: latestOccurredAt(latestSourceEvents, ["feed_breast", "feed_bottle"]),
    latest_breast_at: latestOccurredAt(latestSourceEvents, ["feed_breast"]),
    latest_bottle_at: latestOccurredAt(latestSourceEvents, ["feed_bottle"]),
    latest_pee_at: latestOccurredAt(latestSourceEvents, ["diaper_pee"]),
    latest_poop_at: latestOccurredAt(latestSourceEvents, ["diaper_poop"]),
    latest_temperature_c: latestTemperature,
    latest_temperature:
      latestTemperatureEvent && latestTemperature != null
        ? {
            value_c: latestTemperature,
            occurred_at: latestTemperatureEvent.occurred_at,
            method: latestTemperatureEvent.details_json.method ?? null
          }
        : null,
    latest_medicine: latestMedicine,
    growth: growthSummary(latestGrowthEvents),
    ...(openSessions ? { open_sessions: openSessions } : {}),
    system_flags: systemFlags
  };
}

function isOpenTimedBreastSession(event: EventRecord): boolean {
  return event.event_type === "feed_breast" && !event.ended_at && event.details_json.session_mode === "timed" && numericDetail(event.details_json.duration_min) <= 0;
}

function numericDetail(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function buildLast7DaysSummary(store: Store, nowIso: string) {
  const profile = await store.getProfile();
  const today = localDateForTimezone(nowIso, profile.timezone);
  const dates = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6));
  return Promise.all(dates.map((date) => buildSummaryForDate(store, date, nowIso, { includeOpenSessions: false, latestScope: "day" })));
}

function latestOccurredAt(events: EventRecord[], eventTypes: string[]): string | null {
  return events.find((event) => eventTypes.includes(event.event_type))?.occurred_at ?? null;
}

function breastfeedingMinutes(event: EventRecord): number {
  const duration = numericDetail(event.details_json.duration_min);
  if (duration > 0) return duration;
  if (event.ended_at) return Math.max(0, Math.round((Date.parse(event.ended_at) - Date.parse(event.occurred_at)) / 60000));
  return 0;
}

function breastfeedingMinutesForSide(event: EventRecord, side: "left" | "right"): number {
  const minutes = breastfeedingMinutes(event);
  if (event.details_json.side === side) return minutes;
  if (event.details_json.side === "both") return minutes / 2;
  return 0;
}

function growthSummary(events: EventRecord[]): TodaySummary["growth"] {
  const sorted = events.slice().sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  const latestEvent = [...sorted].reverse().find((item) => item.amount_value != null) ?? null;
  const latestMeasureType = growthMeasureType(latestEvent?.details_json.measure_type);
  return {
    latest_weight_g: latestGrowthValue(sorted, "weight_kg", (value) => Math.round(value * 1000)),
    latest_length_cm: latestGrowthValue(sorted, "length_cm", (value) => value),
    latest_head_circumference_cm: latestGrowthValue(sorted, "head_circumference_cm", (value) => value),
    latest_measure_type: latestMeasureType,
    latest_value: latestEvent?.amount_value ?? null,
    latest_at: latestEvent?.occurred_at ?? null
  };
}

function latestGrowthValue(events: EventRecord[], measureType: string, transform: (value: number) => number): number | null {
  const event = [...events].reverse().find((item) => item.details_json.measure_type === measureType && item.amount_value != null);
  return event?.amount_value == null ? null : transform(event.amount_value);
}

function growthMeasureType(value: unknown): TodaySummary["growth"]["latest_measure_type"] {
  if (value === "weight_kg" || value === "length_cm" || value === "head_circumference_cm") return value;
  return null;
}
