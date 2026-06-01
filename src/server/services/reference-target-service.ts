import catalog from "../data/reference-targets.json";
import type { StatusDailySummary, StatusOverviewResponse } from "./status-service";

export type ReferenceTargetCategory =
  | "feeding"
  | "diaper"
  | "sleep"
  | "temperature"
  | "tummy_time"
  | "safe_sleep"
  | "well_visit"
  | "growth"
  | "development";

export type ReferenceTargetSeverity = "reference" | "info" | "attention" | "red_flag";

export interface ReferenceTargetItem {
  key: string;
  category: ReferenceTargetCategory;
  phase: string;
  age_day_number_min?: number;
  age_day_number_max?: number;
  age_month_min?: number;
  age_month_max?: number;
  title: string;
  reference_text: string;
  why_it_matters: string;
  metric_path?: string;
  comparator?: "min" | "max" | "range" | "presence" | "none";
  min_value?: number;
  max_value?: number;
  unit?: string;
  severity: ReferenceTargetSeverity;
  source_basis: string[];
  display_mode: "compare" | "reference_only" | "red_flag";
}

export interface EvaluatedReferenceTarget {
  key: string;
  category: ReferenceTargetCategory;
  title: string;
  reference_text: string;
  why_it_matters: string;
  target_label: string | null;
  current_value: number | null;
  unit: string | null;
  status:
    | "not_applicable"
    | "not_enough_data"
    | "within_reference"
    | "below_reference"
    | "above_reference"
    | "reference_only"
    | "red_flag_recorded";
  message: string;
  severity: ReferenceTargetSeverity;
  source_basis: string[];
}

export interface ReferenceTargetsBlock {
  generated_at: string;
  age_context: {
    birth_day_number: number | null;
    age_days: number | null;
    phase: string;
  };
  items: EvaluatedReferenceTarget[];
  disclaimer: string;
  missing_birth_date_message: string | null;
}

interface ReferenceCatalog {
  catalog_code: string;
  version: string;
  runtime_policy: {
    d1_catalog: boolean;
    runtime_sync: boolean;
    diagnosis: boolean;
    treatment_advice: boolean;
    vaccine_schedule_generation: boolean;
  };
  items: ReferenceTargetItem[];
}

const referenceCatalog = catalog as ReferenceCatalog;

export function getReferenceCatalog(): ReferenceCatalog {
  return referenceCatalog;
}

export function buildReferenceTargets(
  profile: StatusOverviewResponse["profile"],
  summary: StatusDailySummary,
  nowIso: string
): ReferenceTargetsBlock {
  const ageContext = {
    birth_day_number: profile.birth_day_number,
    age_days: profile.age_days,
    phase: profile.phase
  };
  const disclaimer =
    "These references support record review and question preparation only. They are not diagnosis or treatment. Contact a pediatrician or hospital if feeding, diapers, temperature, alertness, or caregiver instinct is concerning.";

  if (profile.birth_day_number == null || profile.age_days == null) {
    return {
      generated_at: nowIso,
      age_context: ageContext,
      items: [],
      disclaimer: disclaimer,
      missing_birth_date_message: "Set the birth date to show stage references."
    };
  }

  return {
    generated_at: nowIso,
    age_context: ageContext,
    items: referenceCatalog.items
      .filter((item) => isApplicableForAge(item, profile.birth_day_number!, profile.age_days!))
      .map((item) => evaluateReferenceTarget(item, summary)),
    disclaimer: disclaimer,
    missing_birth_date_message: null
  };
}

export function evaluateReferenceTarget(item: ReferenceTargetItem, summary: StatusDailySummary): EvaluatedReferenceTarget {
  const currentValue = metricValue(summary, item.metric_path);
  const unit = item.unit ?? null;
  const status = targetStatus(item, currentValue);
  return {
    key: item.key,
    category: item.category,
    title: item.title,
    reference_text: item.reference_text,
    why_it_matters: item.why_it_matters,
    target_label: targetLabel(item),
    current_value: currentValue,
    unit: unit,
    status,
    message: messageForStatus(status),
    severity: item.severity,
    source_basis: item.source_basis
  };
}

function targetLabel(item: ReferenceTargetItem): string | null {
  const unit = item.unit ? ` ${item.unit}` : "";
  if (item.comparator === "min" && item.min_value != null) return `≥ ${formatReferenceNumber(item.min_value)}${unit}`;
  if (item.comparator === "max" && item.max_value != null) return `≤ ${formatReferenceNumber(item.max_value)}${unit}`;
  if (item.comparator === "range" && item.min_value != null && item.max_value != null) {
    return `${formatReferenceNumber(item.min_value)}–${formatReferenceNumber(item.max_value)}${unit}`;
  }
  if (item.comparator === "presence") return "recorded";
  return null;
}

function formatReferenceNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function isApplicableForAge(item: ReferenceTargetItem, birthDayNumber: number, ageDays: number): boolean {
  const ageMonth = Math.floor(ageDays / 30.4375);
  const dayMatches =
    (item.age_day_number_min == null || birthDayNumber >= item.age_day_number_min) &&
    (item.age_day_number_max == null || birthDayNumber <= item.age_day_number_max);
  const monthMatches =
    (item.age_month_min == null || ageMonth >= item.age_month_min) &&
    (item.age_month_max == null || ageMonth <= item.age_month_max);
  const hasDayRule = item.age_day_number_min != null || item.age_day_number_max != null;
  const hasMonthRule = item.age_month_min != null || item.age_month_max != null;
  if (hasDayRule && hasMonthRule) return dayMatches && monthMatches;
  if (hasDayRule) return dayMatches;
  if (hasMonthRule) return monthMatches;
  return true;
}

function targetStatus(item: ReferenceTargetItem, currentValue: number | null): EvaluatedReferenceTarget["status"] {
  if (item.display_mode === "reference_only" || item.comparator === "none" || !item.metric_path) return "reference_only";
  if (currentValue == null) return "not_enough_data";
  if (item.display_mode === "red_flag") {
    const threshold = item.max_value;
    if (threshold != null && currentValue > threshold) return "red_flag_recorded";
    return "within_reference";
  }
  if (item.comparator === "min") {
    return item.min_value != null && currentValue < item.min_value ? "below_reference" : "within_reference";
  }
  if (item.comparator === "max") {
    return item.max_value != null && currentValue > item.max_value ? "above_reference" : "within_reference";
  }
  if (item.comparator === "range") {
    if (item.min_value != null && currentValue < item.min_value) return "below_reference";
    if (item.max_value != null && currentValue > item.max_value) return "above_reference";
    return "within_reference";
  }
  if (item.comparator === "presence") {
    return currentValue > 0 ? "within_reference" : "not_enough_data";
  }
  return "reference_only";
}

function messageForStatus(status: EvaluatedReferenceTarget["status"]): string {
  if (status === "below_reference") {
    return "Records are below the reference. First check for missing entries; if this persists, urine is dark, or weight/alertness is concerning, contact a pediatrician.";
  }
  if (status === "above_reference") {
    return "Records are above the reference. This may reflect the selected range or individual variation; contact a pediatrician if there are symptoms or concerns.";
  }
  if (status === "red_flag_recorded") {
    return "A temperature at or above 38.0 C was recorded for a young infant. Verify the measurement method and value, then contact a pediatrician or hospital. The app does not determine the cause.";
  }
  if (status === "not_enough_data") return "There is not enough recorded data to compare with this reference.";
  if (status === "within_reference") return "Current records are within the reference range; this is still only a record comparison, not a medical judgment.";
  return "This is a stage reference and is not automatically compared with records.";
}

function metricValue(summary: StatusDailySummary, path: string | undefined): number | null {
  if (!path) return null;
  const value = path.split(".").reduce<unknown>((current, key) => {
    if (typeof current !== "object" || current === null) return undefined;
    return (current as Record<string, unknown>)[key];
  }, summary);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
