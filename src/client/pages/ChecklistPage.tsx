import { useCallback, useEffect, useMemo, useState } from "react";
import { api, isUnauthorized } from "../api";
import { Sheet } from "../components/Sheet";
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

const itemTypeLabels: Record<ChecklistItemType, string> = {
  well_visit: "儿保随访",
  screening: "筛查",
  vaccine: "疫苗占位",
  admin: "事务",
  safety: "安全",
  feeding_plan: "喂养",
  custom: "自定义"
};

const phaseLabels: Record<ChecklistPhase, string> = {
  prenatal: "出生前",
  birth_hospital: "住院出生期",
  first_week: "第一周",
  first_month: "第一个月",
  infant_1_3m: "1-3 月",
  infant_4_7m: "4-7 月",
  infant_8_12m: "8-12 月",
  toddler_12_18m: "12-18 月",
  toddler_18_24m: "18-24 月",
  toddler_24_30m: "24-30 月",
  toddler_3y: "3 岁",
  preschool_4_5y: "4-5 岁",
  early_school_6y: "6 岁入学"
};

const priorityLabels: Record<Priority, string> = {
  low: "低",
  normal: "普通",
  high: "高"
};

const importedStatusLabels: Record<ChecklistTemplateEntry["imported_status"], string> = {
  not_imported: "未导入",
  partially_imported: "部分导入",
  imported: "已导入"
};

const activationLabels: Record<ChecklistActivation, string> = {
  core_auto: "核心",
  recommended: "推荐",
  reference: "参考",
  manual_optional: "手动可选"
};

const stageStatusLabels: Record<ChecklistTemplateEntry["stage_status"], string> = {
  current_stage: "当前阶段",
  past_stage: "过去阶段",
  future_stage: "未来阶段"
};

export function ChecklistPage({ onUnauthorized, showToast }: ChecklistPageProps) {
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
        api<ChecklistSectionsPayload>("/api/checklists/sections"),
        api<{ templates: ChecklistTemplateEntry[] }>("/api/checklist-templates")
      ]);
      setSections(sectionData);
      setTemplates(templateData.templates);
    } catch (err) {
      if (isUnauthorized(err)) return onUnauthorized();
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

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

  async function updateItem(item: ChecklistItemRecord, patch: Record<string, unknown>, successMessage = "清单已更新") {
    try {
      await api(`/api/checklists/${item.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      await load();
      showToast(successMessage);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "更新失败");
    }
  }

  async function updateStatus(item: ChecklistItemRecord, status: ChecklistStatus) {
    await updateItem(item, status === "pending" ? { status, archived: false } : { status });
  }

  async function hideItem(item: ChecklistItemRecord) {
    await updateItem(item, { archived: true }, "已隐藏清单");
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
      showToast("模板已导入");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "导入失败");
    } finally {
      setImportingCode(null);
    }
  }

  async function importTemplateItem(template: ChecklistTemplateEntry, itemKey: string, confirmed = false) {
    const item = template.items.find((entry) => entry.key === itemKey);
    if (!item) return;
    if (item.item_type === "vaccine" && !confirmed) {
      const ok = window.confirm("该项目只用于记录接种证、医生或当地机构给出的安排；不会生成完整疫苗日程，也不会判断是否应接种。");
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
      showToast("已加入可选项");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "加入失败");
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
      showToast("已新增清单");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "新增失败");
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">阶段任务与家庭准备</p>
          <h1>清单</h1>
        </div>
        <button className="primary" type="button" onClick={() => setCreating(true)}>
          新增
        </button>
      </header>

      {loading ? <div className="loading">正在加载清单...</div> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {!loading && !error && sections ? (
        <>
          <section className="summary-grid checklist-overview" aria-label="清单概览">
            <article>
              <span>当前</span>
              <strong>{summary?.current_count ?? 0}</strong>
              <small>待处理</small>
            </article>
            <article>
              <span>即将</span>
              <strong>{summary?.upcoming_count ?? 0}</strong>
              <small>有日期</small>
            </article>
            <article>
              <span>已完成</span>
              <strong>{summary?.completed_count ?? 0}</strong>
              <small>保留记录</small>
            </article>
            <article>
              <span>参考</span>
              <strong>{summary?.reference_count ?? 0}</strong>
              <small>当前阶段</small>
            </article>
            <article>
              <span>模板条目</span>
              <strong>{importedCount}</strong>
              <small>已导入</small>
            </article>
          </section>

          <section className="panel sticky-tabs">
            <div className="segmented">
              {([
                ["current", "当前任务"],
                ["templates", "模板库"],
                ["completed", "已完成"],
                ["reference", "参考"]
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
                <h2>出生住院建议</h2>
                <span>{birthRecommendations.length}</span>
              </div>
              <div className="simple-list">
                {birthRecommendations.map((template) => (
                  <article key={`birth-recommend-${template.template_code}`}>
                    <div className="item-main">
                      <strong>建议导入：{template.title}</strong>
                      <p>
                        {phaseLabels[template.phase]} · {importedStatusLabels[template.imported_status]} · 已导入 {template.imported_item_count} 项
                      </p>
                    </div>
                    <div className="row-actions">
                      <button className="primary small" type="button" disabled={importingCode === template.template_code} onClick={() => void importTemplate(template)}>
                        {template.imported_item_count ? "再次导入检查" : "导入"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <p className="notice">这里只提示可导入的阶段清单，不会自动导入，也不会生成疫苗日程。</p>
            </section>
          ) : null}

          {activeTab === "current" ? (
            <>
              <ChecklistSection title="当前任务" items={sections.current} onStatus={updateStatus} onHide={hideItem} />
              <ChecklistSection title="即将任务" items={sections.upcoming} onStatus={updateStatus} onHide={hideItem} />
            </>
          ) : null}

          {activeTab === "completed" ? (
            <>
              <ChecklistSection title="已完成" items={sections.completed} onStatus={updateStatus} onHide={hideItem} />
              <ChecklistSection title="已跳过 / 已隐藏" items={sections.skipped_hidden} onStatus={updateStatus} onHide={hideItem} />
            </>
          ) : null}

          {activeTab === "reference" ? (
            <>
              <ChecklistSection title="阶段参考" items={sections.reference} onStatus={updateStatus} onHide={hideItem} readOnly />
              {referenceTemplates.length ? (
                <section className="panel">
                  <div className="section-head">
                    <h2>模板参考</h2>
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
              <h2>模板库</h2>
              <span>{visibleTemplates.length}</span>
            </div>
            <div className="chip-row phase-chips">
              {phaseOrder.map((phase) => (
                <button key={phase} className={selectedPhase === phase ? "chip active" : "chip"} type="button" onClick={() => setSelectedPhase(phase)}>
                  {phaseLabels[phase]}
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
        <Sheet title="新增自定义清单" onClose={() => setCreating(false)}>
          <form className="stack" onSubmit={submitCreate}>
            <label>
              标题
              <input name="title" required />
            </label>
            <label>
              描述
              <textarea name="description" />
            </label>
            <div className="form-grid">
              <label>
                类型
                <select name="item_type" defaultValue="custom">
                  {Object.entries(itemTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                阶段
                <select name="phase" defaultValue="prenatal">
                  {Object.entries(phaseLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label>
                优先级
                <select name="priority" defaultValue="normal">
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                日期
                <input name="due_date" type="date" />
              </label>
            </div>
            <label>
              备注
              <textarea name="note" />
            </label>
            {createError ? <p className="error-text">{createError}</p> : null}
            <div className="sheet-actions">
              <button className="ghost" type="button" onClick={() => setCreating(false)}>
                取消
              </button>
              <button className="primary" type="submit">
                保存
              </button>
            </div>
          </form>
        </Sheet>
      ) : null}

      {confirmingTemplate ? (
        <Sheet title="确认导入疫苗占位模板" onClose={() => setConfirmingTemplate(null)}>
          <div className="stack">
            <p className="notice">
              该模板只用于保存接种本、医生或当地机构给出的安排，以及后续自定义记录；不会生成完整疫苗日程，也不会判断是否应接种。
            </p>
            <div>
              <strong>{confirmingTemplate.title}</strong>
              <p className="muted">{confirmingTemplate.description}</p>
            </div>
            <div className="sheet-actions">
              <button className="ghost" type="button" onClick={() => setConfirmingTemplate(null)}>
                取消
              </button>
              <button
                className="primary"
                type="button"
                disabled={importingCode === confirmingTemplate.template_code}
                onClick={() => void importTemplate(confirmingTemplate, true)}
              >
                确认导入
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
  return (
    <article>
      <div className="item-main">
        <strong>{template.title}</strong>
        <p>
          {phaseLabels[template.phase]} · {template.item_count} 项 · 已导入 {template.imported_item_count} 项
        </p>
        {template.description ? <p>{template.description}</p> : null}
        <div className="tag-row">
          <span>{template.reference_only ? "参考规则" : stageStatusLabels[template.stage_status]}</span>
          <span>{importedStatusLabels[template.imported_status]}</span>
          {Array.from(new Set(template.items.map((item) => item.activation)))
            .slice(0, 4)
            .map((activation) => (
              <span key={activation}>{activationLabels[activation]}</span>
            ))}
          {template.items.slice(0, 3).map((item) => (
            <span key={item.key}>{itemTypeLabels[item.item_type]}</span>
          ))}
        </div>
        <TemplateItems template={template} expanded={expanded} importingItemKey={importingItemKey} onToggle={onToggle} onImportItem={onImportItem} />
      </div>
      <div className="row-actions">
        {template.reference_only ? (
          <span className="muted">仅参考</span>
        ) : (
          <button
            className={template.requires_confirmation ? "secondary small" : "primary small"}
            type="button"
            disabled={importingCode === template.template_code}
            onClick={() => (template.requires_confirmation ? onConfirmTemplate(template) : void onImportTemplate(template))}
          >
            {template.imported_item_count ? "再次导入检查" : template.requires_confirmation ? "确认导入" : "导入"}
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
  const visibleItems = expanded ? template.items : template.items.slice(0, 4);
  return (
    <div className="template-items">
      {visibleItems.map((item) => (
        <div className="template-item-row" key={item.key}>
          <div>
            <strong>{item.title}</strong>
            <p>
              {activationLabels[item.activation]} · {itemTypeLabels[item.item_type]} · {dueRuleLabel(item.due_rule_json)}
            </p>
          </div>
          {item.activation === "manual_optional" && !template.reference_only ? (
            <button
              className="secondary small"
              type="button"
              disabled={importingItemKey === `${template.template_code}:${item.key}`}
              onClick={() => void onImportItem(template, item.key)}
            >
              手动加入
            </button>
          ) : null}
        </div>
      ))}
      {template.items.length > 4 ? (
        <button className="ghost small template-toggle" type="button" onClick={onToggle}>
          {expanded ? "收起" : `展开全部 ${template.items.length} 项`}
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
                  {itemTypeLabels[item.item_type]} · {phaseLabels[item.phase]} · 优先级 {priorityLabels[item.priority]}
                  {checklistActivation(item) ? ` · ${activationLabels[checklistActivation(item)!]}` : ""}
                  {item.due_date ? ` · ${item.due_date}` : ""}
                </p>
                {item.note ? <p>备注：{item.note}</p> : null}
              </div>
              {!readOnly ? (
                <div className="row-actions">
                  <button className="primary small" type="button" onClick={() => void onStatus(item, "done")}>
                    完成
                  </button>
                  <details className="action-menu">
                    <summary>更多</summary>
                    <button className="ghost small" type="button" onClick={() => void onStatus(item, "skipped")}>
                      跳过
                    </button>
                    <button className="ghost small" type="button" onClick={() => void onStatus(item, "pending")}>
                      标为待办
                    </button>
                    {!item.archived_at ? (
                      <button className="ghost small" type="button" onClick={() => void onHide(item)}>
                        隐藏
                      </button>
                    ) : null}
                  </details>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="empty">暂无。</p>
      )}
    </section>
  );
}

function checklistActivation(item: ChecklistItemRecord): ChecklistActivation | null {
  const activation = item.details_json?.activation;
  return typeof activation === "string" && activation in activationLabels ? (activation as ChecklistActivation) : null;
}

function dueRuleLabel(rule: Record<string, unknown> | undefined): string {
  if (!rule) return "无固定日期";
  if (typeof rule.trigger === "string") {
    return (
      {
        before_birth: "出生前",
        birth_to_discharge: "出生至出院",
        discharge_day: "出院当天",
        all: "跨阶段参考"
      }[rule.trigger] ?? "按触发条件"
    );
  }
  if (typeof rule.age_anchor === "string") return ageAnchorLabel(rule.age_anchor);
  if (rule.age_window && typeof rule.age_window === "object") return ageWindowLabel(rule.age_window as Record<string, unknown>);
  return "按阶段";
}

function ageAnchorLabel(anchor: string): string {
  return (
    {
      birth_day: "出生当天",
      "3_5_day": "出生 3-5 天",
      "1_month": "1 月龄",
      "2_month": "2 月龄",
      "4_month": "4 月龄",
      "6_month": "6 月龄",
      "9_month": "9 月龄",
      "12_month": "12 月龄",
      "15_month": "15 月龄",
      "18_month": "18 月龄",
      "24_month": "24 月龄",
      "30_month": "30 月龄",
      "3_year": "3 岁",
      "4_year": "4 岁",
      "5_year": "5 岁",
      "6_year": "6 岁"
    }[anchor] ?? "按年龄"
  );
}

function ageWindowLabel(window: Record<string, unknown>): string {
  if (typeof window.start_days === "number" && typeof window.end_days === "number") return `出生 ${window.start_days}-${window.end_days} 天`;
  if (typeof window.start_months === "number" && typeof window.end_months === "number") return `${window.start_months}-${window.end_months} 月龄`;
  if (typeof window.start_years === "number" && typeof window.end_years === "number") return `${window.start_years}-${window.end_years} 岁`;
  return "年龄窗口";
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}
