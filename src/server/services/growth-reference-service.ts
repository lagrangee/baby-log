import type { EventRecord, StableChildFacts, Store } from "../types";
import { localDateForTimezone } from "../utils/time";
import { getStableChildFacts } from "./stable-child-facts-service";
import { WHO_GROWTH_REFERENCE_DAYS } from "./growth-reference-data";

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

const METRICS: Array<{ measureType: GrowthCurveMeasureType; label: string; unit: "g" | "cm"; referenceKey: "w" | "l" | "h" }> = [
  { measureType: "weight_kg", label: "Weight", unit: "g", referenceKey: "w" },
  { measureType: "length_cm", label: "Length", unit: "cm", referenceKey: "l" },
  { measureType: "head_circumference_cm", label: "Head circumference", unit: "cm", referenceKey: "h" }
];

const DATASET_URL = "https://www.cdc.gov/growth-chart-training/media/files/WHOref_d.csv";
const MAX_REFERENCE_AGE_DAYS = 91;

export async function buildGrowthCurvePayload(store: Store, nowIso: string): Promise<GrowthCurvePayload> {
  const profile = await store.getProfile();
  const stableFacts = await getStableChildFacts(store);
  const sex = stableFacts.sex === "male" || stableFacts.sex === "female" ? stableFacts.sex : null;
  const birthDate = stableFacts.birth_date ?? profile.child_birth_date;
  const currentLocalDate = localDateForTimezone(nowIso, profile.timezone);
  const currentAgeDays = birthDate ? daysBetweenDates(birthDate, currentLocalDate) : null;
  const missing: GrowthCurvePayload["missing"] = [];
  if (!sex) missing.push("sex");
  if (!birthDate) missing.push("birth_date");

  const basePayload = {
    generated_at: nowIso,
    available: missing.length === 0,
    missing,
    source: {
      standard: "who_child_growth_standards" as const,
      dataset: "CDC WHOref_d LMS",
      dataset_url: DATASET_URL,
      band: "p2_p98" as const,
      band_label: "2nd-98th percentile reference band",
      note: "For family observation and review only; it does not replace well-child care or pediatric judgment."
    },
    profile_context: {
      sex: stableFacts.sex,
      birth_date: birthDate ?? null,
      current_age_days: currentAgeDays,
      current_birth_day_number: currentAgeDays == null ? null : currentAgeDays + 1,
      timezone: profile.timezone
    }
  };

  if (!sex || !birthDate) {
    return { ...basePayload, items: [] };
  }

  const events = await store.listEvents({ event_type: "growth_measurement", limit: 200 });
  return {
    ...basePayload,
    available: true,
    items: METRICS.map((metric) => buildGrowthCurveItem(metric, stableFacts, events, sex, birthDate, currentAgeDays))
  };
}

function buildGrowthCurveItem(
  metric: (typeof METRICS)[number],
  stableFacts: StableChildFacts,
  events: EventRecord[],
  sex: "male" | "female",
  birthDate: string,
  currentAgeDays: number | null
): GrowthCurveItem {
  const latestMeasurement = latestMeasurementFor(metric, stableFacts, events, birthDate, sex);
  const referenceAgeDays = latestMeasurement?.age_days ?? currentAgeDays;
  const reference = referenceAgeDays == null ? null : referenceFor(sex, metric, referenceAgeDays);
  const personalTrend = personalTrendFor(metric, stableFacts, latestMeasurement, sex);

  if (!latestMeasurement) {
    return {
      measure_type: metric.measureType,
      label: metric.label,
      unit: metric.unit,
      latest_measurement: null,
      reference,
      position_percent: null,
      common_position_percent: null,
      personal_trend: personalTrend,
      status: "no_measurement",
      message: `No ${metric.label.toLowerCase()} record yet. Add it through growth measurement when available.`
    };
  }
  if (!reference) {
    return {
      measure_type: metric.measureType,
      label: metric.label,
      unit: metric.unit,
      latest_measurement: latestMeasurement,
      reference: null,
      position_percent: null,
      common_position_percent: null,
      personal_trend: personalTrend,
      status: "unavailable",
      message: "The app currently provides WHO reference bands for 0-13 weeks after birth only."
    };
  }

  const positionPercent = clamp(((latestMeasurement.value - reference.p2) / (reference.p98 - reference.p2)) * 100, 0, 100);
  const commonPositionPercent = clamp(((latestMeasurement.value - reference.p25) / (reference.p75 - reference.p25)) * 100, 0, 100);
  const status = latestMeasurement.value < reference.p2 ? "below_reference_band" : latestMeasurement.value > reference.p98 ? "above_reference_band" : "within_reference_band";
  return {
    measure_type: metric.measureType,
    label: metric.label,
    unit: metric.unit,
    latest_measurement: latestMeasurement,
    reference,
    position_percent: Math.round(positionPercent),
    common_position_percent: Math.round(commonPositionPercent),
    personal_trend: personalTrend,
    status,
    message: statusMessage(status)
  };
}

function latestMeasurementFor(
  metric: (typeof METRICS)[number],
  stableFacts: StableChildFacts,
  events: EventRecord[],
  birthDate: string,
  sex: "male" | "female"
): GrowthCurveMeasurement | null {
  const latestEvent = events.find((event) => event.details_json.measure_type === metric.measureType && event.amount_value != null);
  if (latestEvent?.amount_value != null) {
    const value = metric.measureType === "weight_kg" ? Math.round(latestEvent.amount_value * 1000) : roundToTenth(latestEvent.amount_value);
    const ageDays = daysBetweenDates(birthDate, latestEvent.local_date);
    const percentile = percentileFor(sex, metric, ageDays, value);
    return {
      value,
      unit: metric.unit,
      occurred_at: latestEvent.occurred_at,
      local_date: latestEvent.local_date,
      age_days: ageDays,
      birth_day_number: ageDays + 1,
      source: "event",
      percentile: percentile?.percentile ?? null,
      z_score: percentile?.zScore ?? null
    };
  }

  const birthFactValue = birthFactFor(metric.measureType, stableFacts);
  if (birthFactValue == null) return null;
  const percentile = percentileFor(sex, metric, 0, birthFactValue);
  return {
    value: birthFactValue,
    unit: metric.unit,
    occurred_at: stableFacts.birth_datetime ?? `${birthDate}T00:00:00Z`,
    local_date: birthDate,
    age_days: 0,
    birth_day_number: 1,
    source: "birth_fact",
    percentile: percentile?.percentile ?? null,
    z_score: percentile?.zScore ?? null
  };
}

function referenceFor(sex: "male" | "female", metric: (typeof METRICS)[number], ageDays: number): GrowthCurveReference | null {
  if (ageDays < 0 || ageDays > MAX_REFERENCE_AGE_DAYS) return null;
  const row = WHO_GROWTH_REFERENCE_DAYS[sex][ageDays];
  if (!row) return null;
  const [p2, p25, p50, p75, p98] = row[metric.referenceKey];
  return {
    age_days: ageDays,
    birth_day_number: ageDays + 1,
    p2,
    p25,
    p50,
    p75,
    p98,
    unit: metric.unit
  };
}

function personalTrendFor(
  metric: (typeof METRICS)[number],
  stableFacts: StableChildFacts,
  latestMeasurement: GrowthCurveMeasurement | null,
  sex: "male" | "female"
): GrowthCurveTrend | null {
  const birthFactValue = birthFactFor(metric.measureType, stableFacts);
  if (birthFactValue == null) return null;
  const birth = percentileFor(sex, metric, 0, birthFactValue);
  if (!birth) return null;
  if (!latestMeasurement || latestMeasurement.source === "birth_fact" || latestMeasurement.z_score == null || latestMeasurement.percentile == null) {
    return {
      birth_percentile: birth.percentile,
      current_percentile: null,
      birth_z_score: birth.zScore,
      current_z_score: null,
      z_score_delta: null,
      direction: "baseline_only",
      label: "Waiting for a recent measurement"
    };
  }
  const delta = roundToHundredth(latestMeasurement.z_score - birth.zScore);
  const direction = trendDirection(delta);
  return {
    birth_percentile: birth.percentile,
    current_percentile: latestMeasurement.percentile,
    birth_z_score: birth.zScore,
    current_z_score: latestMeasurement.z_score,
    z_score_delta: delta,
    direction,
    label: trendLabel(direction)
  };
}

function percentileFor(sex: "male" | "female", metric: (typeof METRICS)[number], ageDays: number, value: number): { percentile: number; zScore: number } | null {
  if (ageDays < 0 || ageDays > MAX_REFERENCE_AGE_DAYS) return null;
  const row = WHO_GROWTH_REFERENCE_DAYS[sex][ageDays];
  if (!row) return null;
  const [, , , , , l, m, s] = row[metric.referenceKey];
  const zScore = l === 0 ? Math.log(value / m) / s : (Math.pow(value / m, l) - 1) / (l * s);
  return {
    percentile: roundToTenth(normalCdf(zScore) * 100),
    zScore: roundToHundredth(zScore)
  };
}

function birthFactFor(measureType: GrowthCurveMeasureType, stableFacts: StableChildFacts): number | null {
  if (measureType === "weight_kg") return stableFacts.birth_weight_g;
  if (measureType === "length_cm") return stableFacts.birth_length_cm;
  return stableFacts.birth_head_circumference_cm;
}

function daysBetweenDates(startDate: string, endDate: string): number {
  return Math.floor((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000);
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundToHundredth(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function statusMessage(status: Exclude<GrowthCurveStatus, "no_measurement" | "unavailable">): string {
  if (status === "within_reference_band") return "Within the WHO reference band.";
  if (status === "below_reference_band") return "Below the reference band; review with well-child care or a pediatrician.";
  return "Above the reference band; review with well-child care or a pediatrician.";
}

function trendDirection(delta: number): GrowthCurveTrendDirection {
  const abs = Math.abs(delta);
  if (abs < 0.35) return "stable";
  if (abs < 0.67) return delta > 0 ? "slightly_up" : "slightly_down";
  return delta > 0 ? "up" : "down";
}

function trendLabel(direction: GrowthCurveTrendDirection): string {
  if (direction === "stable") return "Stable trend";
  if (direction === "slightly_up") return "Slightly up";
  if (direction === "slightly_down") return "Slightly down";
  if (direction === "up") return "Clearly up; review together with consecutive records";
  if (direction === "down") return "Clearly down; review together with consecutive records";
  if (direction === "baseline_only") return "Waiting for a recent measurement";
  return "No trend yet";
}

function normalCdf(value: number): number {
  return 0.5 * (1 + erf(value / Math.SQRT2));
}

function erf(value: number): number {
  const sign = value >= 0 ? 1 : -1;
  const x = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));
  return sign * y;
}
