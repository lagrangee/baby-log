-- Cloudflare D1 / SQLite
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  family_label TEXT,
  child_name TEXT,
  child_birth_date TEXT,
  due_date TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  locale TEXT NOT NULL DEFAULT 'zh-CN',
  phase TEXT NOT NULL DEFAULT 'pregnancy_prebirth',
  read_only_title TEXT NOT NULL DEFAULT 'Baby Status',
  machine_token TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  ended_at TEXT,
  local_date TEXT NOT NULL,
  amount_value REAL,
  amount_unit TEXT,
  note TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'manual',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_local_date
  ON events(local_date, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_type_date
  ON events(event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_category_date
  ON events(category, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_open_sessions
  ON events(event_type, ended_at, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_active_timeline
  ON events(deleted_at, occurred_at DESC);

CREATE TABLE IF NOT EXISTS checklist_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  item_type TEXT NOT NULL,
  phase TEXT NOT NULL,
  source_basis TEXT NOT NULL,
  template_code TEXT,
  template_item_key TEXT,
  template_version TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'normal',
  due_date TEXT,
  due_rule_json TEXT NOT NULL DEFAULT '{}',
  details_json TEXT NOT NULL DEFAULT '{}',
  note TEXT,
  completed_at TEXT,
  skipped_at TEXT,
  archived_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_checklist_items_status_phase_due
  ON checklist_items(status, phase, due_date, sort_order);

CREATE INDEX IF NOT EXISTS idx_checklist_items_template_key
  ON checklist_items(template_code, template_item_key);
CREATE INDEX IF NOT EXISTS idx_checklist_items_template_version_key
  ON checklist_items(template_code, template_version, template_item_key);

CREATE INDEX IF NOT EXISTS idx_checklist_items_archived
  ON checklist_items(archived_at, status, due_date);

CREATE TABLE IF NOT EXISTS checklist_template_imports (
  id TEXT PRIMARY KEY,
  template_code TEXT NOT NULL,
  template_version TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  imported_by TEXT NOT NULL DEFAULT 'system',
  item_count INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  skipped_existing_count INTEGER NOT NULL DEFAULT 0,
  details_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_checklist_template_imports_code
  ON checklist_template_imports(template_code, template_version, imported_at);

CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  milestone_type TEXT NOT NULL,
  title TEXT NOT NULL,
  observed_on TEXT NOT NULL,
  note TEXT,
  source_kind TEXT NOT NULL DEFAULT 'seed',
  source_ref TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_milestones_observed
  ON milestones(observed_on DESC);

CREATE INDEX IF NOT EXISTS idx_milestones_type_observed
  ON milestones(milestone_type, observed_on DESC);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  linked_table TEXT NOT NULL,
  linked_id TEXT NOT NULL,
  storage_kind TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT,
  external_url TEXT,
  external_ref TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attachments_link
  ON attachments(linked_table, linked_id);

INSERT OR IGNORE INTO app_profile (
  id, family_label, child_name, child_birth_date, due_date, timezone, locale, phase, read_only_title, machine_token, created_at, updated_at
) VALUES (
  1, NULL, NULL, NULL, NULL, 'Asia/Shanghai', 'zh-CN', 'pregnancy_prebirth', 'Baby Status', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO app_meta (key, value, updated_at)
VALUES ('schema_version', '1', CURRENT_TIMESTAMP);
