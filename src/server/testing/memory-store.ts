import type {
  AppProfile,
  ChecklistItemRecord,
  ChecklistStatus,
  ChecklistTemplateImportRecord,
  EventRecord,
  MilestoneRecord,
  Store
} from "../types";

const now = "2026-04-24T00:00:00.000Z";

export function createMemoryStore(options?: { profile?: Partial<AppProfile> }): Store {
  let profile: AppProfile = {
    id: 1,
    family_label: null,
    child_name: null,
    child_birth_date: null,
    due_date: null,
    timezone: "Asia/Shanghai",
    locale: "zh-CN",
    phase: "pregnancy_prebirth",
    read_only_title: "Baby Status",
    machine_token: null,
    created_at: now,
    updated_at: now,
    ...options?.profile
  };
  const meta = new Map<string, string>([["schema_version", "1"]]);
  const events: EventRecord[] = [];
  const checklistItems: ChecklistItemRecord[] = [];
  const checklistTemplateImports: ChecklistTemplateImportRecord[] = [];
  const milestones: MilestoneRecord[] = [];

  return {
    async getProfile() {
      return { ...profile };
    },
    async updateProfile(patch, nowIso) {
      profile = { ...profile, ...patch, id: 1, updated_at: nowIso };
      return { ...profile };
    },
    async getMeta(key) {
      return meta.get(key) ?? null;
    },
    async setMeta(key, value) {
      meta.set(key, value);
    },
    async insertEvent(event) {
      events.push(cloneEvent(event));
      return cloneEvent(event);
    },
    async updateEvent(id, patch, nowIso) {
      const index = events.findIndex((event) => event.id === id);
      if (index === -1) return null;
      events[index] = { ...events[index], ...patch, updated_at: nowIso };
      return cloneEvent(events[index]);
    },
    async getEvent(id) {
      const event = events.find((item) => item.id === id);
      return event ? cloneEvent(event) : null;
    },
    async getEventRangeMeta() {
      const activeEvents = events.filter((event) => !event.deleted_at);
      if (!activeEvents.length) {
        return {
          first_event_at: null,
          latest_event_at: null,
          event_count: 0,
          available_from_local_date: null,
          available_to_local_date: null
        };
      }
      const byOccurred = activeEvents.slice().sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
      const byLocalDate = activeEvents.slice().sort((a, b) => a.local_date.localeCompare(b.local_date));
      return {
        first_event_at: byOccurred[0].occurred_at,
        latest_event_at: byOccurred.at(-1)?.occurred_at ?? null,
        event_count: activeEvents.length,
        available_from_local_date: byLocalDate[0].local_date,
        available_to_local_date: byLocalDate.at(-1)?.local_date ?? null
      };
    },
    async listEvents(options) {
      const cutoff = options.days
        ? Date.now() - options.days * 24 * 60 * 60 * 1000
        : Number.NEGATIVE_INFINITY;
      const since = options.since ? new Date(options.since).getTime() : Number.NEGATIVE_INFINITY;
      const until = options.until ? new Date(options.until).getTime() : Number.POSITIVE_INFINITY;
      return events
        .filter((event) => options.includeDeleted || !event.deleted_at)
        .filter((event) => !options.event_type || event.event_type === options.event_type)
        .filter((event) => {
          const occurred = new Date(event.occurred_at).getTime();
          return occurred >= cutoff && occurred >= since && occurred <= until;
        })
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
        .slice(0, options.limit ?? events.length)
        .map(cloneEvent);
    },
    async listEventsInUtcRange(startUtc, endUtcExclusive, options = {}) {
      const start = new Date(startUtc).getTime();
      const end = new Date(endUtcExclusive).getTime();
      return events
        .filter((event) => options.includeDeleted || !event.deleted_at)
        .filter((event) => !options.event_type || event.event_type === options.event_type)
        .filter((event) => {
          const occurred = new Date(event.occurred_at).getTime();
          return occurred >= start && occurred < end;
        })
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
        .slice(0, options.limit ?? events.length)
        .map(cloneEvent);
    },
    async listEventsByLocalDate(localDate) {
      return events
        .filter((event) => !event.deleted_at && event.local_date === localDate)
        .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
        .map(cloneEvent);
    },
    async listOpenEventsByType(eventType) {
      return events
        .filter((event) => !event.deleted_at && event.event_type === eventType && !event.ended_at)
        .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
        .map(cloneEvent);
    },
    async listOpenSleepSessions() {
      return events
        .filter((event) => !event.deleted_at && event.event_type === "sleep_session" && !event.ended_at)
        .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
        .map(cloneEvent);
    },
    async listSleepEventsOverlappingRange(startUtc, endUtc, openEndedAt) {
      const start = new Date(startUtc).getTime();
      const end = new Date(endUtc).getTime();
      return events
        .filter((event) => !event.deleted_at && event.event_type === "sleep_session")
        .filter((event) => {
          const eventStart = new Date(event.occurred_at).getTime();
          const eventEnd = new Date(event.ended_at ?? openEndedAt).getTime();
          return eventStart < end && eventEnd > start;
        })
        .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
        .map(cloneEvent);
    },
    async insertChecklistItem(item) {
      const existing = checklistItems.find((existingItem) => existingItem.id === item.id);
      if (existing) return cloneChecklist(existing);
      checklistItems.push(cloneChecklist(item));
      return cloneChecklist(item);
    },
    async updateChecklistItem(id, patch, nowIso) {
      const index = checklistItems.findIndex((item) => item.id === id);
      if (index === -1) return null;
      checklistItems[index] = { ...checklistItems[index], ...patch, updated_at: nowIso };
      return cloneChecklist(checklistItems[index]);
    },
    async listChecklistItems(options: { status?: ChecklistStatus; includeArchived?: boolean }) {
      return checklistItems
        .filter((item) => options.includeArchived || !item.archived_at)
        .filter((item) => !options.status || item.status === options.status)
        .sort((a, b) => {
          const due = (a.due_date ?? "9999-99-99").localeCompare(b.due_date ?? "9999-99-99");
          return due || a.sort_order - b.sort_order;
        })
        .map(cloneChecklist);
    },
    async getChecklistItemByTemplateKey(templateCode, templateVersion, templateItemKey) {
      const item = checklistItems.find(
        (existing) => existing.template_code === templateCode && existing.template_version === templateVersion && existing.template_item_key === templateItemKey
      );
      return item ? cloneChecklist(item) : null;
    },
    async insertChecklistTemplateImport(record) {
      checklistTemplateImports.push(cloneChecklistTemplateImport(record));
      return cloneChecklistTemplateImport(record);
    },
    async listChecklistTemplateImports() {
      return checklistTemplateImports
        .sort((a, b) => b.imported_at.localeCompare(a.imported_at))
        .map(cloneChecklistTemplateImport);
    },
    async insertMilestone(item) {
      milestones.push(cloneMilestone(item));
      return cloneMilestone(item);
    },
    async listMilestones(options) {
      return milestones
        .sort((a, b) => b.observed_on.localeCompare(a.observed_on))
        .slice(0, options?.limit ?? milestones.length)
        .map(cloneMilestone);
    },
    async listAttachmentsManifest() {
      return [];
    }
  };
}

function cloneEvent(event: EventRecord): EventRecord {
  return { ...event, details_json: { ...event.details_json } };
}

function cloneChecklist(item: ChecklistItemRecord): ChecklistItemRecord {
  return { ...item, due_rule_json: { ...item.due_rule_json }, details_json: { ...item.details_json } };
}

function cloneChecklistTemplateImport(record: ChecklistTemplateImportRecord): ChecklistTemplateImportRecord {
  return { ...record, details_json: { ...record.details_json } };
}

function cloneMilestone(item: MilestoneRecord): MilestoneRecord {
  return { ...item, details_json: { ...item.details_json } };
}
