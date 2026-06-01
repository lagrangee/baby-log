import type { ChecklistItemRecord, EventRecord, MilestoneRecord, StableChildFacts, Store, TodaySummary } from "../types";
import { ChecklistService } from "./checklist-service";
import { buildGrowthCurvePayload, type GrowthCurvePayload } from "./growth-reference-service";
import { buildLast7DaysSummary, buildTodaySummary } from "./summary-service";
import { buildStatusDay, buildStatusOverview, buildTodayReferenceTargets, type ActiveSession, type DataQualityFlag } from "./status-service";
import { getStableChildFacts } from "./stable-child-facts-service";
import type { ReferenceTargetsBlock } from "./reference-target-service";
import { toIsoUtc } from "../utils/time";

type ReadOnlyOpenSession = Pick<EventRecord, "event_type" | "occurred_at" | "local_date">;
type ReadOnlyTodaySummary = Omit<TodaySummary, "open_sessions"> & { open_sessions?: ReadOnlyOpenSession[] };
type ReadOnlyActiveSession = Pick<ActiveSession, "event_type" | "occurred_at" | "elapsed_minutes" | "note">;
type ReadOnlyQualityFlag = Pick<DataQualityFlag, "code" | "severity" | "message">;

export interface ReadOnlyRecentEvent {
  event_type: EventRecord["event_type"];
  occurred_at: string;
  ended_at: string | null;
  local_date: string;
  amount_value: number | null;
  amount_unit: string | null;
  note: string | null;
  details_json: Record<string, unknown>;
}

export interface ReadOnlySummaryPayload {
  generated_at: string;
  title: string;
  profile: {
    child_name: string | null;
    child_birth_date: string | null;
    due_date: string | null;
    timezone: string;
    phase: string;
  };
  stable_child_facts: StableChildFacts;
  growth_curve: GrowthCurvePayload;
  today_summary: ReadOnlyTodaySummary;
  reference_targets: ReferenceTargetsBlock;
  last_7_days_summary: TodaySummary[];
  today_events: ReadOnlyRecentEvent[];
  recent_events: ReadOnlyRecentEvent[];
  active_state: {
    open_sleep_session: ReadOnlyActiveSession | null;
    open_tummy_time_session: ReadOnlyActiveSession | null;
    open_breast_session: ReadOnlyActiveSession | null;
  };
  data_quality: ReadOnlyQualityFlag[];
  open_checklists: Array<
    Pick<ChecklistItemRecord, "id" | "item_type" | "title" | "description" | "phase" | "source_basis" | "due_date" | "priority" | "status">
  >;
  recent_milestones: Array<Pick<MilestoneRecord, "id" | "milestone_type" | "title" | "observed_on" | "note">>;
}

export async function buildReadOnlySummaryPayload(store: Store, nowIso: string): Promise<ReadOnlySummaryPayload> {
  const profile = await store.getProfile();
  const stableChildFacts = await getStableChildFacts(store);
  const today = await buildTodaySummary(store, nowIso);
  const checklistSections = await new ChecklistService(store).listSections(nowIso);
  const overview = await buildStatusOverview(store, nowIso, 7);
  const todayDay = await buildStatusDay(store, nowIso, "today");
  const recentSince = toIsoUtc(new Date(new Date(nowIso).getTime() - 7 * 24 * 60 * 60 * 1000));
  const recentEvents = await store.listEvents({ since: recentSince, until: nowIso, limit: 12 });

  return {
    generated_at: nowIso,
    title: profile.read_only_title,
    profile: {
      child_name: profile.child_name,
      child_birth_date: profile.child_birth_date,
      due_date: profile.due_date,
      timezone: profile.timezone,
      phase: profile.phase
    },
    stable_child_facts: stableChildFacts,
    growth_curve: await buildGrowthCurvePayload(store, nowIso),
    today_summary: sanitizeTodaySummary(today),
    reference_targets: await buildTodayReferenceTargets(store, nowIso),
    last_7_days_summary: await buildLast7DaysSummary(store, nowIso),
    today_events: todayDay.events.map(sanitizeRecentEvent),
    recent_events: recentEvents.map(sanitizeRecentEvent),
    active_state: {
      open_sleep_session: sanitizeActiveSession(overview.active_state.open_sleep_session),
      open_tummy_time_session: sanitizeActiveSession(overview.active_state.open_tummy_time_session),
      open_breast_session: sanitizeActiveSession(overview.active_state.open_breast_session)
    },
    data_quality: overview.data_quality.map((flag) => ({
      code: flag.code,
      severity: flag.severity,
      message: flag.message
    })),
    open_checklists: checklistSections.current.slice(0, 8).map((item) => ({
      id: item.id,
      item_type: item.item_type,
      title: item.title,
      description: item.description,
      phase: item.phase,
      source_basis: item.source_basis,
      due_date: item.due_date,
      priority: item.priority,
      status: item.status
    })),
    recent_milestones: (await store.listMilestones({ limit: 5 })).map((item) => ({
      id: item.id,
      milestone_type: item.milestone_type,
      title: item.title,
      observed_on: item.observed_on,
      note: trimNote(item.note)
    }))
  };
}

function sanitizeTodaySummary(today: TodaySummary): ReadOnlyTodaySummary {
  return {
    ...today,
    open_sessions: (today.open_sessions ?? []).map((event) => ({
      event_type: event.event_type,
      occurred_at: event.occurred_at,
      local_date: event.local_date
    }))
  };
}

function sanitizeRecentEvent(event: EventRecord): ReadOnlyRecentEvent {
  return {
    event_type: event.event_type,
    occurred_at: event.occurred_at,
    ended_at: event.ended_at,
    local_date: event.local_date,
    amount_value: event.amount_value,
    amount_unit: event.amount_unit,
    note: trimNote(event.note),
    details_json: sanitizeDetails(event.details_json)
  };
}

function sanitizeActiveSession(session: ActiveSession | null): ReadOnlyActiveSession | null {
  if (!session) return null;
  return {
    event_type: session.event_type,
    occurred_at: session.occurred_at,
    elapsed_minutes: session.elapsed_minutes,
    note: trimNote(session.note)
  };
}

function trimNote(note: string | null): string | null {
  if (!note) return null;
  return note.length > 160 ? `${note.slice(0, 157)}...` : note;
}

function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(details).filter(([key, value]) => {
      if (/admin|private/i.test(key)) return false;
      if (typeof value === "string" && value.length > 160) return false;
      return typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value == null || Array.isArray(value);
    })
  );
}
