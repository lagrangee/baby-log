export type JsonRecord = Record<string, unknown>;

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

export type EventType =
  | "feed_breast"
  | "feed_bottle"
  | "diaper_pee"
  | "diaper_poop"
  | "sleep_session"
  | "temperature"
  | "medicine"
  | "note"
  | "symptom"
  | "tummy_time"
  | "growth_measurement";

export type PrimaryEventType =
  | "feed_breast"
  | "feed_bottle"
  | "diaper_pee"
  | "diaper_poop"
  | "sleep_session"
  | "temperature"
  | "medicine"
  | "note";

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
  details_json: JsonRecord;
  source?: string;
  created_by?: Actor;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface DisplayEventRecord {
  id?: string;
  event_type: EventType;
  occurred_at: string;
  ended_at: string | null;
  amount_value: number | null;
  amount_unit: string | null;
  note: string | null;
  details_json: JsonRecord;
}

export interface ChecklistItemRecord {
  id: string;
  title: string;
  description: string | null;
  item_type: ChecklistItemType;
  phase: ChecklistPhase;
  source_basis: ChecklistSourceBasis;
  template_code?: string | null;
  template_item_key?: string | null;
  template_version?: string | null;
  due_date: string | null;
  due_rule_json?: JsonRecord;
  details_json?: JsonRecord;
  status: ChecklistStatus;
  priority: Priority;
  note: string | null;
  completed_at?: string | null;
  skipped_at?: string | null;
  archived_at?: string | null;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ChecklistTemplateItem {
  key: string;
  template_code: string;
  template_version: string;
  template_item_key: string;
  title: string;
  description: string | null;
  category: string;
  activation: ChecklistActivation;
  item_type: ChecklistItemType;
  phase: ChecklistPhase;
  source_basis: ChecklistSourceBasis;
  priority: Priority;
  sort_order: number;
  details_json: JsonRecord;
  due_rule_json: JsonRecord;
  due_date: string | null;
  note: string | null;
}

export interface ChecklistTemplateEntry {
  template_code: string;
  template_version: string;
  title: string;
  description: string | null;
  phase: ChecklistPhase;
  source_basis: ChecklistSourceBasis;
  auto_apply: false;
  import_policy: "manual";
  requires_confirmation: boolean;
  recommended_now: boolean;
  future: boolean;
  stage_status: "past_stage" | "current_stage" | "future_stage";
  reference_only: boolean;
  imported_status: "not_imported" | "partially_imported" | "imported";
  item_count: number;
  imported_item_count: number;
  latest_imported_at: string | null;
  items: ChecklistTemplateItem[];
}

export interface ChecklistSectionsPayload {
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
  source_kind?: "seed" | "custom";
  source_ref?: string | null;
  details_json?: JsonRecord;
  created_at?: string;
  updated_at?: string;
  suggested_age_label?: string;
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
  latest_medicine: JsonRecord | null;
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
    latest: JsonRecord | null;
  };
  notes: {
    count: number;
  };
}

export interface StatusOverviewPayload {
  generated_at: string;
  profile: Pick<AppProfile, "child_name" | "child_birth_date" | "due_date" | "timezone" | "phase"> & {
    age_days: number | null;
    birth_day_number: number | null;
    days_to_due: number | null;
  };
  active_state: {
    open_sleep_session: { id: string; event_type: EventType; occurred_at: string; elapsed_minutes: number; note: string | null; details_json: JsonRecord } | null;
    open_tummy_time_session: { id: string; event_type: EventType; occurred_at: string; elapsed_minutes: number; note: string | null; details_json: JsonRecord } | null;
    open_breast_session: { id: string; event_type: EventType; occurred_at: string; elapsed_minutes: number; note: string | null; details_json: JsonRecord } | null;
  };
  today: StatusDailySummary;
  last_7_days: StatusDailySummary[];
  trend_summary: {
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
  };
  data_quality: Array<{ code: string; severity: "info" | "warning"; message: string; related_event_id?: string }>;
  birth_ready: {
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
  } | null;
  first_week: {
    birth_day_number: number;
    summary_24h: StatusDailySummary;
    data_quality: Array<{ code: string; severity: "info" | "warning"; message: string; related_event_id?: string }>;
  } | null;
  reference_targets: ReferenceTargetsPayload;
}

export interface StatusDayPayload {
  generated_at: string;
  preset: "today" | "yesterday";
  local_date: string;
  profile: Pick<AppProfile, "child_name" | "child_birth_date" | "due_date" | "timezone" | "phase">;
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
  details_json: JsonRecord;
}

export interface ChecklistTemplatePresence {
  template_code: "aap_birth_hospital_v1" | "aap_first_week_v1";
  title: string;
  imported: boolean;
  imported_item_count: number;
  active_pending_count: number;
}

export interface StatusTimelinePayload {
  generated_at: string;
  timezone: string;
  range: StatusRange;
  event_types: EventType[];
  groups: Array<{
    local_date: string;
    summary: StatusDailySummary;
    events: EventRecord[];
  }>;
}

export interface StatusRange {
  label: string;
  start_utc: string;
  end_utc: string;
  start_local_date: string;
  end_local_date: string;
  preset: string | null;
}

export interface ReferenceTargetsPayload {
  generated_at: string;
  age_context: {
    birth_day_number: number | null;
    age_days: number | null;
    phase: string;
  };
  items: ReferenceTargetItem[];
  disclaimer: string;
  missing_birth_date_message: string | null;
}

export interface ReferenceTargetItem {
  key: string;
  category: "feeding" | "diaper" | "sleep" | "temperature" | "tummy_time" | "safe_sleep" | "well_visit" | "growth" | "development";
  title: string;
  reference_text: string;
  why_it_matters: string;
  target_label: string | null;
  current_value: number | null;
  unit: string | null;
  status: "not_applicable" | "not_enough_data" | "within_reference" | "below_reference" | "above_reference" | "reference_only" | "red_flag_recorded";
  message: string;
  severity: "reference" | "info" | "attention" | "red_flag";
  source_basis: string[];
}

export interface StatusRangeAnalyticsPayload {
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
  reference_targets: ReferenceTargetItem[];
  reference_targets_note: string;
}

export interface PediatricSummaryPayload {
  generated_at: string;
  range: "24h" | "3d" | "7d" | "custom";
  range_label: string;
  timezone: string;
  plain_text: string;
  structured: Record<"basic_info" | "feeding" | "diaper" | "sleep" | "temperature" | "growth" | "symptoms" | "medicines" | "notes" | "data_quality" | "reference_targets", string[]>;
}

export interface BootstrapPayload {
  profile: AppProfile;
  stable_child_facts: StableChildFacts;
  growth_curve: GrowthCurvePayload;
  today_summary: TodaySummary;
  reference_targets?: ReferenceTargetsPayload;
  recent_events: EventRecord[];
  open_checklists: ChecklistItemRecord[];
  seed_milestones: MilestoneRecord[];
}

export interface ReadOnlySummaryPayload {
  generated_at: string;
  title: string;
  profile: Pick<AppProfile, "child_name" | "child_birth_date" | "due_date" | "timezone" | "phase">;
  stable_child_facts: StableChildFacts;
  growth_curve: GrowthCurvePayload;
  today_summary: TodaySummary;
  reference_targets: ReferenceTargetsPayload;
  last_7_days_summary: TodaySummary[];
  today_events: ReadOnlyRecentEvent[];
  recent_events: ReadOnlyRecentEvent[];
  active_state: {
    open_sleep_session: ReadOnlyActiveSession | null;
    open_tummy_time_session: ReadOnlyActiveSession | null;
    open_breast_session: ReadOnlyActiveSession | null;
  };
  data_quality: ReadOnlyDataQualityFlag[];
  open_checklists: ChecklistItemRecord[];
  recent_milestones: MilestoneRecord[];
}

export interface ReadOnlyRecentEvent {
  event_type: EventType;
  occurred_at: string;
  ended_at: string | null;
  local_date: string;
  amount_value: number | null;
  amount_unit: string | null;
  note: string | null;
  details_json: JsonRecord;
}

export interface ReadOnlyActiveSession {
  event_type: EventType;
  occurred_at: string;
  elapsed_minutes: number;
  note: string | null;
}

export interface ReadOnlyDataQualityFlag {
  code: string;
  severity: "info" | "warning";
  message: string;
}

export type GrowthCurveMeasureType = "weight_kg" | "length_cm" | "head_circumference_cm";
export type GrowthCurveStatus = "within_reference_band" | "below_reference_band" | "above_reference_band" | "no_measurement" | "unavailable";
export type GrowthCurveTrendDirection = "stable" | "slightly_up" | "slightly_down" | "up" | "down" | "baseline_only" | "unavailable";

export interface GrowthCurveReference {
  age_days: number;
  birth_day_number: number;
  p2: number;
  p25: number;
  p50: number;
  p75: number;
  p98: number;
  unit: "g" | "cm";
}

export interface GrowthCurveMeasurement {
  value: number;
  unit: "g" | "cm";
  occurred_at: string;
  local_date: string;
  age_days: number;
  birth_day_number: number;
  source: "event" | "birth_fact";
  percentile: number | null;
  z_score: number | null;
}

export interface GrowthCurveTrend {
  birth_percentile: number | null;
  current_percentile: number | null;
  birth_z_score: number | null;
  current_z_score: number | null;
  z_score_delta: number | null;
  direction: GrowthCurveTrendDirection;
  label: string;
}

export interface GrowthCurveItem {
  measure_type: GrowthCurveMeasureType;
  label: string;
  unit: "g" | "cm";
  latest_measurement: GrowthCurveMeasurement | null;
  reference: GrowthCurveReference | null;
  position_percent: number | null;
  common_position_percent: number | null;
  personal_trend: GrowthCurveTrend | null;
  status: GrowthCurveStatus;
  message: string;
}

export interface GrowthCurvePayload {
  generated_at: string;
  available: boolean;
  missing: Array<"sex" | "birth_date">;
  source: {
    standard: "who_child_growth_standards";
    dataset: string;
    dataset_url: string;
    coverage: "birth_to_day_730";
    coverage_label: string;
    calculation: "lms";
    band: "p2_p98";
    band_label: string;
    note: string;
  };
  profile_context: {
    sex: StableChildFacts["sex"];
    birth_date: string | null;
    current_age_days: number | null;
    current_birth_day_number: number | null;
    timezone: string;
  };
  items: GrowthCurveItem[];
}

export interface ToastState {
  id: number;
  message: string;
  action?: {
    label: string;
    onClick: () => Promise<void> | void;
  };
}

export type ShowToast = (message: string, action?: ToastState["action"]) => void;
