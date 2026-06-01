-- Manual maintenance script for pre-use D1 databases only.
-- This resets Checklist 2.0 tables and leaves profile, auth/meta, events, and milestones untouched.
-- Do not run from production deploy, migrations, or application startup.

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS checklist_template_imports;
DROP TABLE IF EXISTS checklist_items;

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
