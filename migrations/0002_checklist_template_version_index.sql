CREATE INDEX IF NOT EXISTS idx_checklist_items_template_version_key
  ON checklist_items(template_code, template_version, template_item_key);
