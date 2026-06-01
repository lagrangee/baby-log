import { ValidationError } from "../../shared/content";
import type { EventRecord, Store } from "../types";
import { toIsoUtc } from "../utils/time";
import { EventService } from "./event-service";

const READ_ACTIONS = new Set(["feed_bottle", "diaper_pee", "diaper_poop", "temperature", "sleep_start", "sleep_end"]);

export type ReadQuickAction = "feed_bottle" | "diaper_pee" | "diaper_poop" | "temperature" | "sleep_start" | "sleep_end";

export interface ReadQuickEventInput {
  [key: string]: unknown;
  action?: unknown;
  occurred_at?: unknown;
  amount_value?: unknown;
  milk_type?: unknown;
}

export async function createReadQuickEvent(store: Store, input: ReadQuickEventInput, nowIso: string): Promise<EventRecord> {
  const action = typeof input.action === "string" ? input.action : "";
  if (!READ_ACTIONS.has(action)) throw new ValidationError("Unsupported read action");
  const occurredAt = toIsoUtc(requiredString(input.occurred_at, "occurred_at is required"));

  if (action === "sleep_end") {
    const [openSleep] = await store.listOpenSleepSessions();
    if (!openSleep) throw new ValidationError("No open sleep session");
    const updated = await new EventService(store).update(openSleep.id, { ended_at: occurredAt }, nowIso);
    return updated;
  }

  if (action === "feed_bottle") {
    return new EventService(store).create(
      {
        event_type: "feed_bottle",
        occurred_at: occurredAt,
        amount_value: positiveNumber(input.amount_value),
        amount_unit: "ml",
        details_json: { milk_type: readBottleMilkType(input.milk_type) }
      },
      "system",
      nowIso
    );
  }

  if (action === "temperature") {
    return new EventService(store).create(
      {
        event_type: "temperature",
        occurred_at: occurredAt,
        amount_value: positiveNumber(input.amount_value),
        amount_unit: "celsius",
        details_json: { method: "forehead" }
      },
      "system",
      nowIso
    );
  }

  return new EventService(store).create(
    {
      event_type: action === "sleep_start" ? "sleep_session" : action,
      occurred_at: occurredAt,
      details_json: {}
    },
    "system",
    nowIso
  );
}

function requiredString(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) throw new ValidationError(message);
  return value;
}

function positiveNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new ValidationError("amount_value must be greater than 0");
  return number;
}

function readBottleMilkType(value: unknown): "formula" | "breastmilk" {
  if (value === "formula" || value === "breastmilk") return value;
  throw new ValidationError("milk_type must be formula or breastmilk");
}
