import { getEventDefinition, validateEventInput, ValidationError } from "../../shared/content";
import type { Actor, EventInput, EventRecord, Store } from "../types";
import { localDateForTimezone, toIsoUtc } from "../utils/time";

export class EventService {
  constructor(private readonly store: Store) {}

  async create(input: EventInput, createdBy: Actor, nowIso: string): Promise<EventRecord> {
    const { definition, details } = validateEventInput(input);
    const profile = await this.store.getProfile();
    const occurredAt = toIsoUtc(input.occurred_at);
    const endedAt = input.ended_at ? toIsoUtc(input.ended_at) : null;
    assertEndedAfterOccurred(occurredAt, endedAt);

    if (input.event_type === "sleep_session" && !endedAt) {
      const [open] = await this.store.listOpenSleepSessions();
      if (open) {
        const closedAt = occurredAt;
        const updated = await this.store.updateEvent(
          open.id,
          {
            ended_at: closedAt,
            note: input.note ?? open.note,
            details_json: { ...open.details_json, ...details }
          },
          nowIso
        );
        if (!updated) throw new Error("Open sleep session was not found");
        return updated;
      }
    }

    const record: EventRecord = {
      id: crypto.randomUUID(),
      category: definition.category,
      event_type: input.event_type,
      occurred_at: occurredAt,
      ended_at: endedAt,
      local_date: localDateForTimezone(occurredAt, profile.timezone),
      amount_value: input.amount_value ?? null,
      amount_unit: input.amount_unit ?? null,
      note: input.note ?? null,
      details_json: details,
      source: "manual",
      created_by: createdBy,
      created_at: nowIso,
      updated_at: nowIso,
      deleted_at: null
    };
    return this.store.insertEvent(record);
  }

  async update(id: string, patch: Partial<EventInput>, nowIso: string): Promise<EventRecord> {
    const existing = await this.store.getEvent(id);
    if (!existing || existing.deleted_at) {
      throw new Error("Event not found");
    }
    const merged: EventInput = {
      event_type: existing.event_type,
      occurred_at: patch.occurred_at ?? existing.occurred_at,
      ended_at: patch.ended_at === undefined ? existing.ended_at : patch.ended_at,
      amount_value: patch.amount_value === undefined ? existing.amount_value : patch.amount_value,
      amount_unit: patch.amount_unit === undefined ? existing.amount_unit : patch.amount_unit,
      note: patch.note === undefined ? existing.note : patch.note,
      details_json: patch.details_json === undefined ? existing.details_json : patch.details_json
    };
    const { details } = validateEventInput(merged);
    const profile = await this.store.getProfile();
    const occurredAt = toIsoUtc(merged.occurred_at);
    const endedAt = merged.ended_at ? toIsoUtc(merged.ended_at) : null;
    assertEndedAfterOccurred(occurredAt, endedAt);
    const updated = await this.store.updateEvent(
      id,
      {
        occurred_at: occurredAt,
        ended_at: endedAt,
        local_date: localDateForTimezone(occurredAt, profile.timezone),
        amount_value: merged.amount_value ?? null,
        amount_unit: merged.amount_unit ?? null,
        note: merged.note ?? null,
        details_json: details
      },
      nowIso
    );
    if (!updated) throw new Error("Event not found");
    return updated;
  }

  async delete(id: string, nowIso: string): Promise<void> {
    const updated = await this.store.updateEvent(id, { deleted_at: nowIso }, nowIso);
    if (!updated) {
      throw new Error("Event not found");
    }
  }

  async list(days = 7, eventType?: string) {
    if (eventType) {
      getEventDefinition(eventType as never);
    }
    return this.store.listEvents({ days, event_type: eventType, limit: 200 });
  }
}

function assertEndedAfterOccurred(occurredAt: string, endedAt: string | null) {
  if (endedAt && Date.parse(endedAt) <= Date.parse(occurredAt)) {
    throw new ValidationError("ended_at must be after occurred_at");
  }
}
