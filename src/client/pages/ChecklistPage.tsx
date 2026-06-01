import { useCallback, useEffect, useMemo, useState } from "react";
import { api, isUnauthorized } from "../api";
import { Sheet } from "../components/Sheet";
import { languageQuery, localizedText, useI18n, type LocalizedText } from "../i18n";
import type {
  ChecklistActivation,
  ChecklistItemRecord,
  ChecklistItemType,
  ChecklistPhase,
  ChecklistSectionsPayload,
  ChecklistStatus,
  ChecklistTemplateEntry,
  Priority,
  ShowToast
} from "../types";

interface ChecklistPageProps {
  onUnauthorized: () => void;
  showToast: ShowToast;
}

type ChecklistTab = "current" | "templates" | "completed" | "reference";

const itemTypeLabels: Record<ChecklistItemType, LocalizedText> = {
  well_visit: { en: "Well-child visit", zh: "儿保随访" },
  screening: { en: "Screening", zh: "筛查" },
  vaccine: { en: "Vaccine placeholder", zh: "疫苗占位" },
  admin: { en: "Admin", zh: "事务" },
  safety: { en: "Safety", zh: "安全" },
  feeding_plan: { en: "Feeding", zh: "喂养" },
  custom: { en: "Custom", zh: "自定义" }
};

const phaseLabels: Record<ChecklistPhase, LocalizedText> = {
  prenatal: { en: "Before birth", zh: "出生前" },
  birth_hospital: { en: "Birth hospital stay", zh: "住院出生期" },
  first_week: { en: "First week", zh: "第一周" },
  first_month: { en: "First month", zh: "第一个月" },
  infant_1_3m: { en: "1-3 months", zh: "1-3 月" },
  infant_4_7m: { en: "4-7 months", zh: "4-7 月" },
  infant_8_12m: { en: "8-12 months", zh: "8-12 月" },
  toddler_12_18m: { en: "12-18 months", zh: "12-18 月" },
  toddler_18_24m: { en: "18-24 months", zh: "18-24 月" },
  toddler_24_30m: { en: "24-30 months", zh: "24-30 月" },
  toddler_3y: { en: "3 years", zh: "3 岁" },
  preschool_4_5y: { en: "4-5 years", zh: "4-5 岁" },
  early_school_6y: { en: "6-year school entry", zh: "6 岁入学" }
};

const priorityLabels: Record<Priority, LocalizedText> = {
  low: { en: "Low", zh: "低" },
  normal: { en: "Normal", zh: "普通" },
  high: { en: "High", zh: "高" }
};

const importedStatusLabels: Record<ChecklistTemplateEntry["imported_status"], LocalizedText> = {
  not_imported: { en: "Not imported", zh: "未导入" },
  partially_imported: { en: "Partially imported", zh: "部分导入" },
  imported: { en: "Imported", zh: "已导入" }
};

const activationLabels: Record<ChecklistActivation, LocalizedText> = {
  core_auto: { en: "Core", zh: "核心" },
  recommended: { en: "Recommended", zh: "推荐" },
  reference: { en: "Reference", zh: "参考" },
  manual_optional: { en: "Manual optional", zh: "手动可选" }
};

const stageStatusLabels: Record<ChecklistTemplateEntry["stage_status"], LocalizedText> = {
  current_stage: { en: "Current stage", zh: "当前阶段" },
  past_stage: { en: "Past stage", zh: "过去阶段" },
  future_stage: { en: "Future stage", zh: "未来阶段" }
};

export function ChecklistPage({ onUnauthorized, showToast }: ChecklistPageProps) {
  const { language, text: tx } = useI18n();
  const [sections, setSections] = useState<ChecklistSectionsPayload | null>(null);
  const [templates, setTemplates] = useState<ChecklistTemplateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [confirmingTemplate, setConfirmingTemplate] = useState<ChecklistTemplateEntry | null>(null);
  const [importingCode, setImportingCode] = useState<string | null>(null);
  const [importingItemKey, setImportingItemKey] = useState<string | null>(null);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<ChecklistTab>("current");
  const [selectedPhase, setSelectedPhase] = useState<ChecklistPhase>("prenatal");

  const load = useCallback(async () => {
    try {
      setError("");
      const [sectionData, templateData] = await Promise.all([
        api<ChecklistSectionsPayload>(`/api/checklists/sections?${languageQuery(language)}`),
        api<{ templates: ChecklistTemplateEntry[] }>(`/api/checklist-templates?${languageQuery(language)}`)
      ]);
      setSections(sectionData);
      setTemplates(templateData.templates);
    } catch (err) {
      if (isUnauthorized(err)) return onUnauthorized();
      setError(err instanceof Error ? err.message : tx({ en: "Failed to load", zh: "加载失败" }));
    } finally {
      setLoading(false);
    }
  }, [language, onUnauthorized, tx]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = sections?.summary;
  const importedCount = useMemo(() => templates.reduce((sum, item) => sum + item.imported_item_count, 0), [templates]);
  const birthRecommendations = useMemo(
    () => templates.filter((template) => ["aap_birth_hospital_v1", "aap_first_week_v1"].includes(template.template_code) && template.recommended_now),
    [templates]
  );
  const phaseOrder = useMemo(() => Object.keys(phaseLabels) as ChecklistPhase[], []);
  const visibleTemplates = useMemo(() => templates.filter((template) => template.phase === selectedPhase), [selectedPhase, templates]);
  const referenceTemplates = useMemo(() => templates.filter((template) => template.reference_only), [templates]);

  useEffect(() => {
    const current = templates.find((template) => template.stage_status === "current_stage" && !template.reference_only);
    if (current) setSelectedPhase(current.phase);
  }, [templates]);

  async function updateItem(item: ChecklistItemRecord, patch: Record<string, unknown>, successMessage = tx({ en: "Checklist updated", zh: "清单已更新" })) {
    try {
      await api(`/api/checklists/${item.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      await load();
      showToast(successMessage);
    } catch (err) {
      showToast(err instanceof Error ? err.message : tx({ en: "Update failed", zh: "更新失败" }));
    }
  }

  async function updateStatus(item: ChecklistItemRecord, status: ChecklistStatus) {
    await updateItem(item, status === "pending" ? { status, archived: false } : { status });
  }

  async function hideItem(item: ChecklistItemRecord) {
    await updateItem(item, { archived: true }, tx({ en: "Checklist hidden", zh: "已隐藏清单" }));
  }

  async function importTemplate(template: ChecklistTemplateEntry, confirmed = false) {
    try {
      setImportingCode(template.template_code);
      await api("/api/checklists/import-template", {
        method: "POST",
        body: JSON.stringify({ template_code: template.template_code, confirmed })
      });
      setConfirmingTemplate(null);
      await load();
      showToast(tx({ en: "Template imported", zh: "模板已导入" }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : tx({ en: "Import failed", zh: "导入失败" }));
    } finally {
      setImportingCode(null);
    }
  }

  async function importTemplateItem(template: ChecklistTemplateEntry, itemKey: string, confirmed = false) {
    const item = template.items.find((entry) => entry.key === itemKey);
    if (!item) return;
    if (item.item_type === "vaccine" && !confirmed) {
      const ok = window.confirm(
        tx({
          en: "This item only records vaccine records or schedules from a doctor/local clinic. It will not generate a full vaccine schedule or decide whether vaccination should happen.",
          zh: "该项目只用于记录接种证、医生或当地机构给出的安排；不会生成完整疫苗日程，也不会判断是否应接种。"
        })
      );
      if (!ok) return;
      confirmed = true;
    }
    try {
      const importKey = `${template.template_code}:${itemKey}`;
      setImportingItemKey(importKey);
      await api("/api/checklists/import-template", {
        method: "POST",
        body: JSON.stringify({ template_code: template.template_code, template_item_key: itemKey, confirmed })
      });
      await load();
      showToast(tx({ en: "Optional item added", zh: "已加入可选项" }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : tx({ en: "Add failed", zh: "加入失败" }));
    } finally {
      setImportingItemKey(null);
    }
  }

  function toggleTemplate(templateCode: string) {
    setExpandedTemplates((current) => {
      const next = new Set(current);
      if (next.has(templateCode)) next.delete(templateCode);
      else next.add(templateCode);
      return next;
    });
  }

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");
    const formData = new FormData(event.currentTarget);
    try {
      await api("/api/checklists", {
        method: "POST",
        body: JSON.stringify({
          title: text(formData, "title"),
          description: text(formData, "description") || null,
          item_type: text(formData, "item_type") || "custom",
          phase: text(formData, "phase") || "prenatal",
          source_basis: "custom",
          priority: text(formData, "priority") || "normal",
          due_date: text(formData, "due_date") || null,
          note: text(formData, "note") || null
        })
      });
      setCreating(false);
      await load();
      showToast(tx({ en: "Checklist added", zh: "已新增清单" }));
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : tx({ en: "Create failed", zh: "新增失败" }));
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{tx({ en: "Stage tasks and family prep", zh: "阶段任务与家庭准备" })}</p>
          <h1>{tx({ en: "Checklist", zh: "清单" })}</h1>
        </div>
        <button className="primary" type="button" onClick={() => setCreating(true)}>
          {tx({ en: "Add", zh: "新增" })}
        </button>
      </header>

      {loading ? <div className="loading">{tx({ en: "Loading checklist...", zh: "正在加载清单..." })}</div> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {!loading && !error && sections ? (
        <>
          <section className="summary-grid checklist-overview" aria-label={tx({ en: "Checklist overview", zh: "清单概览" })}>
            <article>
              <span>{tx({ en: "Current", zh: "当前" })}</span>
              <strong>{summary?.current_count ?? 0}</strong>
              <small>{tx({ en: "Pending", zh: "待处理" })}</small>
            </article>
            <article>
              <span>{tx({ en: "Upcoming", zh: "即将" })}</span>
              <strong>{summary?.upcoming_count ?? 0}</strong>
              <small>{tx({ en: "With dates", zh: "有日期" })}</small>
            </article>
            <article>
              <span>{tx({ en: "Done", zh: "已完成" })}</span>
              <strong>{summary?.completed_count ?? 0}</strong>
              <small>{tx({ en: "Kept as records", zh: "保留记录" })}</small>
            </article>
            <article>
              <span>{tx({ en: "Reference", zh: "参考" })}</span>
              <strong>{summary?.reference_count ?? 0}</strong>
              <small>{tx({ en: "Current stage", zh: "当前阶段" })}</small>
            </article>
            <article>
              <span>{tx({ en: "Template items", zh: "模板条目" })}</span>
              <strong>{importedCount}</strong>
              <small>{tx({ en: "Imported", zh: "已导入" })}</small>
            </article>
          </section>

          <section className="panel sticky-tabs">
            <div className="segmented">
              {([
                ["current", tx({ en: "Current tasks", zh: "当前任务" })],
                ["templates", tx({ en: "Template library", zh: "模板库" })],
                ["completed", tx({ en: "Completed", zh: "已完成" })],
                ["reference", tx({ en: "Reference", zh: "参考" })]
              ] as Array<[ChecklistTab, string]>).map(([tab, label]) => (
                <button key={tab} className={activeTab === tab ? "active" : ""} type="button" onClick={() => setActiveTab(tab)}>
                  {label}
                </button>
              ))}
            </div>
          </section>

          {activeTab === "current" && birthRecommendations.length ? (
            <section className="panel">
              <div className="section-head">
                <h2>{tx({ en: "Birth-hospital suggestions", zh: "出生住院建议" })}</h2>
                <span>{birthRecommendations.length}</span>
              </div>
              <div className="simple-list">
                {birthRecommendations.map((template) => (
                  <article key={`birth-recommend-${template.template_code}`}>
                    <div className="item-main">
                      <strong>{tx({ en: "Suggested import: {title}", zh: "建议导入：{title}" }, { title: template.title })}</strong>
                      <p>
                        {tx(phaseLabels[template.phase])} · {tx(importedStatusLabels[template.imported_status])} ·{" "}
                        {tx({ en: "{count} imported", zh: "已导入 {count} 项" }, { count: template.imported_item_count })}
                      </p>
                    </div>
                    <div className="row-actions">
                      <button className="primary small" type="button" disabled={importingCode === template.template_code} onClick={() => void importTemplate(template)}>
                        {template.imported_item_count ? tx({ en: "Check import again", zh: "再次导入检查" }) : tx({ en: "Import", zh: "导入" })}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <p className="notice">
                {tx({
                  en: "This only suggests stage checklists that can be imported. It will not auto-import anything or generate vaccine schedules.",
                  zh: "这里只提示可导入的阶段清单，不会自动导入，也不会生成疫苗日程。"
                })}
              </p>
            </section>
          ) : null}

          {activeTab === "current" ? (
            <>
              <ChecklistSection title={tx({ en: "Current tasks", zh: "当前任务" })} items={sections.current} onStatus={updateStatus} onHide={hideItem} />
              <ChecklistSection title={tx({ en: "Upcoming tasks", zh: "即将任务" })} items={sections.upcoming} onStatus={updateStatus} onHide={hideItem} />
            </>
          ) : null}

          {activeTab === "completed" ? (
            <>
              <ChecklistSection title={tx({ en: "Completed", zh: "已完成" })} items={sections.completed} onStatus={updateStatus} onHide={hideItem} />
              <ChecklistSection title={tx({ en: "Skipped / hidden", zh: "已跳过 / 已隐藏" })} items={sections.skipped_hidden} onStatus={updateStatus} onHide={hideItem} />
            </>
          ) : null}

          {activeTab === "reference" ? (
            <>
              <ChecklistSection title={tx({ en: "Stage reference", zh: "阶段参考" })} items={sections.reference} onStatus={updateStatus} onHide={hideItem} readOnly />
              {referenceTemplates.length ? (
                <section className="panel">
                  <div className="section-head">
                    <h2>{tx({ en: "Template reference", zh: "模板参考" })}</h2>
                    <span>{referenceTemplates.length}</span>
                  </div>
                  <div className="simple-list template-list">
                    {referenceTemplates.map((template) => (
                      <TemplateCard
                        key={template.template_code}
                        template={template}
                        expanded={expandedTemplates.has(template.template_code)}
                        importingCode={importingCode}
                        importingItemKey={importingItemKey}
                        onToggle={() => toggleTemplate(template.template_code)}
                        onImportTemplate={importTemplate}
                        onConfirmTemplate={setConfirmingTemplate}
                        onImportItem={importTemplateItem}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}

          {activeTab === "templates" ? (
          <section className="panel">
            <div className="section-head">
              <h2>{tx({ en: "Template library", zh: "模板库" })}</h2>
              <span>{visibleTemplates.length}</span>
            </div>
            <div className="chip-row phase-chips">
              {phaseOrder.map((phase) => (
                <button key={phase} className={selectedPhase === phase ? "chip active" : "chip"} type="button" onClick={() => setSelectedPhase(phase)}>
                  {tx(phaseLabels[phase])}
                </button>
              ))}
            </div>
            <div className="simple-list template-list">
              {visibleTemplates.map((template) => (
                <TemplateCard
                  key={template.template_code}
                  template={template}
                  expanded={expandedTemplates.has(template.template_code)}
                  importingCode={importingCode}
                  importingItemKey={importingItemKey}
                  onToggle={() => toggleTemplate(template.template_code)}
                  onImportTemplate={importTemplate}
                  onConfirmTemplate={setConfirmingTemplate}
                  onImportItem={importTemplateItem}
                />
              ))}
            </div>
          </section>
          ) : null}
        </>
      ) : null}

      {creating ? (
        <Sheet title={tx({ en: "Add custom checklist item", zh: "新增自定义清单" })} onClose={() => setCreating(false)}>
          <form className="stack" onSubmit={submitCreate}>
            <label>
              {tx({ en: "Title", zh: "标题" })}
              <input name="title" required />
            </label>
            <label>
              {tx({ en: "Description", zh: "描述" })}
              <textarea name="description" />
            </label>
            <div className="form-grid">
              <label>
                {tx({ en: "Type", zh: "类型" })}
                <select name="item_type" defaultValue="custom">
                  {Object.entries(itemTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {tx(label)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {tx({ en: "Stage", zh: "阶段" })}
                <select name="phase" defaultValue="prenatal">
                  {Object.entries(phaseLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {tx(label)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label>
                {tx({ en: "Priority", zh: "优先级" })}
                <select name="priority" defaultValue="normal">
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {tx(label)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {tx({ en: "Date", zh: "日期" })}
                <input name="due_date" type="date" />
              </label>
            </div>
            <label>
              {tx({ en: "Note", zh: "备注" })}
              <textarea name="note" />
            </label>
            {createError ? <p className="error-text">{createError}</p> : null}
            <div className="sheet-actions">
              <button className="ghost" type="button" onClick={() => setCreating(false)}>
                {tx({ en: "Cancel", zh: "取消" })}
              </button>
              <button className="primary" type="submit">
                {tx({ en: "Save", zh: "保存" })}
              </button>
            </div>
          </form>
        </Sheet>
      ) : null}

      {confirmingTemplate ? (
        <Sheet title={tx({ en: "Confirm vaccine placeholder import", zh: "确认导入疫苗占位模板" })} onClose={() => setConfirmingTemplate(null)}>
          <div className="stack">
            <p className="notice">
              {tx({
                en: "This template only saves vaccine records, doctor/local-clinic schedules, and follow-up custom notes. It will not generate a complete vaccine schedule or decide whether vaccination should happen.",
                zh: "该模板只用于保存接种本、医生或当地机构给出的安排，以及后续自定义记录；不会生成完整疫苗日程，也不会判断是否应接种。"
              })}
            </p>
            <div>
              <strong>{confirmingTemplate.title}</strong>
              <p className="muted">{confirmingTemplate.description}</p>
            </div>
            <div className="sheet-actions">
              <button className="ghost" type="button" onClick={() => setConfirmingTemplate(null)}>
                {tx({ en: "Cancel", zh: "取消" })}
              </button>
              <button
                className="primary"
                type="button"
                disabled={importingCode === confirmingTemplate.template_code}
                onClick={() => void importTemplate(confirmingTemplate, true)}
              >
                {tx({ en: "Confirm import", zh: "确认导入" })}
              </button>
            </div>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}

function TemplateCard({
  template,
  expanded,
  importingCode,
  importingItemKey,
  onToggle,
  onImportTemplate,
  onConfirmTemplate,
  onImportItem
}: {
  template: ChecklistTemplateEntry;
  expanded: boolean;
  importingCode: string | null;
  importingItemKey: string | null;
  onToggle: () => void;
  onImportTemplate: (template: ChecklistTemplateEntry) => Promise<void>;
  onConfirmTemplate: (template: ChecklistTemplateEntry) => void;
  onImportItem: (template: ChecklistTemplateEntry, itemKey: string) => Promise<void>;
}) {
  const { text: tx } = useI18n();
  return (
    <article>
      <div className="item-main">
        <strong>{template.title}</strong>
        <p>
          {tx(phaseLabels[template.phase])} · {tx({ en: "{count} items", zh: "{count} 项" }, { count: template.item_count })} ·{" "}
          {tx({ en: "{count} imported", zh: "已导入 {count} 项" }, { count: template.imported_item_count })}
        </p>
        {template.description ? <p>{template.description}</p> : null}
        <div className="tag-row">
          <span>{template.reference_only ? tx({ en: "Reference rule", zh: "参考规则" }) : tx(stageStatusLabels[template.stage_status])}</span>
          <span>{tx(importedStatusLabels[template.imported_status])}</span>
          {Array.from(new Set(template.items.map((item) => item.activation)))
            .slice(0, 4)
            .map((activation) => (
              <span key={activation}>{tx(activationLabels[activation])}</span>
            ))}
          {template.items.slice(0, 3).map((item) => (
            <span key={item.key}>{tx(itemTypeLabels[item.item_type])}</span>
          ))}
        </div>
        <TemplateItems template={template} expanded={expanded} importingItemKey={importingItemKey} onToggle={onToggle} onImportItem={onImportItem} />
      </div>
      <div className="row-actions">
        {template.reference_only ? (
          <span className="muted">{tx({ en: "Reference only", zh: "仅参考" })}</span>
        ) : (
          <button
            className={template.requires_confirmation ? "secondary small" : "primary small"}
            type="button"
            disabled={importingCode === template.template_code}
            onClick={() => (template.requires_confirmation ? onConfirmTemplate(template) : void onImportTemplate(template))}
          >
            {template.imported_item_count
              ? tx({ en: "Check import again", zh: "再次导入检查" })
              : template.requires_confirmation
                ? tx({ en: "Confirm import", zh: "确认导入" })
                : tx({ en: "Import", zh: "导入" })}
          </button>
        )}
      </div>
    </article>
  );
}

function TemplateItems({
  template,
  expanded,
  importingItemKey,
  onToggle,
  onImportItem
}: {
  template: ChecklistTemplateEntry;
  expanded: boolean;
  importingItemKey: string | null;
  onToggle: () => void;
  onImportItem: (template: ChecklistTemplateEntry, itemKey: string) => Promise<void>;
}) {
  const { text: tx } = useI18n();
  const visibleItems = expanded ? template.items : template.items.slice(0, 4);
  return (
    <div className="template-items">
      {visibleItems.map((item) => (
        <div className="template-item-row" key={item.key}>
          <div>
            <strong>{item.title}</strong>
            <p>
              {tx(activationLabels[item.activation])} · {tx(itemTypeLabels[item.item_type])} · {dueRuleLabel(item.due_rule_json)}
            </p>
          </div>
          {item.activation === "manual_optional" && !template.reference_only ? (
            <button
              className="secondary small"
              type="button"
              disabled={importingItemKey === `${template.template_code}:${item.key}`}
              onClick={() => void onImportItem(template, item.key)}
            >
              {tx({ en: "Add manually", zh: "手动加入" })}
            </button>
          ) : null}
        </div>
      ))}
      {template.items.length > 4 ? (
        <button className="ghost small template-toggle" type="button" onClick={onToggle}>
          {expanded ? tx({ en: "Collapse", zh: "收起" }) : tx({ en: "Show all {count} items", zh: "展开全部 {count} 项" }, { count: template.items.length })}
        </button>
      ) : null}
    </div>
  );
}

interface ChecklistSectionProps {
  title: string;
  items: ChecklistItemRecord[];
  onStatus: (item: ChecklistItemRecord, status: ChecklistStatus) => Promise<void>;
  onHide: (item: ChecklistItemRecord) => Promise<void>;
  readOnly?: boolean;
}

function ChecklistSection({ title, items, onStatus, onHide, readOnly = false }: ChecklistSectionProps) {
  const { text: tx } = useI18n();
  return (
    <section className="panel">
      <div className="section-head">
        <h2>{title}</h2>
        <span>{items.length}</span>
      </div>
      {items.length ? (
        <div className="simple-list">
          {items.map((item) => (
            <article key={item.id}>
              <div className="item-main">
                <strong>{item.title}</strong>
                {item.description ? <p>{item.description}</p> : null}
                <p>
                  {tx(itemTypeLabels[item.item_type])} · {tx(phaseLabels[item.phase])} · {tx({ en: "Priority {priority}", zh: "优先级 {priority}" }, { priority: tx(priorityLabels[item.priority]) })}
                  {checklistActivation(item) ? ` · ${tx(activationLabels[checklistActivation(item)!])}` : ""}
                  {item.due_date ? ` · ${item.due_date}` : ""}
                </p>
                {item.note ? <p>{tx({ en: "Note: {note}", zh: "备注：{note}" }, { note: item.note })}</p> : null}
              </div>
              {!readOnly ? (
                <div className="row-actions">
                  <button className="primary small" type="button" onClick={() => void onStatus(item, "done")}>
                    {tx({ en: "Done", zh: "完成" })}
                  </button>
                  <details className="action-menu">
                    <summary>{tx({ en: "More", zh: "更多" })}</summary>
                    <button className="ghost small" type="button" onClick={() => void onStatus(item, "skipped")}>
                      {tx({ en: "Skip", zh: "跳过" })}
                    </button>
                    <button className="ghost small" type="button" onClick={() => void onStatus(item, "pending")}>
                      {tx({ en: "Mark pending", zh: "标为待办" })}
                    </button>
                    {!item.archived_at ? (
                      <button className="ghost small" type="button" onClick={() => void onHide(item)}>
                        {tx({ en: "Hide", zh: "隐藏" })}
                      </button>
                    ) : null}
                  </details>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="empty">{tx({ en: "None.", zh: "暂无。" })}</p>
      )}
    </section>
  );
}

function checklistActivation(item: ChecklistItemRecord): ChecklistActivation | null {
  const activation = item.details_json?.activation;
  return typeof activation === "string" && activation in activationLabels ? (activation as ChecklistActivation) : null;
}

function dueRuleLabel(rule: Record<string, unknown> | undefined): string {
  if (!rule) return localizedText({ en: "No fixed date", zh: "无固定日期" });
  if (typeof rule.trigger === "string") {
    return (
      {
        before_birth: localizedText({ en: "Before birth", zh: "出生前" }),
        birth_to_discharge: localizedText({ en: "Birth to discharge", zh: "出生至出院" }),
        discharge_day: localizedText({ en: "Discharge day", zh: "出院当天" }),
        all: localizedText({ en: "Cross-stage reference", zh: "跨阶段参考" })
      }[rule.trigger] ?? localizedText({ en: "By trigger", zh: "按触发条件" })
    );
  }
  if (typeof rule.age_anchor === "string") return ageAnchorLabel(rule.age_anchor);
  if (rule.age_window && typeof rule.age_window === "object") return ageWindowLabel(rule.age_window as Record<string, unknown>);
  return localizedText({ en: "By stage", zh: "按阶段" });
}

function ageAnchorLabel(anchor: string): string {
  return (
    {
      birth_day: localizedText({ en: "Birth day", zh: "出生当天" }),
      "3_5_day": localizedText({ en: "3-5 days after birth", zh: "出生 3-5 天" }),
      "1_month": localizedText({ en: "1 month", zh: "1 月龄" }),
      "2_month": localizedText({ en: "2 months", zh: "2 月龄" }),
      "4_month": localizedText({ en: "4 months", zh: "4 月龄" }),
      "6_month": localizedText({ en: "6 months", zh: "6 月龄" }),
      "9_month": localizedText({ en: "9 months", zh: "9 月龄" }),
      "12_month": localizedText({ en: "12 months", zh: "12 月龄" }),
      "15_month": localizedText({ en: "15 months", zh: "15 月龄" }),
      "18_month": localizedText({ en: "18 months", zh: "18 月龄" }),
      "24_month": localizedText({ en: "24 months", zh: "24 月龄" }),
      "30_month": localizedText({ en: "30 months", zh: "30 月龄" }),
      "3_year": localizedText({ en: "3 years", zh: "3 岁" }),
      "4_year": localizedText({ en: "4 years", zh: "4 岁" }),
      "5_year": localizedText({ en: "5 years", zh: "5 岁" }),
      "6_year": localizedText({ en: "6 years", zh: "6 岁" })
    }[anchor] ?? localizedText({ en: "By age", zh: "按年龄" })
  );
}

function ageWindowLabel(window: Record<string, unknown>): string {
  if (typeof window.start_days === "number" && typeof window.end_days === "number") {
    return localizedText({ en: "{start}-{end} days after birth", zh: "出生 {start}-{end} 天" }, { start: window.start_days, end: window.end_days });
  }
  if (typeof window.start_months === "number" && typeof window.end_months === "number") {
    return localizedText({ en: "{start}-{end} months", zh: "{start}-{end} 月龄" }, { start: window.start_months, end: window.end_months });
  }
  if (typeof window.start_years === "number" && typeof window.end_years === "number") {
    return localizedText({ en: "{start}-{end} years", zh: "{start}-{end} 岁" }, { start: window.start_years, end: window.end_years });
  }
  return localizedText({ en: "Age window", zh: "年龄窗口" });
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}
