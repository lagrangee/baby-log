import type {
  AppProfile,
  ChecklistItemRecord,
  ChecklistStatus,
  ChecklistTemplateImportRecord,
  EventRecord,
  EventRangeMeta,
  MilestoneRecord,
  Store
} from "../types";
import type { EventType } from "../../shared/content";

type Row = Record<string, any>;

export class D1Store implements Store {
  constructor(private readonly db: D1Database) {}

  async getProfile(): Promise<AppProfile> {
    const row = await this.db.prepare("SELECT * FROM app_profile WHERE id = 1").first<Row>();
    if (!row) throw new Error("app_profile is missing; run D1 migrations first");
    return rowToProfile(row);
  }

  async updateProfile(patch: Partial<AppProfile>, nowIso: string): Promise<AppProfile> {
    const allowed = [
      "family_label",
      "child_name",
      "child_birth_date",
      "due_date",
      "timezone",
      "locale",
      "phase",
      "read_only_title",
      "machine_token"
    ] as const;
    const values: unknown[] = [];
    const sets: string[] = [];
    const normalized = { ...patch };
    if ("child_birth_date" in normalized) {
      normalized.phase = normalized.child_birth_date ? "newborn_or_baby" : "pregnancy_prebirth";
    }
    for (const key of allowed) {
      if (key in normalized) {
        sets.push(`${key} = ?`);
        values.push((normalized as Row)[key] ?? null);
      }
    }
    sets.push("updated_at = ?");
    values.push(nowIso);
    values.push(1);
    await this.db.prepare(`UPDATE app_profile SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
    return this.getProfile();
  }

  async getMeta(key: string): Promise<string | null> {
    const row = await this.db.prepare("SELECT value FROM app_meta WHERE key = ?").bind(key).first<{ value: string }>();
    return row?.value ?? null;
  }

  async setMeta(key: string, value: string, nowIso: string): Promise<void> {
    await this.db
      .prepare("INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
      .bind(key, value, nowIso)
      .run();
  }

  async insertEvent(event: EventRecord): Promise<EventRecord> {
    await this.db
      .prepare(
        `INSERT INTO events (
          id, category, event_type, occurred_at, ended_at, local_date, amount_value, amount_unit,
          note, details_json, source, created_by, created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        event.id,
        event.category,
        event.event_type,
        event.occurred_at,
        event.ended_at,
        event.local_date,
        event.amount_value,
        event.amount_unit,
        event.note,
        JSON.stringify(event.details_json),
        event.source,
        event.created_by,
        event.created_at,
        event.updated_at,
        event.deleted_at
      )
      .run();
    return event;
  }

  async updateEvent(id: string, patch: Partial<EventRecord>, nowIso: string): Promise<EventRecord | null> {
    const allowed = [
      "category",
      "event_type",
      "occurred_at",
      "ended_at",
      "local_date",
      "amount_value",
      "amount_unit",
      "note",
      "details_json",
      "source",
      "created_by",
      "deleted_at"
    ] as const;
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const key of allowed) {
      if (key in patch) {
        sets.push(`${key} = ?`);
        values.push(key === "details_json" ? JSON.stringify(patch.details_json ?? {}) : (patch as Row)[key] ?? null);
      }
    }
    sets.push("updated_at = ?");
    values.push(nowIso, id);
    await this.db.prepare(`UPDATE events SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
    return this.getEvent(id);
  }

  async getEvent(id: string): Promise<EventRecord | null> {
    const row = await this.db.prepare("SELECT * FROM events WHERE id = ?").bind(id).first<Row>();
    return row ? rowToEvent(row) : null;
  }

  async getEventRangeMeta(): Promise<EventRangeMeta> {
    const row = await this.db
      .prepare(
        `
        SELECT
          MIN(occurred_at) AS first_event_at,
          MAX(occurred_at) AS latest_event_at,
          COUNT(*) AS event_count,
          MIN(local_date) AS available_from_local_date,
          MAX(local_date) AS available_to_local_date
        FROM events
        WHERE deleted_at IS NULL
      `
      )
      .first<{
        first_event_at: string | null;
        latest_event_at: string | null;
        event_count: number | null;
        available_from_local_date: string | null;
        available_to_local_date: string | null;
      }>();
    return {
      first_event_at: row?.first_event_at ?? null,
      latest_event_at: row?.latest_event_at ?? null,
      event_count: Number(row?.event_count ?? 0),
      available_from_local_date: row?.available_from_local_date ?? null,
      available_to_local_date: row?.available_to_local_date ?? null
    };
  }

  async listEvents(options: { days?: number; since?: string; until?: string; event_type?: string; limit?: number; includeDeleted?: boolean }): Promise<EventRecord[]> {
    const where: string[] = [];
    const values: unknown[] = [];
    if (!options.includeDeleted) where.push("deleted_at IS NULL");
    if (options.event_type) {
      where.push("event_type = ?");
      values.push(options.event_type);
    }
    if (options.days) {
      const cutoff = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000).toISOString().replace(".000Z", "Z");
      where.push("occurred_at >= ?");
      values.push(cutoff);
    }
    if (options.since) {
      where.push("occurred_at >= ?");
      values.push(options.since);
    }
    if (options.until) {
      where.push("occurred_at <= ?");
      values.push(options.until);
    }
    if (options.limit !== undefined) values.push(options.limit);
    const sql = `SELECT * FROM events ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY occurred_at DESC${options.limit !== undefined ? " LIMIT ?" : ""}`;
    const result = await this.db.prepare(sql).bind(...values).all<Row>();
    return (result.results ?? []).map(rowToEvent);
  }

  async listEventsInUtcRange(
    startUtc: string,
    endUtcExclusive: string,
    options: { event_type?: string; limit?: number; includeDeleted?: boolean } = {}
  ): Promise<EventRecord[]> {
    const where: string[] = ["occurred_at >= ?", "occurred_at < ?"];
    const values: unknown[] = [startUtc, endUtcExclusive];
    if (!options.includeDeleted) where.push("deleted_at IS NULL");
    if (options.event_type) {
      where.push("event_type = ?");
      values.push(options.event_type);
    }
    if (options.limit !== undefined) values.push(options.limit);
    const sql = `SELECT * FROM events WHERE ${where.join(" AND ")} ORDER BY occurred_at DESC${options.limit !== undefined ? " LIMIT ?" : ""}`;
    const result = await this.db.prepare(sql).bind(...values).all<Row>();
    return (result.results ?? []).map(rowToEvent);
  }

  async listEventsByLocalDate(localDate: string): Promise<EventRecord[]> {
    const result = await this.db
      .prepare("SELECT * FROM events WHERE deleted_at IS NULL AND local_date = ? ORDER BY occurred_at ASC")
      .bind(localDate)
      .all<Row>();
    return (result.results ?? []).map(rowToEvent);
  }

  async listOpenEventsByType(eventType: EventType): Promise<EventRecord[]> {
    const result = await this.db
      .prepare("SELECT * FROM events WHERE deleted_at IS NULL AND event_type = ? AND ended_at IS NULL ORDER BY occurred_at ASC")
      .bind(eventType)
      .all<Row>();
    return (result.results ?? []).map(rowToEvent);
  }

  async listOpenSleepSessions(): Promise<EventRecord[]> {
    const result = await this.db
      .prepare("SELECT * FROM events WHERE deleted_at IS NULL AND event_type = 'sleep_session' AND ended_at IS NULL ORDER BY occurred_at ASC")
      .all<Row>();
    return (result.results ?? []).map(rowToEvent);
  }

  async listSleepEventsOverlappingRange(startUtc: string, endUtc: string, openEndedAt: string): Promise<EventRecord[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM events
         WHERE deleted_at IS NULL
           AND event_type = 'sleep_session'
           AND occurred_at < ?
           AND COALESCE(ended_at, ?) > ?
         ORDER BY occurred_at ASC`
      )
      .bind(endUtc, openEndedAt, startUtc)
      .all<Row>();
    return (result.results ?? []).map(rowToEvent);
  }

  async insertChecklistItem(item: ChecklistItemRecord): Promise<ChecklistItemRecord> {
    await this.db
      .prepare(
        `INSERT OR IGNORE INTO checklist_items (
          id, title, description, item_type, phase, source_basis, template_code, template_item_key,
          template_version, status, priority, due_date, due_rule_json, details_json, note,
          completed_at, skipped_at, archived_at, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        item.id,
        item.title,
        item.description,
        item.item_type,
        item.phase,
        item.source_basis,
        item.template_code,
        item.template_item_key,
        item.template_version,
        item.status,
        item.priority,
        item.due_date,
        JSON.stringify(item.due_rule_json),
        JSON.stringify(item.details_json),
        item.note,
        item.completed_at,
        item.skipped_at,
        item.archived_at,
        item.sort_order,
        item.created_at,
        item.updated_at
      )
      .run();
    return item;
  }

  async updateChecklistItem(id: string, patch: Partial<ChecklistItemRecord>, nowIso: string): Promise<ChecklistItemRecord | null> {
    const allowed = [
      "title",
      "description",
      "item_type",
      "phase",
      "source_basis",
      "due_date",
      "due_rule_json",
      "status",
      "priority",
      "note",
      "details_json",
      "completed_at",
      "skipped_at",
      "archived_at"
    ] as const;
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const key of allowed) {
      if (key in patch) {
        sets.push(`${key} = ?`);
        values.push(key === "details_json" || key === "due_rule_json" ? JSON.stringify((patch as Row)[key] ?? {}) : (patch as Row)[key] ?? null);
      }
    }
    sets.push("updated_at = ?");
    values.push(nowIso, id);
    await this.db.prepare(`UPDATE checklist_items SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
    const row = await this.db.prepare("SELECT * FROM checklist_items WHERE id = ?").bind(id).first<Row>();
    return row ? rowToChecklist(row) : null;
  }

  async listChecklistItems(options: { status?: ChecklistStatus; includeArchived?: boolean }): Promise<ChecklistItemRecord[]> {
    const where: string[] = [];
    const values: unknown[] = [];
    if (!options.includeArchived) where.push("archived_at IS NULL");
    if (options.status) {
      where.push("status = ?");
      values.push(options.status);
    }
    const result = await this.db
      .prepare(`SELECT * FROM checklist_items ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY due_date IS NULL, due_date ASC, sort_order ASC`)
      .bind(...values)
      .all<Row>();
    return (result.results ?? []).map(rowToChecklist);
  }

  async getChecklistItemByTemplateKey(templateCode: string, templateVersion: string, templateItemKey: string): Promise<ChecklistItemRecord | null> {
    const row = await this.db
      .prepare("SELECT * FROM checklist_items WHERE template_code = ? AND template_version = ? AND template_item_key = ? LIMIT 1")
      .bind(templateCode, templateVersion, templateItemKey)
      .first<Row>();
    return row ? rowToChecklist(row) : null;
  }

  async insertChecklistTemplateImport(record: ChecklistTemplateImportRecord): Promise<ChecklistTemplateImportRecord> {
    await this.db
      .prepare(
        `INSERT INTO checklist_template_imports (
          id, template_code, template_version, imported_at, imported_by, item_count,
          created_count, skipped_existing_count, details_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        record.id,
        record.template_code,
        record.template_version,
        record.imported_at,
        record.imported_by,
        record.item_count,
        record.created_count,
        record.skipped_existing_count,
        JSON.stringify(record.details_json)
      )
      .run();
    return record;
  }

  async listChecklistTemplateImports(): Promise<ChecklistTemplateImportRecord[]> {
    const result = await this.db.prepare("SELECT * FROM checklist_template_imports ORDER BY imported_at DESC").all<Row>();
    return (result.results ?? []).map(rowToChecklistTemplateImport);
  }

  async insertMilestone(item: MilestoneRecord): Promise<MilestoneRecord> {
    await this.db
      .prepare(
        `INSERT INTO milestones (
          id, milestone_type, title, observed_on, note, source_kind, source_ref, details_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        item.id,
        item.milestone_type,
        item.title,
        item.observed_on,
        item.note,
        item.source_kind,
        item.source_ref,
        JSON.stringify(item.details_json),
        item.created_at,
        item.updated_at
      )
      .run();
    return item;
  }

  async listMilestones(options?: { limit?: number }): Promise<MilestoneRecord[]> {
    const values: unknown[] = [];
    if (options?.limit !== undefined) values.push(options.limit);
    const result = await this.db
      .prepare(`SELECT * FROM milestones ORDER BY observed_on DESC${options?.limit !== undefined ? " LIMIT ?" : ""}`)
      .bind(...values)
      .all<Row>();
    return (result.results ?? []).map(rowToMilestone);
  }

  async listAttachmentsManifest(): Promise<Record<string, unknown>[]> {
    const result = await this.db.prepare("SELECT * FROM attachments ORDER BY created_at DESC").all<Row>();
    return result.results ?? [];
  }
}

function rowToProfile(row: Row): AppProfile {
  return {
    id: 1,
    family_label: row.family_label ?? null,
    child_name: row.child_name ?? null,
    child_birth_date: row.child_birth_date ?? null,
    due_date: row.due_date ?? null,
    timezone: row.timezone,
    locale: row.locale,
    phase: row.phase,
    read_only_title: row.read_only_title,
    machine_token: row.machine_token ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function rowToEvent(row: Row): EventRecord {
  return {
    id: row.id,
    category: row.category,
    event_type: row.event_type,
    occurred_at: row.occurred_at,
    ended_at: row.ended_at ?? null,
    local_date: row.local_date,
    amount_value: row.amount_value ?? null,
    amount_unit: row.amount_unit ?? null,
    note: row.note ?? null,
    details_json: parseJson(row.details_json),
    source: row.source,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at ?? null
  };
}

function rowToChecklist(row: Row): ChecklistItemRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    item_type: row.item_type,
    phase: row.phase,
    source_basis: row.source_basis,
    template_code: row.template_code ?? null,
    template_item_key: row.template_item_key ?? null,
    template_version: row.template_version ?? null,
    due_date: row.due_date ?? null,
    due_rule_json: parseJson(row.due_rule_json),
    details_json: parseJson(row.details_json),
    status: row.status,
    priority: row.priority,
    note: row.note ?? null,
    completed_at: row.completed_at ?? null,
    skipped_at: row.skipped_at ?? null,
    archived_at: row.archived_at ?? null,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function rowToChecklistTemplateImport(row: Row): ChecklistTemplateImportRecord {
  return {
    id: row.id,
    template_code: row.template_code,
    template_version: row.template_version,
    imported_at: row.imported_at,
    imported_by: row.imported_by,
    item_count: row.item_count,
    created_count: row.created_count,
    skipped_existing_count: row.skipped_existing_count,
    details_json: parseJson(row.details_json)
  };
}

function rowToMilestone(row: Row): MilestoneRecord {
  return {
    id: row.id,
    milestone_type: row.milestone_type,
    title: row.title,
    observed_on: row.observed_on,
    note: row.note ?? null,
    source_kind: row.source_kind,
    source_ref: row.source_ref ?? null,
    details_json: parseJson(row.details_json),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function parseJson(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
