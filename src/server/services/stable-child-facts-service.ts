import { ValidationError } from "../../shared/content";
import type { AppProfile, StableChildFacts, Store } from "../types";
import { isValidDateOnly } from "../utils/time";

const META_KEY = "stable_child_facts";

export async function getStableChildFacts(store: Store): Promise<StableChildFacts> {
  const profile = await store.getProfile();
  const defaults = defaultStableChildFacts(profile);
  const raw = await store.getMeta(META_KEY);
  if (!raw) return defaults;
  try {
    return normalizeStableChildFacts(JSON.parse(raw) as Record<string, unknown>, defaults);
  } catch {
    return defaults;
  }
}

export async function updateStableChildFacts(store: Store, patch: Record<string, unknown>, nowIso: string): Promise<StableChildFacts> {
  const profile = await store.getProfile();
  const existing = await getStableChildFacts(store);
  const next = normalizeStableChildFacts({ ...existing, ...patch }, defaultStableChildFacts(profile));
  await store.setMeta(META_KEY, JSON.stringify(next), nowIso);
  return next;
}

function defaultStableChildFacts(profile: AppProfile): StableChildFacts {
  return {
    nickname: profile.child_name,
    sex: null,
    birth_datetime: null,
    birth_date: profile.child_birth_date,
    birth_weight_g: null,
    birth_length_cm: null,
    birth_head_circumference_cm: null,
    gestational_age_label: null,
    delivery_mode: null,
    apgar: null,
    current_feeding_mode: null
  };
}

function normalizeStableChildFacts(input: Record<string, unknown>, defaults: StableChildFacts): StableChildFacts {
  return {
    nickname: nullableText(input.nickname) ?? defaults.nickname,
    sex: nullableSex(input.sex),
    birth_datetime: nullableIso(input.birth_datetime, "birth_datetime"),
    birth_date: nullableDate(input.birth_date) ?? defaults.birth_date,
    birth_weight_g: nullableNumber(input.birth_weight_g, "birth_weight_g", 300, 8000),
    birth_length_cm: nullableNumber(input.birth_length_cm, "birth_length_cm", 20, 80),
    birth_head_circumference_cm: nullableNumber(input.birth_head_circumference_cm, "birth_head_circumference_cm", 15, 60),
    gestational_age_label: nullableText(input.gestational_age_label) ?? null,
    delivery_mode: nullableText(input.delivery_mode) ?? null,
    apgar: nullableText(input.apgar) ?? null,
    current_feeding_mode: nullableText(input.current_feeding_mode) ?? null
  };
}

function nullableText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function nullableSex(value: unknown): StableChildFacts["sex"] {
  const text = nullableText(value);
  if (!text) return null;
  if (text === "female" || text === "male" || text === "unknown") return text;
  throw new ValidationError("sex must be female, male, or unknown");
}

function nullableIso(value: unknown, field: string): string | null {
  const text = nullableText(value);
  if (!text) return null;
  if (Number.isNaN(Date.parse(text))) throw new ValidationError(`${field} must be an ISO datetime`);
  return new Date(text).toISOString().replace(".000Z", "Z");
}

function nullableDate(value: unknown): string | null | undefined {
  const text = nullableText(value);
  if (!text) return text;
  if (!isValidDateOnly(text)) throw new ValidationError("birth_date must be YYYY-MM-DD");
  return text;
}

function nullableNumber(value: unknown, field: string, min: number, max: number): number | null {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new ValidationError(`${field} must be between ${min} and ${max}`);
  return Math.round(number * 10) / 10;
}
