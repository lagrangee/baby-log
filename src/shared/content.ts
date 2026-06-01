import recordItemsSeed from "../server/data/record-items.json";

export class ValidationError extends Error {
  status = 400;
}

export const HOME_QUICK_BUTTONS = recordItemsSeed.home_quick_buttons_order as readonly string[];
export const MORE_RECORD_TYPES = recordItemsSeed.more_record_types as readonly string[];

const itemMap = new Map(recordItemsSeed.items.map((item) => [item.event_type, item]));

export type EventType = (typeof recordItemsSeed.items)[number]["event_type"];

export function isAllowedEventType(value: string): value is EventType {
  return itemMap.has(value);
}

export function getEventDefinition(eventType: EventType) {
  const definition = itemMap.get(eventType);
  if (!definition) {
    throw new ValidationError(`Unknown event_type: ${eventType}`);
  }
  return definition;
}

export function getEventLabel(eventType: string): string {
  return isAllowedEventType(eventType) ? getEventDefinition(eventType).label : eventType;
}

export function validateEventInput(input: {
  event_type: string;
  occurred_at?: string;
  ended_at?: string | null;
  amount_value?: number | null;
  amount_unit?: string | null;
  note?: string | null;
  details_json?: Record<string, unknown> | null;
}) {
  if (!isAllowedEventType(input.event_type)) {
    throw new ValidationError(`event_type is not allowed: ${input.event_type}`);
  }
  if (!input.occurred_at || Number.isNaN(Date.parse(input.occurred_at))) {
    throw new ValidationError("occurred_at is required and must be an ISO datetime");
  }
  if (input.ended_at && Number.isNaN(Date.parse(input.ended_at))) {
    throw new ValidationError("ended_at must be an ISO datetime");
  }

  const details = input.details_json ?? {};
  const requireNumber = (field: string, value: unknown) => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new ValidationError(`${field} is required`);
    }
  };
  const requirePositiveFiniteNumber = (field: string, value: unknown, max?: number) => {
    requireNumber(field, value);
    const numericValue = value as number;
    if (!Number.isFinite(numericValue) || numericValue <= 0 || (max != null && numericValue > max)) {
      throw new ValidationError(max == null ? `${field} must be a positive number` : `${field} must be > 0 and <= ${max}`);
    }
  };
  const requireText = (field: string, value: unknown) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new ValidationError(`${field} is required`);
    }
  };
  const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;
  const requireUnit = (unit: string) => {
    if (input.amount_unit !== unit) {
      throw new ValidationError(`amount_unit must be ${unit}`);
    }
  };
  const requireEnum = (field: string, value: unknown, allowed: readonly string[]) => {
    if (value != null && (!allowed.includes(String(value)))) {
      throw new ValidationError(`${field} must be one of ${allowed.join(", ")}`);
    }
  };

  switch (input.event_type) {
    case "feed_bottle":
      requireNumber("amount_value", input.amount_value);
      requireUnit("ml");
      requireEnum("details_json.milk_type", details.milk_type, ["formula", "breastmilk", "mixed", "other"]);
      break;
    case "temperature":
      requireNumber("amount_value", input.amount_value);
      requireUnit("celsius");
      requireEnum("details_json.method", details.method, ["rectal", "ear", "forehead", "armpit", "oral", "other"]);
      break;
    case "medicine":
      if (!hasText(details.name) && !hasText(details.dose)) {
        throw new ValidationError("details_json.name or details_json.dose is required");
      }
      requireEnum("details_json.route", details.route, ["oral", "nasal", "topical", "rectal", "other"]);
      break;
    case "note":
      requireText("note", input.note);
      break;
    case "feed_breast":
      requireEnum("details_json.session_mode", details.session_mode, ["timed", "count_only"]);
      requireEnum("details_json.side", details.side, ["left", "right", "both", "unknown"]);
      if (details.duration_min != null) {
        requirePositiveFiniteNumber("details_json.duration_min", details.duration_min, 240);
      }
      requireEnum("details_json.effective_suck", details.effective_suck, ["yes", "no", "unknown"]);
      requireEnum("details_json.baby_state_after", details.baby_state_after, ["satisfied", "sleepy", "still_hungry", "unknown"]);
      requireEnum("details_json.spit_up", details.spit_up, ["none", "small", "large", "unknown"]);
      break;
    case "diaper_poop":
      requireEnum("details_json.color", details.color, ["black_tar", "green", "yellow", "brown", "red", "white", "other"]);
      requireEnum("details_json.texture", details.texture, ["watery", "loose", "seedy", "pasty", "hard", "mucus", "other"]);
      break;
    case "symptom":
      if (!Array.isArray(details.symptom_tags) && !(typeof input.note === "string" && input.note.trim())) {
        throw new ValidationError("details_json.symptom_tags or note is required");
      }
      requireEnum("details_json.severity", details.severity, ["mild", "moderate", "severe", "unknown"]);
      break;
    case "growth_measurement":
      requireText("details_json.measure_type", details.measure_type);
      requireEnum("details_json.measure_type", details.measure_type, ["weight_kg", "length_cm", "head_circumference_cm"]);
      requireNumber("amount_value", input.amount_value);
      break;
  }

  return {
    definition: getEventDefinition(input.event_type),
    details
  };
}
