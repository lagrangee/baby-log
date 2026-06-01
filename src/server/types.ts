import type { EventType } from "../shared/content";

export type Actor = "dad" | "mom" | "system";
export type ChecklistStatus = "pending" | "done" | "skipped";
export type ChecklistActivation = "core_auto" | "recommended" | "reference" | "manual_optional";
export type ChecklistPhase =
  | "prenatal"
  | "birth_hospital"
  | "first_week"
  | "first_month"
  | "infant_1_3m"
  | "infant_4_7m"
  | "infant_8_12m"
  | "toddler_12_18m"
  | "toddler_18_24m"
  | "toddler_24_30m"
  | "toddler_3y"
  | "preschool_4_5y"
  | "early_school_6y";
export type ChecklistSourceBasis =
  | "aap_book"
  | "aap_bright_futures"
  | "healthychildren"
  | "cdc_us"
  | "beijing_local"
  | "china_local"
  | "clinician"
  | "custom";
export type ChecklistItemType = "well_visit" | "screening" | "vaccine" | "admin" | "safety" | "feeding_plan" | "custom";
export type Priority = "low" | "normal" | "high";

export interface AppProfile {
  id: 1;
  family_label: string | null;
  child_name: string | null;
  child_birth_date: string | null;
  due_date: string | null;
  timezone: string;
  locale: string;
  phase: "pregnancy_prebirth" | "newborn_or_baby";
  read_only_title: string;
  machine_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventInput {
  event_type: string;
  occurred_at: string;
  ended_at?: string | null;
  amount_value?: number | null;
  amount_unit?: string | null;
  note?: string | null;
  details_json?: Record<string, unknown> | null;
}

export interface EventRecord {
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
  source: string;
  created_by: Actor;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EventRangeMeta {
  first_event_at: string | null;
  latest_event_at: string | null;
  event_count: number;
  available_from_local_date: string | null;
  available_to_local_date: string | null;
}

export interface StableChildFacts {
  nickname: string | null;
  sex: "female" | "male" | "unknown" | null;
  birth_datetime: string | null;
  birth_date: string | null;
  birth_weight_g: number | null;
  birth_length_cm: number | null;
  birth_head_circumference_cm: number | null;
  gestational_age_label: string | null;
  delivery_mode: string | null;
  apgar: string | null;
  current_feeding_mode: string | null;
}

export interface ChecklistItemRecord {
  id: string;
  title: string;
  description: string | null;
  item_type: ChecklistItemType;
  phase: ChecklistPhase;
  source_basis: ChecklistSourceBasis;
  template_code: string | null;
  template_item_key: string | null;
  template_version: string | null;
  due_date: string | null;
  due_rule_json: Record<string, unknown>;
  details_json: Record<string, unknown>;
  status: ChecklistStatus;
  priority: Priority;
  note: string | null;
  completed_at: string | null;
  skipped_at: string | null;
  archived_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ChecklistTemplateImportRecord {
  id: string;
  template_code: string;
  template_version: string;
  imported_at: string;
  imported_by: Actor | "system";
  item_count: number;
  created_count: number;
  skipped_existing_count: number;
  details_json: Record<string, unknown>;
}

export interface ChecklistSections {
  summary: {
    current_count: number;
    upcoming_count: number;
    completed_count: number;
    skipped_hidden_count: number;
    reference_count: number;
    total_active_count: number;
  };
  current: ChecklistItemRecord[];
  upcoming: ChecklistItemRecord[];
  reference: ChecklistItemRecord[];
  completed: ChecklistItemRecord[];
  skipped_hidden: ChecklistItemRecord[];
}

export interface MilestoneRecord {
  id: string;
  milestone_type: "social" | "motor" | "language" | "custom";
  title: string;
  observed_on: string;
  note: string | null;
  source_kind: "seed" | "custom";
  source_ref: string | null;
  details_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TodaySummary {
  date: string;
  feed_breast_count: number;
  feed_bottle_count: number;
  bottle_ml_total: number;
  bottle_formula_ml_total: number;
  bottle_breastmilk_ml_total: number;
  breast_minutes_total: number;
  breast_left_minutes_total: number;
  breast_right_minutes_total: number;
  pee_count: number;
  poop_count: number;
  sleep_session_count: number;
  sleep_minutes_total: number;
  latest_feeding_at: string | null;
  latest_breast_at: string | null;
  latest_bottle_at: string | null;
  latest_pee_at: string | null;
  latest_poop_at: string | null;
  latest_temperature_c: number | null;
  latest_temperature: {
    value_c: number;
    occurred_at: string;
    method: unknown;
  } | null;
  latest_medicine: Record<string, unknown> | null;
  growth: {
    latest_weight_g: number | null;
    latest_length_cm: number | null;
    latest_head_circumference_cm: number | null;
    latest_measure_type: "weight_kg" | "length_cm" | "head_circumference_cm" | null;
    latest_value: number | null;
    latest_at: string | null;
  };
  system_flags: string[];
  open_sessions?: EventRecord[];
}

export interface Store {
  getProfile(): Promise<AppProfile>;
  updateProfile(patch: Partial<AppProfile>, nowIso: string): Promise<AppProfile>;
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string, nowIso: string): Promise<void>;

  insertEvent(event: EventRecord): Promise<EventRecord>;
  updateEvent(id: string, patch: Partial<EventRecord>, nowIso: string): Promise<EventRecord | null>;
  getEvent(id: string): Promise<EventRecord | null>;
  getEventRangeMeta(): Promise<EventRangeMeta>;
  listEvents(options: { days?: number; since?: string; until?: string; event_type?: string; limit?: number; includeDeleted?: boolean }): Promise<EventRecord[]>;
  listEventsInUtcRange(
    startUtc: string,
    endUtcExclusive: string,
    options?: { event_type?: string; limit?: number; includeDeleted?: boolean }
  ): Promise<EventRecord[]>;
  listEventsByLocalDate(localDate: string): Promise<EventRecord[]>;
  listOpenEventsByType(eventType: EventType): Promise<EventRecord[]>;
  listOpenSleepSessions(): Promise<EventRecord[]>;
  listSleepEventsOverlappingRange(startUtc: string, endUtc: string, openEndedAt: string): Promise<EventRecord[]>;

  insertChecklistItem(item: ChecklistItemRecord): Promise<ChecklistItemRecord>;
  updateChecklistItem(id: string, patch: Partial<ChecklistItemRecord>, nowIso: string): Promise<ChecklistItemRecord | null>;
  listChecklistItems(options: { status?: ChecklistStatus; includeArchived?: boolean }): Promise<ChecklistItemRecord[]>;
  getChecklistItemByTemplateKey(templateCode: string, templateVersion: string, templateItemKey: string): Promise<ChecklistItemRecord | null>;
  insertChecklistTemplateImport(record: ChecklistTemplateImportRecord): Promise<ChecklistTemplateImportRecord>;
  listChecklistTemplateImports(): Promise<ChecklistTemplateImportRecord[]>;

  insertMilestone(item: MilestoneRecord): Promise<MilestoneRecord>;
  listMilestones(options?: { limit?: number }): Promise<MilestoneRecord[]>;

  listAttachmentsManifest(): Promise<Record<string, unknown>[]>;
}
