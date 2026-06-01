import { getEventDefinition, ValidationError, type EventType } from "../../shared/content";
import type { AppProfile, EventRecord, Store, TodaySummary } from "../types";
import { addDays, isValidDateOnly, localDateForTimezone, minutesBetween, overlapMinutes, utcForLocalDateStart } from "../utils/time";
import { buildSummaryForDate } from "./summary-service";
import { buildReferenceTargets, type EvaluatedReferenceTarget, type ReferenceTargetsBlock } from "./reference-target-service";

export interface StatusDailySummary {
  local_date: string;
  feeding: {
    breast_count: number;
    breast_minutes_total: number;
    breast_open_session_count: number;
    breast_latest_at: string | null;
    bottle_count: number;
    bottle_ml_total: number;
    bottle_latest_at: string | null;
    formula_ml_total: number;
    breastmilk_bottle_ml_total: number;
    mixed_or_other_ml_total: number;
    average_bottle_ml_per_feed: number | null;
    total_count: number;
    latest_feeding_at: string | null;
    latest_feeding_type: "feed_breast" | "feed_bottle" | null;
  };
  diaper: {
    pee_count: number;
    poop_count: number;
    latest_diaper_at: string | null;
    latest_pee_at: string | null;
    latest_poop_at: string | null;
    poop_colors: Record<string, number>;
    poop_textures: Record<string, number>;
  };
  sleep: {
    session_count: number;
    minutes_total: number;
    longest_minutes: number;
    open_session_count: number;
  };
  temperature: {
    latest_c: number | null;
    latest_occurred_at: string | null;
    latest_method: string | null;
    latest_event_id: string | null;
    max_c: number | null;
    count: number;
  };
  tummy_time: {
    session_count: number;
    minutes_total: number;
    open_session_count: number;
  };
  growth: {
    latest_weight_g: number | null;
    latest_length_cm: number | null;
    latest_head_circumference_cm: number | null;
  };
  symptoms: {
    count: number;
    by_severity: Record<string, number>;
    tags: Record<string, number>;
  };
  medicines: {
    count: number;
    latest: Record<string, unknown> | null;
  };
  notes: {
    count: number;
  };
}

export interface DataQualityFlag {
  code:
    | "open_sleep_session_long"
    | "open_tummy_time_session_long"
    | "open_breast_session_long"
    | "no_records_today_after_birth"
    | "missing_bottle_amount"
    | "growth_unit_unusual"
    | "temperature_value_unusual"
    | "temperature_recorded_high";
  severity: "info" | "warning";
  message: string;
  related_event_id?: string;
}

export interface ActiveSession {
  id: string;
  event_type: EventType;
  occurred_at: string;
  elapsed_minutes: number;
  note: string | null;
  details_json: Record<string, unknown>;
}

export interface StatusOverviewResponse {
  generated_at: string;
  profile: {
    child_name: string | null;
    child_birth_date: string | null;
    due_date: string | null;
    timezone: string;
    phase: string;
    age_days: number | null;
    birth_day_number: number | null;
    days_to_due: number | null;
  };
  active_state: {
    open_sleep_session: ActiveSession | null;
    open_tummy_time_session: ActiveSession | null;
    open_breast_session: ActiveSession | null;
  };
  today: StatusDailySummary;
  last_7_days: StatusDailySummary[];
  trend_summary: StatusTrendSummary;
  data_quality: DataQualityFlag[];
  birth_ready: BirthReadyOverview | null;
  first_week: FirstWeekOverview | null;
  reference_targets: ReferenceTargetsBlock;
}

export type StatusDayPreset = "today" | "yesterday";

export interface StatusDayResponse {
  generated_at: string;
  preset: StatusDayPreset;
  local_date: string;
  profile: {
    child_name: string | null;
    child_birth_date: string | null;
    due_date: string | null;
    timezone: string;
    phase: string;
  };
  summary: TodaySummary;
  events: EventRecord[];
}

export interface StatusEventPreview {
  id: string;
  event_type: EventType;
  occurred_at: string;
  amount_value: number | null;
  amount_unit: string | null;
  note: string | null;
  details_json: Record<string, unknown>;
}

export interface BirthReadyOverview {
  child_birth_date: string;
  birth_day_number: number;
  latest_feeding: StatusEventPreview | null;
  latest_diaper: StatusEventPreview | null;
  latest_temperature_c: number | null;
  latest_temperature: {
    value_c: number;
    occurred_at: string;
    method: string | null;
  } | null;
  latest_weight_g: number | null;
  checklist_templates: {
    birth_hospital: ChecklistTemplatePresence;
    first_week: ChecklistTemplatePresence;
  };
}

export interface ChecklistTemplatePresence {
  template_code: "aap_birth_hospital_v1" | "aap_first_week_v1";
  title: string;
  imported: boolean;
  imported_item_count: number;
  active_pending_count: number;
}

export interface FirstWeekOverview {
  birth_day_number: number;
  summary_24h: StatusDailySummary;
  data_quality: DataQualityFlag[];
}

export interface StatusTrendSummary {
  days: number;
  feeding_total_count: number;
  bottle_ml_total: number;
  sleep_minutes_total: number;
  average_sleep_minutes: number;
  longest_sleep_minutes: number;
  pee_count: number;
  poop_count: number;
  symptom_count: number;
  temperature_max_c: number | null;
}

export interface StatusTrendsResponse {
  generated_at: string;
  timezone: string;
  days: StatusDailySummary[];
  series: {
    feeding_count_total: number[];
    bottle_ml_total: number[];
    breastfeeding_minutes_total: number[];
    sleep_minutes_total: number[];
    longest_sleep_minutes: number[];
    pee_count: number[];
    poop_count: number[];
    symptom_count: number[];
    temperature_max_c: Array<number | null>;
    latest_weight_g: Array<number | null>;
  };
}

export interface StatusRange {
  label: string;
  start_utc: string;
  end_utc: string;
  start_local_date: string;
  end_local_date: string;
  preset: string | null;
}

export interface StatusRangeAnalyticsResponse {
  generated_at: string;
  timezone: string;
  range: StatusRange;
  event_types: EventType[];
  summary: StatusDailySummary;
  days: StatusDailySummary[];
  series: {
    local_dates: string[];
    feeding_total_count: number[];
    breast_count: number[];
    breastfeeding_minutes_total: number[];
    bottle_ml_total: number[];
    pee_count: number[];
    poop_count: number[];
    sleep_minutes_total: number[];
    longest_sleep_minutes: number[];
    temperature_max_c: Array<number | null>;
    latest_weight_g: Array<number | null>;
    symptom_count: number[];
  };
  comparison: null | {
    label: string;
    previous_range: StatusRange;
    previous_summary: StatusDailySummary;
    deltas: Record<string, { current: number | null; previous: number | null; delta: number | null; percent_change: number | null }>;
  };
  reference_targets: EvaluatedReferenceTarget[];
  reference_targets_note: string;
}

export interface StatusTimelineEvent {
  id: string;
  category: string;
  event_type: EventType;
  occurred_at: string;
  ended_at: string | null;
  local_date: string;
  amount_value: number | null;
  amount_unit: string | null;
  note: string | null;
  details_json: Record<string, unknown>;
}

export interface StatusTimelineResponse {
  generated_at: string;
  timezone: string;
  range: StatusRange;
  event_types: EventType[];
  groups: Array<{
    local_date: string;
    summary: StatusDailySummary;
    events: StatusTimelineEvent[];
  }>;
}

export interface PediatricSummaryResponse {
  generated_at: string;
  range: "24h" | "3d" | "7d" | "custom";
  range_label: string;
  timezone: string;
  plain_text: string;
  structured: Record<
    "basic_info" | "feeding" | "diaper" | "sleep" | "temperature" | "growth" | "symptoms" | "medicines" | "notes" | "data_quality" | "reference_targets",
    string[]
  >;
}

export async function buildStatusOverview(store: Store, nowIso: string, days = 7): Promise<StatusOverviewResponse> {
  const profile = await store.getProfile();
  const timezone = profile.timezone;
  const todayDate = localDateForTimezone(nowIso, timezone);
  const rangeDays = clamp(days, 1, 30);
  const summaries = await buildDailySummaries(store, todayDate, rangeDays, nowIso);
  const rangeStart = utcForLocalDateStart(dateRangeEnding(todayDate, rangeDays)[0], timezone);
  const rangeEnd = utcForLocalDateStart(addDays(todayDate, 1), timezone);
  const recentEvents = await listActiveEventsInUtcRange(store, rangeStart, rangeEnd, 1000);
  const openSleep = (await store.listOpenSleepSessions())[0] ?? null;
  const openTummyTime = (await store.listOpenEventsByType("tummy_time"))[0] ?? null;
  const openBreast = (await store.listOpenEventsByType("feed_breast")).find(isOpenTimedBreastSession) ?? null;
  const today = summaries.at(-1) ?? emptyDailySummary(todayDate);
  const profileInfo = profileStatus(profile, todayDate);
  const summary24h = await buildStatusRangeSummary(store, todayDate, isoMinusHours(nowIso, 24), nowIso);
  const dataQuality = await buildDataQuality(store, profile, today, summaries, recentEvents, nowIso);
  const referenceTargets = buildReferenceTargets(profileInfo, summary24h, nowIso);

  return {
    generated_at: nowIso,
    profile: profileInfo,
    active_state: {
      open_sleep_session: openSleep ? activeSession(openSleep, nowIso) : null,
      open_tummy_time_session: openTummyTime ? activeSession(openTummyTime, nowIso) : null,
      open_breast_session: openBreast ? activeSession(openBreast, nowIso) : null
    },
    today,
    last_7_days: summaries,
    trend_summary: trendSummary(summaries),
    data_quality: dataQuality,
    birth_ready: await buildBirthReadyOverview(store, profileInfo, recentEvents),
    first_week: buildFirstWeekOverview(profileInfo, summary24h, dataQuality),
    reference_targets: referenceTargets
  };
}

export async function buildStatusDay(store: Store, nowIso: string, preset: StatusDayPreset): Promise<StatusDayResponse> {
  const profile = await store.getProfile();
  const todayDate = localDateForTimezone(nowIso, profile.timezone);
  const localDate = preset === "yesterday" ? addDays(todayDate, -1) : todayDate;
  const summary = await buildSummaryForDate(store, localDate, nowIso, {
    includeOpenSessions: preset === "today",
    latestScope: preset === "today" ? "global" : "day"
  });
  const events = (await store.listEventsByLocalDate(localDate)).slice().sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

  return {
    generated_at: nowIso,
    preset,
    local_date: localDate,
    profile: {
      child_name: profile.child_name,
      child_birth_date: profile.child_birth_date,
      due_date: profile.due_date,
      timezone: profile.timezone,
      phase: profile.phase
    },
    summary,
    events
  };
}

export async function buildTodayReferenceTargets(store: Store, nowIso: string): Promise<ReferenceTargetsBlock> {
  const profile = await store.getProfile();
  const todayDate = localDateForTimezone(nowIso, profile.timezone);
  const profileInfo = profileStatus(profile, todayDate);
  const summary24h = await buildStatusRangeSummary(store, todayDate, isoMinusHours(nowIso, 24), nowIso);
  return buildReferenceTargets(profileInfo, summary24h, nowIso);
}

export async function buildStatusTrends(store: Store, nowIso: string, days = 7): Promise<StatusTrendsResponse> {
  const profile = await store.getProfile();
  const todayDate = localDateForTimezone(nowIso, profile.timezone);
  const summaries = await buildDailySummaries(store, todayDate, clamp(days, 1, 30), nowIso);
  return {
    generated_at: nowIso,
    timezone: profile.timezone,
    days: summaries,
    series: {
      feeding_count_total: summaries.map((summary) => summary.feeding.total_count),
      bottle_ml_total: summaries.map((summary) => summary.feeding.bottle_ml_total),
      breastfeeding_minutes_total: summaries.map((summary) => summary.feeding.breast_minutes_total),
      sleep_minutes_total: summaries.map((summary) => summary.sleep.minutes_total),
      longest_sleep_minutes: summaries.map((summary) => summary.sleep.longest_minutes),
      pee_count: summaries.map((summary) => summary.diaper.pee_count),
      poop_count: summaries.map((summary) => summary.diaper.poop_count),
      symptom_count: summaries.map((summary) => summary.symptoms.count),
      temperature_max_c: summaries.map((summary) => summary.temperature.max_c),
      latest_weight_g: summaries.map((summary) => summary.growth.latest_weight_g)
    }
  };
}

export async function buildStatusTimeline(
  store: Store,
  nowIso: string,
  options: { days?: number; limit?: number; event_type?: string; event_types?: string[]; preset?: string | null; start_date?: string | null; end_date?: string | null } = {}
): Promise<StatusTimelineResponse> {
  const profile = await store.getProfile();
  const range = resolveStatusRange(profile, nowIso, options);
  const eventTypes = normalizeEventTypes(options.event_types ?? (options.event_type ? [options.event_type] : []));
  const eventTypeQuery = eventTypes.length === 1 ? eventTypes[0] : undefined;
  const limit = clamp(options.limit ?? 100, 10, 300);
  const dates = dateRangeBetween(range.start_local_date, range.end_local_date);
  const allowedDates = new Set(dates);

  if (range.preset === "last_24h") {
    const summary = await buildStatusRangeSummary(store, range.label, range.start_utc, range.end_utc, eventTypes);
    const events = (await listActiveEventsInUtcRange(store, range.start_utc, range.end_utc, limit, eventTypeQuery))
      .filter((event) => !eventTypes.length || eventTypes.includes(event.event_type))
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
      .slice(0, limit);
    return {
      generated_at: nowIso,
      timezone: profile.timezone,
      range,
      event_types: eventTypes,
      groups: events.length || hasDailyActivity(summary) ? [{ local_date: range.label, summary, events: events.map(timelineEvent) }] : []
    };
  }

  const summaries = await buildDailySummariesForDates(store, dates, nowIso, eventTypes);
  const summaryByDate = new Map(summaries.map((summary) => [summary.local_date, summary]));
  const events = (await listActiveEventsInUtcRange(store, range.start_utc, range.end_utc, limit, eventTypeQuery))
    .filter((event) => !eventTypes.length || eventTypes.includes(event.event_type))
    .filter((event) => allowedDates.has(event.local_date))
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, limit);
  const eventsByDate = new Map<string, EventRecord[]>();
  for (const event of events) {
    eventsByDate.set(event.local_date, [...(eventsByDate.get(event.local_date) ?? []), event]);
  }

  return {
    generated_at: nowIso,
    timezone: profile.timezone,
    range,
    event_types: eventTypes,
    groups: dates
      .slice()
      .reverse()
      .map((localDate) => ({
        local_date: localDate,
        summary: summaryByDate.get(localDate) ?? emptyDailySummary(localDate),
        events: (eventsByDate.get(localDate) ?? []).map(timelineEvent)
      }))
      .filter((group) => group.events.length > 0 || hasDailyActivity(group.summary))
  };
}

export async function buildStatusRangeAnalytics(
  store: Store,
  nowIso: string,
  options: { preset?: string | null; start_date?: string | null; end_date?: string | null; event_types?: string[]; compare?: string | null } = {}
): Promise<StatusRangeAnalyticsResponse> {
  const profile = await store.getProfile();
  const range = resolveStatusRange(profile, nowIso, options);
  const eventTypes = normalizeEventTypes(options.event_types ?? []);
  const dates = dateRangeBetween(range.start_local_date, range.end_local_date);
  const summaryLocalDate = range.preset === "last_24h" ? range.label : range.end_local_date;
  const summary = await buildStatusRangeSummary(store, summaryLocalDate, range.start_utc, range.end_utc, eventTypes);
  const days = range.preset === "last_24h" ? [summary] : await buildDailySummariesForDates(store, dates, range.end_utc, eventTypes);
  const profileInfo = profileStatus(profile, localDateForTimezone(nowIso, profile.timezone));
  const referenceSummary = await buildStatusRangeSummary(store, summaryLocalDate, range.start_utc, range.end_utc);
  const referenceTargets = buildReferenceTargets(profileInfo, referenceSummary, nowIso).items;
  const previousRange = options.compare === "previous" ? previousSameLengthRange(range, profile.timezone) : null;
  const previousSummary = previousRange ? await buildStatusRangeSummary(store, previousRange.end_local_date, previousRange.start_utc, previousRange.end_utc, eventTypes) : null;

  return {
    generated_at: nowIso,
    timezone: profile.timezone,
    range,
    event_types: eventTypes,
    summary,
    days,
    series: {
      local_dates: days.map((day) => day.local_date),
      feeding_total_count: days.map((day) => day.feeding.total_count),
      breast_count: days.map((day) => day.feeding.breast_count),
      breastfeeding_minutes_total: days.map((day) => day.feeding.breast_minutes_total),
      bottle_ml_total: days.map((day) => day.feeding.bottle_ml_total),
      pee_count: days.map((day) => day.diaper.pee_count),
      poop_count: days.map((day) => day.diaper.poop_count),
      sleep_minutes_total: days.map((day) => day.sleep.minutes_total),
      longest_sleep_minutes: days.map((day) => day.sleep.longest_minutes),
      temperature_max_c: days.map((day) => day.temperature.max_c),
      latest_weight_g: days.map((day) => day.growth.latest_weight_g),
      symptom_count: days.map((day) => day.symptoms.count)
    },
    comparison:
      previousRange && previousSummary
        ? {
            label: `${range.label} vs previous same-length period`,
            previous_range: previousRange,
            previous_summary: previousSummary,
            deltas: comparisonDeltas(summary, previousSummary)
          }
        : null,
    reference_targets: referenceTargets,
    reference_targets_note: "Reference targets are based on all records in the period and are not affected by event-type filters."
  };
}

export async function buildPediatricSummary(
  store: Store,
  rangeOrOptions:
    | "24h"
    | "3d"
    | "7d"
    | { range?: "24h" | "3d" | "7d"; preset?: string | null; start_date?: string | null; end_date?: string | null; event_types?: string[] },
  nowIso: string
): Promise<PediatricSummaryResponse> {
  const profile = await store.getProfile();
  const todayDate = localDateForTimezone(nowIso, profile.timezone);
  const options = typeof rangeOrOptions === "string" ? { range: rangeOrOptions } : rangeOrOptions;
  const rangeValue = options.range ?? "24h";
  const eventTypes = normalizeEventTypes(options.event_types ?? []);
  const statusRange = resolveStatusRange(profile, nowIso, {
    preset: options.start_date || options.end_date ? null : options.preset ?? rangeValue,
    start_date: options.start_date,
    end_date: options.end_date
  });
  const responseRange = options.start_date || options.end_date || (options.preset && !["last_24h", "24h", "3d", "7d", "last_3d", "last_7d"].includes(options.preset)) ? "custom" : rangeValue;
  const combined = await buildStatusRangeSummary(store, statusRange.end_local_date || todayDate, statusRange.start_utc, statusRange.end_utc, eventTypes);
  const summaries = [combined];
  const rangeEvents = (await listActiveEventsInUtcRange(store, statusRange.start_utc, statusRange.end_utc, 1000)).filter(
    (event) => !eventTypes.length || eventTypes.includes(event.event_type)
  );
  const quality = await buildDataQuality(store, profile, summaries.at(-1) ?? emptyDailySummary(todayDate), summaries, rangeEvents, nowIso);
  const profileInfo = profileStatus(profile, todayDate);
  const referenceTargets = buildReferenceTargets(profileInfo, combined, nowIso);
  const referenceTargetLines = eventTypes.length
    ? ["当前为筛选后的摘要，只汇总所选记录类型；完整问诊摘要请清空筛选。"]
    : referenceTargetSummaryLines(referenceTargets, statusRange.label);
  const structured = {
    basic_info: basicInfoLines(profileInfo, statusRange.label),
    feeding: feedingSummaryLines(combined, profile.timezone, nowIso),
    diaper: diaperSummaryLines(combined, profile.timezone, nowIso),
    sleep: [`记录到睡眠 ${combined.sleep.session_count} 段，总计 ${combined.sleep.minutes_total} 分钟，最长一段 ${combined.sleep.longest_minutes} 分钟。`],
    temperature: temperatureSummaryLines(combined, profile.timezone, nowIso),
    growth: growthSummaryLines(combined),
    symptoms: combined.symptoms.count ? [`记录到症状 ${combined.symptoms.count} 条，标签：${Object.keys(combined.symptoms.tags).join("、") || "未填写标签"}。`] : ["未记录到症状记录。"],
    medicines: combined.medicines.count ? [`记录到用药记录 ${combined.medicines.count} 条，最近一次：${medicineText(combined.medicines.latest)}。`] : ["未记录到用药记录。"],
    notes: [`记录到备注 ${combined.notes.count} 条；黄疸、精神状态或父母担心点如有记录，会出现在症状或备注中。`],
    data_quality: quality.length ? quality.map((flag) => flag.message) : ["暂无需要核对的数据。"],
    reference_targets: referenceTargetLines
  };
  const labels: Record<keyof typeof structured, string> = {
    basic_info: "基本信息",
    feeding: "喂养",
    diaper: "尿布",
    sleep: "睡眠",
    temperature: "体温",
    growth: "体重/黄疸/精神状态相关记录",
    symptoms: "症状",
    medicines: "用药",
    notes: "父母担心点/备注",
    data_quality: "数据质量提醒",
    reference_targets: "参考对照"
  };
  const plainText = [
    `以下为便于问诊的记录摘要（${statusRange.label}，时区 ${profile.timezone}）。`,
    ...Object.entries(structured).flatMap(([key, lines]) => [labels[key as keyof typeof structured], ...lines]),
    "以上只汇总家庭记录，不提供诊断、治疗、用药或疫苗决策；如有担心，请联系儿科医生或医院。"
  ].join("\n");

  return {
    generated_at: nowIso,
    range: responseRange,
    range_label: statusRange.label,
    timezone: profile.timezone,
    plain_text: plainText,
    structured
  };
}

async function buildDailySummaries(store: Store, todayDate: string, days: number, nowIso: string): Promise<StatusDailySummary[]> {
  return Promise.all(dateRangeEnding(todayDate, days).map((date) => buildStatusDailySummary(store, date, nowIso)));
}

async function buildDailySummariesForDates(store: Store, dates: string[], nowIso: string, eventTypes: EventType[] = []): Promise<StatusDailySummary[]> {
  return Promise.all(dates.map((date) => buildStatusDailySummary(store, date, nowIso, eventTypes)));
}

async function buildStatusDailySummary(store: Store, localDate: string, nowIso: string, eventTypes: EventType[] = []): Promise<StatusDailySummary> {
  const profile = await store.getProfile();
  const timezone = profile.timezone;
  const events = (await store.listEventsByLocalDate(localDate)).filter((event) => !eventTypes.length || eventTypes.includes(event.event_type));
  const sleepRangeStart = utcForLocalDateStart(localDate, timezone);
  const sleepRangeEnd = utcForLocalDateStart(addDays(localDate, 1), timezone);
  const sleepSegments = eventTypes.length && !eventTypes.includes("sleep_session") ? [] : await sleepSegmentsForRange(store, sleepRangeStart, sleepRangeEnd, nowIso);
  return summarizeEvents(localDate, events, sleepSegments);
}

async function buildStatusRangeSummary(store: Store, localDate: string, rangeStartIso: string, rangeEndIso: string, eventTypes: EventType[] = []): Promise<StatusDailySummary> {
  const events = (await listActiveEventsInUtcRange(store, rangeStartIso, rangeEndIso, 1000)).filter((event) => !eventTypes.length || eventTypes.includes(event.event_type));
  const sleepSegments = eventTypes.length && !eventTypes.includes("sleep_session") ? [] : await sleepSegmentsForRange(store, rangeStartIso, rangeEndIso, rangeEndIso);
  return summarizeEvents(localDate, events, sleepSegments);
}

async function sleepSegmentsForRange(store: Store, rangeStartIso: string, rangeEndIso: string, openEndedAt: string): Promise<Array<{ event: EventRecord; minutes: number }>> {
  const sleepEvents = await store.listSleepEventsOverlappingRange(rangeStartIso, rangeEndIso, openEndedAt);
  return sleepEvents
    .map((event) => ({ event, minutes: overlapMinutes(event.occurred_at, event.ended_at ?? openEndedAt, rangeStartIso, rangeEndIso) }))
    .filter((segment) => segment.minutes > 0);
}

function summarizeEvents(localDate: string, events: EventRecord[], sleepSegments: Array<{ event: EventRecord; minutes: number }>): StatusDailySummary {
  const empty = emptyDailySummary(localDate);
  const feeding = empty.feeding;
  const diaper = empty.diaper;
  const symptoms = empty.symptoms;
  const medicines: StatusDailySummary["medicines"] = { count: 0, latest: null };
  let latestMedicine: EventRecord | null = null;
  const notes = { count: 0 };
  const temperatures: EventRecord[] = [];
  const growthEvents: EventRecord[] = [];
  const tummyTime = empty.tummy_time;

  for (const event of events) {
    switch (event.event_type) {
      case "feed_breast":
        feeding.breast_count += 1;
        feeding.breast_latest_at = maxIso(feeding.breast_latest_at, event.occurred_at);
        feeding.breast_minutes_total += breastfeedingMinutes(event);
        if (isOpenTimedBreastSession(event)) feeding.breast_open_session_count += 1;
        break;
      case "feed_bottle":
        feeding.bottle_count += 1;
        feeding.bottle_ml_total += event.amount_value ?? 0;
        feeding.bottle_latest_at = maxIso(feeding.bottle_latest_at, event.occurred_at);
        if (event.details_json.milk_type === "formula") feeding.formula_ml_total += event.amount_value ?? 0;
        else if (event.details_json.milk_type === "breastmilk") feeding.breastmilk_bottle_ml_total += event.amount_value ?? 0;
        else feeding.mixed_or_other_ml_total += event.amount_value ?? 0;
        break;
      case "diaper_pee":
        diaper.pee_count += 1;
        diaper.latest_pee_at = maxIso(diaper.latest_pee_at, event.occurred_at);
        break;
      case "diaper_poop":
        diaper.poop_count += 1;
        diaper.latest_poop_at = maxIso(diaper.latest_poop_at, event.occurred_at);
        countString(diaper.poop_colors, event.details_json.color);
        countString(diaper.poop_textures, event.details_json.texture);
        break;
      case "temperature":
        if (event.amount_value != null) temperatures.push(event);
        break;
      case "growth_measurement":
        growthEvents.push(event);
        break;
      case "tummy_time":
        tummyTime.session_count += 1;
        tummyTime.minutes_total += activityMinutes(event);
        if (!event.ended_at && numericDetail(event.details_json.duration_min) <= 0) tummyTime.open_session_count += 1;
        break;
      case "symptom":
        symptoms.count += 1;
        countString(symptoms.by_severity, event.details_json.severity ?? "unknown");
        if (Array.isArray(event.details_json.symptom_tags)) {
          for (const tag of event.details_json.symptom_tags) countString(symptoms.tags, tag);
        }
        break;
      case "medicine":
        medicines.count += 1;
        if (!latestMedicine || event.occurred_at > latestMedicine.occurred_at) latestMedicine = event;
        break;
      case "note":
        notes.count += 1;
        break;
    }
  }
  feeding.total_count = feeding.breast_count + feeding.bottle_count;
  feeding.average_bottle_ml_per_feed = feeding.bottle_count ? Math.round((feeding.bottle_ml_total / feeding.bottle_count) * 10) / 10 : null;
  feeding.latest_feeding_at = maxIso(feeding.breast_latest_at, feeding.bottle_latest_at);
  feeding.latest_feeding_type =
    feeding.latest_feeding_at == null ? null : feeding.latest_feeding_at === feeding.breast_latest_at ? "feed_breast" : "feed_bottle";
  diaper.latest_diaper_at = maxIso(diaper.latest_pee_at, diaper.latest_poop_at);
  medicines.latest = latestMedicine ? medicineRecord(latestMedicine) : null;
  const latestTemperature = temperatures.slice().sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)).at(-1) ?? null;

  return {
    local_date: localDate,
    feeding,
    diaper,
    sleep: {
      session_count: sleepSegments.length,
      minutes_total: sleepSegments.reduce((total, segment) => total + segment.minutes, 0),
      longest_minutes: sleepSegments.reduce((max, segment) => Math.max(max, segment.minutes), 0),
      open_session_count: sleepSegments.filter((segment) => !segment.event.ended_at).length
    },
    temperature: {
      latest_c: latestTemperature?.amount_value ?? null,
      latest_occurred_at: latestTemperature?.occurred_at ?? null,
      latest_method: typeof latestTemperature?.details_json.method === "string" ? latestTemperature.details_json.method : null,
      latest_event_id: latestTemperature?.id ?? null,
      max_c: temperatures.reduce<number | null>((max, event) => (event.amount_value == null ? max : Math.max(max ?? event.amount_value, event.amount_value)), null),
      count: temperatures.length
    },
    tummy_time: tummyTime,
    growth: growthSummary(growthEvents),
    symptoms,
    medicines,
    notes
  };
}

async function buildDataQuality(
  store: Store,
  profile: AppProfile,
  today: StatusDailySummary,
  summaries: StatusDailySummary[],
  allEvents: EventRecord[],
  nowIso: string
): Promise<DataQualityFlag[]> {
  const flags: DataQualityFlag[] = [];
  for (const session of await store.listOpenSleepSessions()) {
    if (minutesBetween(session.occurred_at, nowIso) > 12 * 60) {
      flags.push({
        code: "open_sleep_session_long",
        severity: "warning",
        message: "有一段睡眠记录已开启超过 12 小时，可能忘记记录睡醒时间。",
        related_event_id: session.id
      });
    }
  }
  for (const session of await store.listOpenEventsByType("tummy_time")) {
    if (minutesBetween(session.occurred_at, nowIso) > 60) {
      flags.push({
        code: "open_tummy_time_session_long",
        severity: "warning",
        message: "有一段趴趴时间已开启超过 60 分钟，可能忘记记录结束时间。",
        related_event_id: session.id
      });
    }
  }
  for (const session of (await store.listOpenEventsByType("feed_breast")).filter(isOpenTimedBreastSession)) {
    if (minutesBetween(session.occurred_at, nowIso) > 60) {
      flags.push({
        code: "open_breast_session_long",
        severity: "warning",
        message: "有一段母乳亲喂记录已开启超过 60 分钟，可能忘记记录结束时间。",
        related_event_id: session.id
      });
    }
  }
  if (profile.child_birth_date && profile.phase === "newborn_or_baby" && !hasDailyActivity(today)) {
    flags.push({ code: "no_records_today_after_birth", severity: "info", message: "出生后今天还没有记录，可按需要补充喂养、尿布或睡眠记录。" });
  }
  if (allEvents.some((event) => event.event_type === "feed_bottle" && event.amount_value == null)) {
    flags.push({ code: "missing_bottle_amount", severity: "info", message: "存在未填写 ml 的奶瓶记录，可在回顾时核对。" });
  }
  if (allEvents.some(isUnusualGrowthValue)) {
    flags.push({ code: "growth_unit_unusual", severity: "info", message: "有生长测量数值看起来单位可能异常，请核对 kg/cm 记录。" });
  }
  if (allEvents.some(isUnusualTemperatureValue)) {
    flags.push({ code: "temperature_value_unusual", severity: "info", message: "有体温记录数值看起来可能异常，请核对单位和值。" });
  }
  if (summaries.some((summary) => (summary.temperature.max_c ?? 0) >= 38.0)) {
    const todayDate = localDateForTimezone(nowIso, profile.timezone);
    const ageDays = profile.child_birth_date ? diffLocalDates(profile.child_birth_date, todayDate) : null;
    const isUnderThreeMonths = ageDays != null && ageDays >= 0 && ageDays < 90;
    flags.push({
      code: "temperature_recorded_high",
      severity: "warning",
      message: isUnderThreeMonths
        ? "记录到 3 个月内Baby体温达到 38.0°C 或以上。请核对测量方式和值，并联系儿科医生或医院。系统不判断原因。"
        : "记录到较高体温，请核对测量方式和值，并结合医生建议。"
    });
  }
  return flags;
}

function emptyDailySummary(localDate: string): StatusDailySummary {
  return {
    local_date: localDate,
    feeding: {
      breast_count: 0,
      breast_minutes_total: 0,
      breast_open_session_count: 0,
      breast_latest_at: null,
      bottle_count: 0,
      bottle_ml_total: 0,
      bottle_latest_at: null,
      formula_ml_total: 0,
      breastmilk_bottle_ml_total: 0,
      mixed_or_other_ml_total: 0,
      average_bottle_ml_per_feed: null,
      total_count: 0,
      latest_feeding_at: null,
      latest_feeding_type: null
    },
    diaper: { pee_count: 0, poop_count: 0, latest_diaper_at: null, latest_pee_at: null, latest_poop_at: null, poop_colors: {}, poop_textures: {} },
    sleep: { session_count: 0, minutes_total: 0, longest_minutes: 0, open_session_count: 0 },
    temperature: { latest_c: null, latest_occurred_at: null, latest_method: null, latest_event_id: null, max_c: null, count: 0 },
    tummy_time: { session_count: 0, minutes_total: 0, open_session_count: 0 },
    growth: { latest_weight_g: null, latest_length_cm: null, latest_head_circumference_cm: null },
    symptoms: { count: 0, by_severity: {}, tags: {} },
    medicines: { count: 0, latest: null },
    notes: { count: 0 }
  };
}

function combineDailySummaries(summaries: StatusDailySummary[]): StatusDailySummary {
  const combined = emptyDailySummary(summaries.at(-1)?.local_date ?? "");
  for (const summary of summaries) {
    combined.feeding.breast_count += summary.feeding.breast_count;
    combined.feeding.breast_minutes_total += summary.feeding.breast_minutes_total;
    combined.feeding.breast_open_session_count += summary.feeding.breast_open_session_count;
    combined.feeding.breast_latest_at = maxIso(combined.feeding.breast_latest_at, summary.feeding.breast_latest_at);
    combined.feeding.bottle_count += summary.feeding.bottle_count;
    combined.feeding.bottle_ml_total += summary.feeding.bottle_ml_total;
    combined.feeding.bottle_latest_at = maxIso(combined.feeding.bottle_latest_at, summary.feeding.bottle_latest_at);
    combined.feeding.formula_ml_total += summary.feeding.formula_ml_total;
    combined.feeding.breastmilk_bottle_ml_total += summary.feeding.breastmilk_bottle_ml_total;
    combined.feeding.mixed_or_other_ml_total += summary.feeding.mixed_or_other_ml_total;
    combined.feeding.total_count += summary.feeding.total_count;
    combined.diaper.pee_count += summary.diaper.pee_count;
    combined.diaper.poop_count += summary.diaper.poop_count;
    combined.diaper.latest_pee_at = maxIso(combined.diaper.latest_pee_at, summary.diaper.latest_pee_at);
    combined.diaper.latest_poop_at = maxIso(combined.diaper.latest_poop_at, summary.diaper.latest_poop_at);
    combined.diaper.latest_diaper_at = maxIso(combined.diaper.latest_diaper_at, summary.diaper.latest_diaper_at);
    mergeCounts(combined.diaper.poop_colors, summary.diaper.poop_colors);
    mergeCounts(combined.diaper.poop_textures, summary.diaper.poop_textures);
    combined.sleep.session_count += summary.sleep.session_count;
    combined.sleep.minutes_total += summary.sleep.minutes_total;
    combined.sleep.longest_minutes = Math.max(combined.sleep.longest_minutes, summary.sleep.longest_minutes);
    combined.sleep.open_session_count += summary.sleep.open_session_count;
    combined.temperature.count += summary.temperature.count;
    combined.temperature.max_c = maxNullable(combined.temperature.max_c, summary.temperature.max_c);
    if (summary.temperature.latest_occurred_at && (!combined.temperature.latest_occurred_at || summary.temperature.latest_occurred_at > combined.temperature.latest_occurred_at)) {
      combined.temperature.latest_c = summary.temperature.latest_c;
      combined.temperature.latest_occurred_at = summary.temperature.latest_occurred_at;
      combined.temperature.latest_method = summary.temperature.latest_method;
      combined.temperature.latest_event_id = summary.temperature.latest_event_id;
    }
    combined.tummy_time.session_count += summary.tummy_time.session_count;
    combined.tummy_time.minutes_total += summary.tummy_time.minutes_total;
    combined.tummy_time.open_session_count += summary.tummy_time.open_session_count;
    combined.growth.latest_weight_g = summary.growth.latest_weight_g ?? combined.growth.latest_weight_g;
    combined.growth.latest_length_cm = summary.growth.latest_length_cm ?? combined.growth.latest_length_cm;
    combined.growth.latest_head_circumference_cm = summary.growth.latest_head_circumference_cm ?? combined.growth.latest_head_circumference_cm;
    combined.symptoms.count += summary.symptoms.count;
    mergeCounts(combined.symptoms.by_severity, summary.symptoms.by_severity);
    mergeCounts(combined.symptoms.tags, summary.symptoms.tags);
    combined.medicines.count += summary.medicines.count;
    combined.medicines.latest = summary.medicines.latest ?? combined.medicines.latest;
    combined.notes.count += summary.notes.count;
  }
  combined.feeding.average_bottle_ml_per_feed = combined.feeding.bottle_count ? Math.round((combined.feeding.bottle_ml_total / combined.feeding.bottle_count) * 10) / 10 : null;
  combined.feeding.latest_feeding_at = maxIso(combined.feeding.breast_latest_at, combined.feeding.bottle_latest_at);
  combined.feeding.latest_feeding_type =
    combined.feeding.latest_feeding_at == null ? null : combined.feeding.latest_feeding_at === combined.feeding.breast_latest_at ? "feed_breast" : "feed_bottle";
  return combined;
}

function growthSummary(events: EventRecord[]): StatusDailySummary["growth"] {
  const sorted = events.slice().sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  const latest = (type: string) => sorted.filter((event) => event.details_json.measure_type === type).at(-1)?.amount_value ?? null;
  const weightKg = latest("weight_kg");
  return {
    latest_weight_g: weightKg == null ? null : Math.round(weightKg * 1000),
    latest_length_cm: latest("length_cm"),
    latest_head_circumference_cm: latest("head_circumference_cm")
  };
}

function trendSummary(summaries: StatusDailySummary[]): StatusTrendSummary {
  const combined = combineDailySummaries(summaries);
  return {
    days: summaries.length,
    feeding_total_count: combined.feeding.total_count,
    bottle_ml_total: combined.feeding.bottle_ml_total,
    sleep_minutes_total: combined.sleep.minutes_total,
    average_sleep_minutes: summaries.length ? Math.round(combined.sleep.minutes_total / summaries.length) : 0,
    longest_sleep_minutes: combined.sleep.longest_minutes,
    pee_count: combined.diaper.pee_count,
    poop_count: combined.diaper.poop_count,
    symptom_count: combined.symptoms.count,
    temperature_max_c: combined.temperature.max_c
  };
}

function dateRangeEnding(today: string, days: number): string[] {
  return Array.from({ length: days }, (_, index) => addDays(today, index - days + 1));
}

function dateRangeBetween(startDate: string, endDate: string): string[] {
  const days = Math.max(1, diffLocalDates(startDate, endDate) + 1);
  return Array.from({ length: days }, (_, index) => addDays(startDate, index));
}

function normalizeEventTypes(values: string[]): EventType[] {
  const unique = new Set<EventType>();
  for (const value of values.flatMap((item) => item.split(","))) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    getEventDefinition(trimmed as EventType);
    unique.add(trimmed as EventType);
  }
  return [...unique];
}

function resolveStatusRange(
  profile: AppProfile,
  nowIso: string,
  options: { days?: number; preset?: string | null; start_date?: string | null; end_date?: string | null }
): StatusRange {
  const timezone = profile.timezone;
  const todayDate = localDateForTimezone(nowIso, timezone);
  if (options.start_date || options.end_date) {
    const startDate = options.start_date ?? "";
    const endDate = options.end_date ?? "";
    if (!isValidDateOnly(startDate) || !isValidDateOnly(endDate)) throw new ValidationError("start_date and end_date must be YYYY-MM-DD");
    if (startDate > endDate) throw new ValidationError("start_date must be before or equal to end_date");
    if (diffLocalDates(startDate, endDate) + 1 > 90) throw new ValidationError("custom range must be 90 days or less");
    return {
      label: `${startDate} 至 ${endDate}`,
      start_utc: utcForLocalDateStart(startDate, timezone),
      end_utc: utcForLocalDateStart(addDays(endDate, 1), timezone),
      start_local_date: startDate,
      end_local_date: endDate,
      preset: "custom"
    };
  }

  const preset = normalizePreset(options.preset, options.days);
  if (preset === "last_24h") {
    const startUtc = isoMinusHours(nowIso, 24);
    return {
      label: "最近 24 小时",
      start_utc: startUtc,
      end_utc: nowIso,
      start_local_date: localDateForTimezone(startUtc, timezone),
      end_local_date: todayDate,
      preset
    };
  }
  if (preset === "today") {
    return {
      label: "今天",
      start_utc: utcForLocalDateStart(todayDate, timezone),
      end_utc: nowIso,
      start_local_date: todayDate,
      end_local_date: todayDate,
      preset
    };
  }
  if (preset === "yesterday") {
    const yesterday = addDays(todayDate, -1);
    return {
      label: "昨天",
      start_utc: utcForLocalDateStart(yesterday, timezone),
      end_utc: utcForLocalDateStart(todayDate, timezone),
      start_local_date: yesterday,
      end_local_date: yesterday,
      preset
    };
  }

  const days = presetDays(preset);
  const startDate = addDays(todayDate, -days + 1);
  return {
    label: `最近 ${days} 天`,
    start_utc: utcForLocalDateStart(startDate, timezone),
    end_utc: utcForLocalDateStart(addDays(todayDate, 1), timezone),
    start_local_date: startDate,
    end_local_date: todayDate,
    preset
  };
}

function normalizePreset(rawPreset?: string | null, days?: number): string {
  if (rawPreset === "24h") return "last_24h";
  if (rawPreset === "3d") return "last_3d";
  if (rawPreset === "7d") return "last_7d";
  if (rawPreset === "14d") return "last_14d";
  if (rawPreset === "30d") return "last_30d";
  if (rawPreset && ["last_24h", "today", "yesterday", "last_3d", "last_7d", "last_14d", "last_30d"].includes(rawPreset)) return rawPreset;
  if (days === 3) return "last_3d";
  if (days === 14) return "last_14d";
  if (days === 30) return "last_30d";
  return "last_7d";
}

function presetDays(preset: string): number {
  if (preset === "last_3d") return 3;
  if (preset === "last_14d") return 14;
  if (preset === "last_30d") return 30;
  return 7;
}

function previousSameLengthRange(range: StatusRange, timezone: string): StatusRange {
  const start = Date.parse(range.start_utc);
  const end = Date.parse(range.end_utc);
  const length = Math.max(1, end - start);
  const previousStart = new Date(start - length).toISOString().replace(".000Z", "Z");
  const previousEnd = new Date(end - length).toISOString().replace(".000Z", "Z");
  return {
    label: "上一同长度周期",
    start_utc: previousStart,
    end_utc: previousEnd,
    start_local_date: localDateForTimezone(previousStart, timezone),
    end_local_date: localDateForTimezone(previousEnd, timezone),
    preset: null
  };
}

function comparisonDeltas(current: StatusDailySummary, previous: StatusDailySummary) {
  return {
    feeding_total_count: delta(current.feeding.total_count, previous.feeding.total_count),
    breast_count: delta(current.feeding.breast_count, previous.feeding.breast_count),
    breast_minutes_total: delta(current.feeding.breast_minutes_total, previous.feeding.breast_minutes_total),
    bottle_ml_total: delta(current.feeding.bottle_ml_total, previous.feeding.bottle_ml_total),
    pee_count: delta(current.diaper.pee_count, previous.diaper.pee_count),
    poop_count: delta(current.diaper.poop_count, previous.diaper.poop_count),
    sleep_minutes_total: delta(current.sleep.minutes_total, previous.sleep.minutes_total),
    longest_sleep_minutes: delta(current.sleep.longest_minutes, previous.sleep.longest_minutes),
    temperature_max_c: delta(current.temperature.max_c, previous.temperature.max_c)
  };
}

function delta(current: number | null, previous: number | null) {
  const diff = current == null || previous == null ? null : current - previous;
  return {
    current,
    previous,
    delta: diff,
    percent_change: diff == null || previous == null || previous === 0 ? null : Math.round((diff / previous) * 1000) / 10
  };
}

async function listActiveEventsInUtcRange(store: Store, since: string, until: string, limit: number, eventType?: EventType): Promise<EventRecord[]> {
  return store.listEventsInUtcRange(since, until, { event_type: eventType, limit, includeDeleted: false });
}

function isOpenTimedBreastSession(event: EventRecord): boolean {
  return event.event_type === "feed_breast" && !event.ended_at && event.details_json.session_mode === "timed" && numericDetail(event.details_json.duration_min) <= 0;
}

function profileStatus(profile: AppProfile, todayDate: string): StatusOverviewResponse["profile"] {
  const ageDays = profile.child_birth_date ? diffLocalDates(profile.child_birth_date, todayDate) : null;
  return {
    child_name: profile.child_name,
    child_birth_date: profile.child_birth_date,
    due_date: profile.due_date,
    timezone: profile.timezone,
    phase: profile.phase,
    age_days: ageDays,
    birth_day_number: ageDays == null ? null : ageDays + 1,
    days_to_due: !profile.child_birth_date && profile.due_date ? diffLocalDates(todayDate, profile.due_date) : null
  };
}

async function buildBirthReadyOverview(
  store: Store,
  profile: StatusOverviewResponse["profile"],
  recentEvents: EventRecord[]
): Promise<BirthReadyOverview | null> {
  if (!profile.child_birth_date || !profile.birth_day_number || profile.birth_day_number < 1 || profile.birth_day_number > 7) return null;
  const sorted = recentEvents.slice().sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const latestTemperature = sorted.find((event) => event.event_type === "temperature" && event.amount_value != null) ?? null;
  return {
    child_birth_date: profile.child_birth_date,
    birth_day_number: profile.birth_day_number,
    latest_feeding: previewEvent(sorted.find((event) => event.event_type === "feed_breast" || event.event_type === "feed_bottle") ?? null),
    latest_diaper: previewEvent(sorted.find((event) => event.event_type === "diaper_pee" || event.event_type === "diaper_poop") ?? null),
    latest_temperature_c: latestTemperature?.amount_value ?? null,
    latest_temperature:
      latestTemperature?.amount_value == null
        ? null
        : {
            value_c: latestTemperature.amount_value,
            occurred_at: latestTemperature.occurred_at,
            method: typeof latestTemperature.details_json.method === "string" ? latestTemperature.details_json.method : null
          },
    latest_weight_g: latestWeightGrams(sorted),
    checklist_templates: await checklistTemplatePresence(store)
  };
}

function buildFirstWeekOverview(
  profile: StatusOverviewResponse["profile"],
  summary24h: StatusDailySummary,
  dataQuality: DataQualityFlag[]
): FirstWeekOverview | null {
  if (!profile.birth_day_number || profile.birth_day_number < 1 || profile.birth_day_number > 7) return null;
  return {
    birth_day_number: profile.birth_day_number,
    summary_24h: summary24h,
    data_quality: dataQuality
  };
}

async function checklistTemplatePresence(store: Store): Promise<BirthReadyOverview["checklist_templates"]> {
  const items = await store.listChecklistItems({ includeArchived: true });
  const status = (templateCode: ChecklistTemplatePresence["template_code"], title: string): ChecklistTemplatePresence => {
    const matching = items.filter((item) => item.template_code === templateCode);
    return {
      template_code: templateCode,
      title,
      imported: matching.length > 0,
      imported_item_count: matching.length,
      active_pending_count: matching.filter((item) => item.status === "pending" && !item.archived_at).length
    };
  };
  return {
    birth_hospital: status("aap_birth_hospital_v1", "出生住院期"),
    first_week: status("aap_first_week_v1", "出生后第 1 周")
  };
}

function previewEvent(event: EventRecord | null): StatusEventPreview | null {
  return event
    ? {
        id: event.id,
        event_type: event.event_type,
        occurred_at: event.occurred_at,
        amount_value: event.amount_value,
        amount_unit: event.amount_unit,
        note: event.note,
        details_json: event.details_json
      }
    : null;
}

function latestWeightGrams(events: EventRecord[]): number | null {
  const latest = events.find((event) => event.event_type === "growth_measurement" && event.details_json.measure_type === "weight_kg" && event.amount_value != null);
  return latest?.amount_value == null ? null : Math.round(latest.amount_value * 1000);
}

function activeSession(event: EventRecord, nowIso: string): ActiveSession {
  return {
    id: event.id,
    event_type: event.event_type,
    occurred_at: event.occurred_at,
    elapsed_minutes: minutesBetween(event.occurred_at, nowIso),
    note: event.note,
    details_json: event.details_json
  };
}

function timelineEvent(event: EventRecord): StatusTimelineEvent {
  return {
    id: event.id,
    category: event.category,
    event_type: event.event_type,
    occurred_at: event.occurred_at,
    ended_at: event.ended_at,
    local_date: event.local_date,
    amount_value: event.amount_value,
    amount_unit: event.amount_unit,
    note: event.note,
    details_json: event.details_json
  };
}

function hasDailyActivity(summary: StatusDailySummary): boolean {
  return (
    summary.feeding.total_count +
      summary.diaper.pee_count +
      summary.diaper.poop_count +
      summary.sleep.session_count +
      summary.tummy_time.session_count +
      summary.temperature.count +
      summary.symptoms.count +
      summary.medicines.count +
      summary.notes.count >
      0 ||
    summary.growth.latest_weight_g != null ||
    summary.growth.latest_length_cm != null ||
    summary.growth.latest_head_circumference_cm != null
  );
}

function countString(target: Record<string, number>, value: unknown) {
  if (typeof value !== "string" || !value.trim()) return;
  target[value] = (target[value] ?? 0) + 1;
}

function mergeCounts(target: Record<string, number>, source: Record<string, number>) {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + value;
  }
}

function numericDetail(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function breastfeedingMinutes(event: EventRecord): number {
  const explicit = numericDetail(event.details_json.duration_min);
  if (explicit > 0) return explicit;
  return event.ended_at ? minutesBetween(event.occurred_at, event.ended_at) : 0;
}

function activityMinutes(event: EventRecord): number {
  const explicit = numericDetail(event.details_json.duration_min);
  if (explicit > 0) return explicit;
  return event.ended_at ? minutesBetween(event.occurred_at, event.ended_at) : 0;
}

function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function medicineRecord(event: EventRecord): Record<string, unknown> {
  return {
    occurred_at: event.occurred_at,
    name: event.details_json.name ?? null,
    dose: event.details_json.dose ?? null,
    route: event.details_json.route ?? null,
    amount_value: event.amount_value,
    amount_unit: event.amount_unit
  };
}

function medicineText(value: Record<string, unknown> | null): string {
  if (!value) return "未填写具体内容";
  return [value.name, value.dose, value.route].filter((item) => typeof item === "string" && item.trim()).join(" / ") || "未填写具体内容";
}

function isUnusualGrowthValue(event: EventRecord): boolean {
  if (event.event_type !== "growth_measurement" || event.amount_value == null) return false;
  const type = event.details_json.measure_type;
  if (type === "weight_kg") return event.amount_value < 0.3 || event.amount_value > 50;
  if (type === "length_cm") return event.amount_value < 20 || event.amount_value > 160;
  if (type === "head_circumference_cm") return event.amount_value < 10 || event.amount_value > 80;
  return false;
}

function isUnusualTemperatureValue(event: EventRecord): boolean {
  if (event.event_type !== "temperature" || event.amount_value == null) return false;
  return event.amount_unit !== "celsius" || event.amount_value < 30 || event.amount_value > 43;
}

function growthSummaryLines(summary: StatusDailySummary): string[] {
  const values = [
    summary.growth.latest_weight_g == null ? "" : `最新体重 ${summary.growth.latest_weight_g} g`,
    summary.growth.latest_length_cm == null ? "" : `最新身长 ${formatNumber(summary.growth.latest_length_cm)} cm`,
    summary.growth.latest_head_circumference_cm == null ? "" : `最新头围 ${formatNumber(summary.growth.latest_head_circumference_cm)} cm`
  ].filter(Boolean);
  return values.length ? [`记录到生长测量：${values.join("，")}。`] : ["未记录到生长测量。"];
}

function feedingSummaryLines(summary: StatusDailySummary, timezone: string, nowIso: string): string[] {
  if (!summary.feeding.total_count) return ["未记录到喂养记录。"];
  const latest = summary.feeding.latest_feeding_at
    ? `最近一次喂养：${summary.feeding.latest_feeding_type === "feed_breast" ? "亲喂" : "奶瓶"}，${timeWithRelative(summary.feeding.latest_feeding_at, timezone, nowIso)}。`
    : "最近一次喂养：未记录。";
  return [
    `记录到喂养 ${summary.feeding.total_count} 次，奶瓶总量 ${formatNumber(summary.feeding.bottle_ml_total)} ml。`,
    `其中亲喂 ${summary.feeding.breast_count} 次，总时长 ${summary.feeding.breast_minutes_total} 分钟；奶瓶 ${summary.feeding.bottle_count} 次，总量 ${formatNumber(summary.feeding.bottle_ml_total)} ml（配方 ${formatNumber(summary.feeding.formula_ml_total)} ml / 母乳瓶喂 ${formatNumber(summary.feeding.breastmilk_bottle_ml_total)} ml / 混合或其他 ${formatNumber(summary.feeding.mixed_or_other_ml_total)} ml）。`,
    latest,
    "亲喂不自动估算 ml。"
  ];
}

function diaperSummaryLines(summary: StatusDailySummary, timezone: string, nowIso: string): string[] {
  const latest = summary.diaper.latest_diaper_at ? `最近一次尿布：${timeWithRelative(summary.diaper.latest_diaper_at, timezone, nowIso)}。` : "最近一次尿布：未记录。";
  return [`记录到小便 ${summary.diaper.pee_count} 次，大便 ${summary.diaper.poop_count} 次。`, latest];
}

function temperatureSummaryLines(summary: StatusDailySummary, timezone: string, nowIso: string): string[] {
  if (!summary.temperature.count) return ["未记录到体温。"];
  const latest = summary.temperature.latest_occurred_at
    ? `最近一次 ${formatNullableNumber(summary.temperature.latest_c)} °C，${temperatureMethodLabel(summary.temperature.latest_method)}，${timeWithRelative(summary.temperature.latest_occurred_at, timezone, nowIso)}。`
    : `最近一次 ${formatNullableNumber(summary.temperature.latest_c)} °C。`;
  return [`记录到体温 ${summary.temperature.count} 次，最高 ${formatNumber(summary.temperature.max_c)} °C。`, latest];
}

function referenceTargetSummaryLines(referenceTargets: ReferenceTargetsBlock, rangeLabel: string): string[] {
  if (referenceTargets.missing_birth_date_message) return [referenceTargets.missing_birth_date_message];
  if (!referenceTargets.items.length) return ["当前年龄阶段暂无适用参考项。"];
  const prefix = rangeLabel === "最近 24 小时" ? "" : "这些参考主要按 24h 使用；当前范围仅供回顾趋势。";
  return [
    ...(prefix ? [prefix] : []),
    ...referenceTargets.items.slice(0, 8).map((item) => {
      const current = item.current_value == null || item.unit == null ? "" : `记录 ${formatNumber(item.current_value)} ${item.unit}；`;
      return `${item.title}：${current}${item.reference_text} ${item.message}`;
    })
  ];
}

function basicInfoLines(profile: StatusOverviewResponse["profile"], rangeLabel: string): string[] {
  const name = profile.child_name ?? "Baby";
  const birth = profile.child_birth_date ? `出生日期 ${profile.child_birth_date}` : "未记录出生日期";
  const day = profile.birth_day_number ? `出生第 ${profile.birth_day_number} 天` : profile.days_to_due == null ? "出生前" : `距预产期 ${profile.days_to_due} 天`;
  return [`${name}，${birth}，${day}；摘要范围：${rangeLabel}。`];
}

function timeWithRelative(iso: string, timezone: string, nowIso: string): string {
  return `${formatLocalTime(iso, timezone)}（${relativeTimeText(iso, nowIso)}）`;
}

function formatLocalTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

function relativeTimeText(iso: string, nowIso: string): string {
  const minutes = Math.max(0, Math.floor((Date.parse(nowIso) - Date.parse(iso)) / 60000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} 小时前`;
  return `${Math.floor(minutes / 1440)} 天前`;
}

function temperatureMethodLabel(value: string | null): string {
  if (value === "rectal") return "肛温";
  if (value === "ear") return "耳温";
  if (value === "forehead") return "额温";
  if (value === "armpit") return "腋温";
  if (value === "oral") return "口温";
  if (value === "other") return "其他方式";
  return "未记录测量方式";
}

function rangeLabel(range: "24h" | "3d" | "7d"): string {
  if (range === "24h") return "最近 24 小时";
  if (range === "3d") return "最近 3 天";
  return "最近 7 天";
}

function rangeHours(range: "24h" | "3d" | "7d"): number {
  if (range === "24h") return 24;
  if (range === "3d") return 72;
  return 168;
}

function isoMinusHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) - hours * 60 * 60 * 1000).toISOString().replace(".000Z", "Z");
}

function formatNumber(value: number | null): string {
  if (value == null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function formatNullableNumber(value: number | null): string {
  return value == null ? "未记录" : formatNumber(value);
}

function maxNullable(a: number | null, b: number | null): number | null {
  if (a == null) return b;
  if (b == null) return a;
  return Math.max(a, b);
}

function diffLocalDates(fromDate: string, toDate: string): number {
  return Math.round((Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86_400_000);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}
