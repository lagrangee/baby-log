import { isAllowedEventType, ValidationError, type EventType } from "../../shared/content";
import type { AppProfile, EventRecord, Store } from "../types";
import { addDays, isValidDateOnly, localDateForTimezone, minutesBetween, utcForLocalDateStart } from "../utils/time";
import { ChecklistService } from "./checklist-service";
import { buildLast7DaysSummary, buildTodaySummary } from "./summary-service";
import { getStableChildFacts } from "./stable-child-facts-service";
import { buildStatusOverview, buildStatusRangeAnalytics } from "./status-service";

export const MACHINE_PAYLOAD_VERSION = "chatgpt_automation_1";
export const MACHINE_CAPABILITIES = {
  has_days_endpoint: true,
  has_events_endpoint: true,
  max_days_range: 60,
  default_days_range: 7,
  max_events_limit: 1000,
  default_events_limit: 300,
  supports_event_type_filter: true,
  supports_cursor_pagination: false
} as const;

const RECENT_EVENTS_LIMIT = 30;

export class InvalidMachineTokenError extends Error {}

export async function buildMachinePayload(store: Store, token: string, nowIso: string) {
  const profile = await requireValidMachineToken(store, token);
  const schemaVersion = (await store.getMeta("schema_version")) ?? "1";
  const todayDate = localDateForTimezone(nowIso, profile.timezone);
  const recentEvents = await store.listEvents({ since: isoMinusDays(nowIso, 30), until: nowIso, limit: RECENT_EVENTS_LIMIT });
  const openChecklists = (await new ChecklistService(store).listSections(nowIso)).current.slice(0, 20);
  const recentMilestones = await store.listMilestones({ limit: 10 });
  const overview = await buildStatusOverview(store, nowIso, MACHINE_CAPABILITIES.default_days_range);
  const rolling24h = await buildStatusRangeAnalytics(store, nowIso, { preset: "last_24h" });
  const dataRange = await store.getEventRangeMeta();
  const latestEvents = await store.listEvents({ until: nowIso, limit: 200 });

  return {
    schema_version: schemaVersion,
    machine_payload_version: MACHINE_PAYLOAD_VERSION,
    generated_at: nowIso,
    timezone: profile.timezone,
    profile: machineProfile(profile),
    stable_child_facts: await getStableChildFacts(store),
    age_context: ageContext(profile, todayDate),
    data_range: dataRange,
    capabilities: MACHINE_CAPABILITIES,
    latest_global: latestGlobal(latestEvents, nowIso),
    rolling_24h: {
      range: rolling24h.range,
      ...rolling24h.summary
    },
    today_so_far: {
      local_date: todayDate,
      summary: overview.today
    },
    open_sessions: Object.values(overview.active_state).filter(Boolean),
    data_quality: overview.data_quality,
    mechanical_flags: mechanicalFlags(overview.data_quality, rolling24h.summary),
    reference_targets: overview.reference_targets,
    recent_events_preview: recentEvents.map(trimMachineEvent),
    event_window_meta: eventWindowMeta(recentEvents, dataRange.event_count),
    links: buildMachineLinks(token, nowIso, profile),
    today_summary: await buildTodaySummary(store, nowIso),
    last_7_days_summary: await buildLast7DaysSummary(store, nowIso),
    recent_events: recentEvents.map(trimMachineEvent),
    open_checklists: openChecklists.map((item) => ({
      id: item.id,
      item_type: item.item_type,
      title: item.title,
      description: item.description,
      phase: item.phase,
      source_basis: item.source_basis,
      template_code: item.template_code,
      template_item_key: item.template_item_key,
      due_date: item.due_date,
      priority: item.priority,
      status: item.status
    })),
    recent_milestones: recentMilestones.map((item) => ({
      id: item.id,
      milestone_type: item.milestone_type,
      title: item.title,
      observed_on: item.observed_on,
      note: trimNote(item.note)
    }))
  };
}

export async function buildMachineDaysPayload(store: Store, token: string, nowIso: string, options: { from?: string | null; to?: string | null } = {}) {
  const profile = await requireValidMachineToken(store, token);
  const todayDate = localDateForTimezone(nowIso, profile.timezone);
  const to = options.to || todayDate;
  const from = options.from || addDays(to, -(MACHINE_CAPABILITIES.default_days_range - 1));
  validateDateRange(from, to, MACHINE_CAPABILITIES.max_days_range);

  const analytics = await buildStatusRangeAnalytics(store, nowIso, { start_date: from, end_date: to });
  const days = analytics.days.map((day) => ({
    ...day,
    ...ageContext(profile, day.local_date)
  }));
  return {
    machine_payload_version: MACHINE_PAYLOAD_VERSION,
    generated_at: nowIso,
    timezone: profile.timezone,
    range: {
      from,
      to,
      day_count: diffLocalDates(from, to) + 1
    },
    profile: machineProfile(profile),
    days,
    series: {
      local_dates: days.map((day) => day.local_date),
      feeding_total_count: days.map((day) => day.feeding.total_count),
      bottle_ml_total: days.map((day) => day.feeding.bottle_ml_total),
      pee_count: days.map((day) => day.diaper.pee_count),
      poop_count: days.map((day) => day.diaper.poop_count),
      sleep_minutes_total: days.map((day) => day.sleep.minutes_total),
      temperature_max_c: days.map((day) => day.temperature.max_c),
      latest_weight_g: days.map((day) => day.growth.latest_weight_g)
    },
    links: {
      current: currentPath(token),
      events_for_range: `${eventsPath(token)}?since=${encodeURIComponent(utcForLocalDateStart(from, profile.timezone))}&until=${encodeURIComponent(
        utcForLocalDateStart(addDays(to, 1), profile.timezone)
      )}&limit=${MACHINE_CAPABILITIES.max_events_limit}`
    }
  };
}

export async function buildMachineEventsPayload(
  store: Store,
  token: string,
  nowIso: string,
  options: { since?: string | null; until?: string | null; limit?: number | null; event_type?: string | null } = {}
) {
  const profile = await requireValidMachineToken(store, token);
  const since = options.since || isoMinusHours(nowIso, 24);
  const until = options.until || nowIso;
  validateIsoRange(since, until);
  const limit = validateEventsLimit(options.limit ?? MACHINE_CAPABILITIES.default_events_limit);
  const eventType = validateEventType(options.event_type);
  const fetched = await store.listEventsInUtcRange(since, until, { event_type: eventType, limit: limit + 1 });
  const events = fetched.slice(0, limit);
  const fromDate = localDateForTimezone(since, profile.timezone);
  const toDate = localDateForTimezone(until, profile.timezone);

  return {
    machine_payload_version: MACHINE_PAYLOAD_VERSION,
    generated_at: nowIso,
    timezone: profile.timezone,
    range: {
      since,
      until
    },
    filters: {
      event_type: eventType ?? null,
      limit
    },
    events: events.map(trimMachineEvent),
    pagination: {
      has_more: fetched.length > limit,
      next_cursor: null
    },
    links: {
      current: currentPath(token),
      days_for_range: `${daysPath(token)}?from=${fromDate}&to=${toDate}`
    }
  };
}

export async function requireValidMachineToken(store: Store, token: string): Promise<AppProfile> {
  const profile = await store.getProfile();
  if (!profile.machine_token || token !== profile.machine_token) {
    throw new InvalidMachineTokenError("Invalid machine token");
  }
  return profile;
}

export function trimMachineEvent(event: EventRecord) {
  return {
    id: event.id,
    category: event.category,
    event_type: event.event_type,
    occurred_at: event.occurred_at,
    ended_at: event.ended_at,
    local_date: event.local_date,
    amount_value: event.amount_value,
    amount_unit: event.amount_unit,
    note: trimNote(event.note),
    details_json: trimDetails(event.details_json),
    source: event.source,
    created_by: event.created_by,
    created_at: event.created_at,
    updated_at: event.updated_at
  };
}

function buildMachineLinks(token: string, nowIso: string, profile: AppProfile) {
  const todayDate = localDateForTimezone(nowIso, profile.timezone);
  const from = addDays(todayDate, -(MACHINE_CAPABILITIES.default_days_range - 1));
  const since = isoMinusHours(nowIso, 24);
  return {
    current: currentPath(token),
    days_7d: `${daysPath(token)}?from=${from}&to=${todayDate}`,
    events_24h: `${eventsPath(token)}?since=${encodeURIComponent(since)}&until=${encodeURIComponent(nowIso)}&limit=500`
  };
}

function currentPath(token: string) {
  return `/machine/v1/${token}/current.json`;
}

function daysPath(token: string) {
  return `/machine/v1/${token}/days.json`;
}

function eventsPath(token: string) {
  return `/machine/v1/${token}/events.json`;
}

function machineProfile(profile: AppProfile) {
  return {
    child_name: profile.child_name,
    child_birth_date: profile.child_birth_date,
    due_date: profile.due_date,
    timezone: profile.timezone,
    phase: profile.phase
  };
}

function ageContext(profile: AppProfile, localDate: string) {
  const ageDays = profile.child_birth_date ? diffLocalDates(profile.child_birth_date, localDate) : null;
  return {
    age_days: ageDays,
    birth_day_number: ageDays == null ? null : ageDays + 1,
    days_to_due: !profile.child_birth_date && profile.due_date ? diffLocalDates(localDate, profile.due_date) : null
  };
}

function latestGlobal(events: EventRecord[], nowIso: string) {
  const latest = (predicate: (event: EventRecord) => boolean) => events.find(predicate) ?? null;
  const feeding = latest((event) => event.event_type === "feed_breast" || event.event_type === "feed_bottle");
  const pee = latest((event) => event.event_type === "diaper_pee");
  const poop = latest((event) => event.event_type === "diaper_poop");
  const temperature = latest((event) => event.event_type === "temperature" && event.amount_value != null);
  const weight = latest((event) => event.event_type === "growth_measurement" && event.details_json.kind === "weight" && event.amount_value != null);
  const length = latest((event) => event.event_type === "growth_measurement" && event.details_json.kind === "length" && event.amount_value != null);
  const head = latest((event) => event.event_type === "growth_measurement" && event.details_json.kind === "head_circumference" && event.amount_value != null);
  return {
    feeding: feeding ? latestEventSnapshot(feeding, nowIso) : null,
    pee: pee ? latestEventSnapshot(pee, nowIso) : null,
    poop: poop ? latestEventSnapshot(poop, nowIso) : null,
    temperature: temperature
      ? {
          event_id: temperature.id,
          value_c: temperature.amount_value,
          occurred_at: temperature.occurred_at,
          elapsed_hours: roundedHours(temperature.occurred_at, nowIso),
          method: typeof temperature.details_json.method === "string" ? temperature.details_json.method : null
        }
      : { event_id: null, value_c: null, occurred_at: null, elapsed_hours: null, method: null },
    weight: growthSnapshot(weight, nowIso, "g"),
    length: growthSnapshot(length, nowIso, "cm"),
    head_circumference: growthSnapshot(head, nowIso, "cm")
  };
}

function latestEventSnapshot(event: EventRecord, nowIso: string) {
  return {
    event_id: event.id,
    event_type: event.event_type,
    occurred_at: event.occurred_at,
    elapsed_minutes: minutesBetween(event.occurred_at, nowIso),
    amount_value: event.amount_value,
    amount_unit: event.amount_unit
  };
}

function growthSnapshot(event: EventRecord | null, nowIso: string, unit: string) {
  return event
    ? {
        event_id: event.id,
        value: event.amount_value,
        unit,
        occurred_at: event.occurred_at,
        elapsed_hours: roundedHours(event.occurred_at, nowIso)
      }
    : { event_id: null, value: null, unit, occurred_at: null, elapsed_hours: null };
}

function mechanicalFlags(dataQuality: Array<{ code: string; related_event_id?: string }>, rolling24h: { temperature: { max_c: number | null; latest_occurred_at: string | null } }) {
  const flags: Array<{ code: string; severity: "warning" | "red_flag"; evidence: Record<string, unknown>; message: string }> = dataQuality
    .filter((flag) => flag.code === "open_sleep_session_long" || flag.code === "open_breast_session_long" || flag.code === "open_tummy_time_session_long")
    .map((flag) => ({
      code: flag.code,
      severity: "warning",
      evidence: { related_event_id: flag.related_event_id ?? null },
      message: "记录中存在开放时间较长的 session。"
    }));
  if ((rolling24h.temperature.max_c ?? 0) >= 38.0) {
    flags.push({
      code: "temperature_recorded_high",
      severity: "red_flag",
      evidence: {
        value_c: rolling24h.temperature.max_c,
        occurred_at: rolling24h.temperature.latest_occurred_at
      },
      message: "记录到体温 >= 38.0°C。"
    });
  }
  return flags;
}

function eventWindowMeta(recentEvents: EventRecord[], totalEventCount: number) {
  return {
    recent_events_limit: RECENT_EVENTS_LIMIT,
    oldest_recent_event_at: recentEvents.at(-1)?.occurred_at ?? null,
    newest_recent_event_at: recentEvents[0]?.occurred_at ?? null,
    has_more_recent_events: totalEventCount > recentEvents.length
  };
}

function validateDateRange(from: string, to: string, maxDays: number) {
  if (!isValidDateOnly(from) || !isValidDateOnly(to)) throw new ValidationError("from and to must be YYYY-MM-DD");
  if (from > to) throw new ValidationError("from must be before or equal to to");
  if (diffLocalDates(from, to) + 1 > maxDays) throw new ValidationError(`machine days range must be ${maxDays} days or less`);
}

function validateIsoRange(since: string, until: string) {
  const sinceTime = Date.parse(since);
  const untilTime = Date.parse(until);
  if (Number.isNaN(sinceTime) || Number.isNaN(untilTime)) throw new ValidationError("since and until must be ISO datetimes");
  if (sinceTime > untilTime) throw new ValidationError("since must be before or equal to until");
}

function validateEventsLimit(value: number | null): number {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit < 1 || Math.floor(limit) !== limit) throw new ValidationError("limit must be a positive integer");
  if (limit > MACHINE_CAPABILITIES.max_events_limit) throw new ValidationError(`limit must be <= ${MACHINE_CAPABILITIES.max_events_limit}`);
  return limit;
}

function validateEventType(value: string | null | undefined): EventType | undefined {
  if (!value) return undefined;
  if (!isAllowedEventType(value)) throw new ValidationError(`event_type is not allowed: ${value}`);
  return value;
}

function trimNote(note: string | null): string | null {
  if (!note) return null;
  return note.length > 160 ? `${note.slice(0, 157)}...` : note;
}

function trimDetails(details: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(details).filter(([, value]) => typeof value !== "string" || value.length <= 160));
}

function isoMinusHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() - hours * 60 * 60 * 1000).toISOString().replace(".000Z", "Z");
}

function isoMinusDays(iso: string, days: number): string {
  return isoMinusHours(iso, days * 24);
}

function roundedHours(startIso: string, endIso: string) {
  return Math.round((minutesBetween(startIso, endIso) / 60) * 10) / 10;
}

function diffLocalDates(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00Z`).getTime();
  const to = new Date(`${toDate}T00:00:00Z`).getTime();
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}
