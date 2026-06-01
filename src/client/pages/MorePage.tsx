import { useCallback, useEffect, useState } from "react";
import { api, isUnauthorized } from "../api";
import { Sheet } from "../components/Sheet";
import { LanguageToggle, localizedText, useI18n, type LocalizedText } from "../i18n";
import type { BootstrapPayload, EventType, JsonRecord, MilestoneRecord, ShowToast } from "../types";
import { SECONDARY_ACTIONS } from "../utils/format";
import { localInputValueInTimezone, toIsoFromLocalInputInTimezone, todayDateInputValueInTimezone } from "../utils/time";

interface MorePageProps {
  onLogout: () => void;
  onUnauthorized: () => void;
  showToast: ShowToast;
}

type MoreSheet =
  | { kind: "milestone"; seed?: Partial<MilestoneRecord> }
  | { kind: "secondary"; type: Extract<EventType, "symptom" | "tummy_time" | "growth_measurement"> }
  | null;

export function MorePage({ onLogout, onUnauthorized, showToast }: MorePageProps) {
  const { text: tx } = useI18n();
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [milestones, setMilestones] = useState<{ items: MilestoneRecord[]; seed_items: MilestoneRecord[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<MoreSheet>(null);
  const [sheetError, setSheetError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const [nextBootstrap, nextMilestones] = await Promise.all([
        api<BootstrapPayload>("/api/bootstrap"),
        api<{ items: MilestoneRecord[]; seed_items: MilestoneRecord[] }>("/api/milestones")
      ]);
      setBootstrap(nextBootstrap);
      setMilestones(nextMilestones);
    } catch (err) {
      if (isUnauthorized(err)) return onUnauthorized();
      setError(err instanceof Error ? err.message : tx({ en: "Failed to load", zh: "加载失败" }));
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized, tx]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          child_name: text(formData, "child_name") || null,
          child_birth_date: text(formData, "child_birth_date") || null,
          due_date: text(formData, "due_date") || null,
          timezone: text(formData, "timezone") || "Asia/Shanghai",
          read_only_title: text(formData, "read_only_title") || "Baby Status"
        })
      });
      await load();
      showToast(tx({ en: "Profile saved", zh: "资料已保存" }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : tx({ en: "Failed to save", zh: "保存失败" }));
    }
  }

  async function savePasswords(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      await api("/api/settings/passwords", {
        method: "POST",
        body: JSON.stringify({
          admin_password: text(formData, "admin_password") || undefined,
          read_password: text(formData, "read_password") || undefined
        })
      });
      form.reset();
      showToast(tx({ en: "Passwords updated", zh: "密码已更新" }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : tx({ en: "Failed to update", zh: "更新失败" }));
    }
  }

  async function saveStableChildFacts(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bootstrap) return;
    const formData = new FormData(event.currentTarget);
    try {
      await api("/api/stable-child-facts", {
        method: "PATCH",
        body: JSON.stringify({
          nickname: text(formData, "nickname") || null,
          sex: text(formData, "sex") || null,
          birth_datetime: text(formData, "birth_datetime") ? toIsoFromLocalInputInTimezone(text(formData, "birth_datetime"), bootstrap.profile.timezone) : null,
          birth_date: text(formData, "birth_date") || null,
          birth_weight_g: numberOrNull(formData, "birth_weight_g"),
          birth_length_cm: numberOrNull(formData, "birth_length_cm"),
          birth_head_circumference_cm: numberOrNull(formData, "birth_head_circumference_cm"),
          gestational_age_label: text(formData, "gestational_age_label") || null,
          delivery_mode: text(formData, "delivery_mode") || null,
          apgar: text(formData, "apgar") || null,
          current_feeding_mode: text(formData, "current_feeding_mode") || null
        })
      });
      await load();
      showToast(tx({ en: "Baby basic facts saved", zh: "Baby基础事实已保存" }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : tx({ en: "Failed to save", zh: "保存失败" }));
    }
  }

  async function rotateToken() {
    try {
      await api("/api/machine-token/rotate", { method: "POST" });
      await load();
      showToast(tx({ en: "Machine token updated. Update readers that use it.", zh: "machine token 已更新，请同步更新读取端" }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : tx({ en: "Failed to update", zh: "更新失败" }));
    }
  }

  async function submitMilestone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sheet || sheet.kind !== "milestone") return;
    setSheetError("");
    const formData = new FormData(event.currentTarget);
    try {
      await api("/api/milestones", {
        method: "POST",
        body: JSON.stringify({
          title: text(formData, "title"),
          milestone_type: text(formData, "milestone_type") || "custom",
          observed_on: text(formData, "observed_on"),
          note: text(formData, "note") || null,
          source_ref: sheet.seed?.source_ref ?? null
        })
      });
      setSheet(null);
      await load();
      showToast(tx({ en: "Milestone recorded", zh: "里程碑已记录" }));
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : tx({ en: "Failed to save", zh: "保存失败" }));
    }
  }

  async function submitSecondary(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sheet || sheet.kind !== "secondary") return;
    if (!bootstrap) return;
    setSheetError("");
    const formData = new FormData(event.currentTarget);
    try {
      await api("/api/events", {
        method: "POST",
        body: JSON.stringify(secondaryPayload(sheet.type, formData, bootstrap.profile.timezone))
      });
      setSheet(null);
      await load();
      showToast(tx({ en: "Recorded", zh: "已记录" }));
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : tx({ en: "Failed to save", zh: "保存失败" }));
    }
  }

  if (loading) return <div className="loading">{tx({ en: "Loading more...", zh: "正在加载更多..." })}</div>;
  if (error || !bootstrap || !milestones) {
    return (
      <section className="panel">
        <h1>{tx({ en: "More", zh: "更多" })}</h1>
        <p className="error-text">{error || tx({ en: "Failed to load", zh: "加载失败" })}</p>
        <button className="primary" type="button" onClick={() => void load()}>
          {tx({ en: "Retry", zh: "重试" })}
        </button>
      </section>
    );
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{tx({ en: "Settings, export, and milestones", zh: "设置、导出与里程碑" })}</p>
          <h1>{tx({ en: "More", zh: "更多" })}</h1>
        </div>
        <button className="ghost small" type="button" onClick={onLogout}>
          {tx({ en: "Log out", zh: "退出" })}
        </button>
      </header>

      <section className="panel">
        <h2>{tx({ en: "More records", zh: "更多记录" })}</h2>
        <div className="row-actions">
          {SECONDARY_ACTIONS.map((item) => (
            <button
              key={item.type}
              className="secondary"
              type="button"
              onClick={() => setSheet({ kind: "secondary", type: item.type as Extract<EventType, "symptom" | "tummy_time" | "growth_measurement"> })}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel language-settings-panel">
        <div className="section-head">
          <div>
            <h2>{tx({ en: "Language", zh: "语言" })}</h2>
            <p className="muted">{tx({ en: "Changes apply to record, timeline, checklist, and read-only views.", zh: "切换后会应用到记录、时间线、清单和只读视图。" })}</p>
          </div>
          <LanguageToggle />
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>{tx({ en: "Milestones", zh: "里程碑" })}</h2>
          <button className="primary small" type="button" onClick={() => setSheet({ kind: "milestone" })}>
            {tx({ en: "Add", zh: "新增" })}
          </button>
        </div>
        <div className="simple-list">
          {milestones.seed_items.map((item) => (
            <article key={item.id}>
              <strong>{milestoneTitle(item)}</strong>
              <p>
                {milestoneTypeLabel(item.milestone_type)}
                {milestoneAgeLabel(item) ? ` · ${milestoneAgeLabel(item)}` : ""}
              </p>
              <button
                className="secondary small"
                type="button"
                onClick={() => setSheet({ kind: "milestone", seed: { ...item, source_ref: item.id } })}
              >
                {tx({ en: "Record", zh: "记录" })}
              </button>
            </article>
          ))}
        </div>
        <h3>{tx({ en: "Recorded", zh: "已记录" })}</h3>
        {milestones.items.length ? (
          <div className="simple-list">
            {milestones.items.map((item) => (
              <article key={item.id}>
                <strong>{milestoneTitle(item)}</strong>
                <p>
                  {item.observed_on} · {milestoneTypeLabel(item.milestone_type)}
                  {item.note ? ` · ${item.note}` : ""}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty">{tx({ en: "No milestones recorded yet.", zh: "还没有记录里程碑。" })}</p>
        )}
      </section>

      <section className="panel">
        <h2>{tx({ en: "Export", zh: "导出" })}</h2>
        <a className="button primary" href="/api/export/full">
          {tx({ en: "Download ZIP", zh: "下载 ZIP" })}
        </a>
      </section>

      <section className="panel">
        <h2>{tx({ en: "Documents", zh: "资料" })}</h2>
        <p className="muted">
          {tx({
            en: "V1 does not support in-app document uploads. Keep important documents in your external analysis workspace.",
            zh: "V1 暂不提供站内资料上传。关键资料可继续保留在 ChatGPT 项目中供分析。"
          })}
        </p>
      </section>

      <section className="panel">
        <h2>{tx({ en: "Settings", zh: "设置" })}</h2>
        <form className="stack" onSubmit={saveProfile}>
          <label>
            {tx({ en: "Baby name", zh: "Baby名字" })}
            <input name="child_name" defaultValue={bootstrap.profile.child_name ?? ""} />
          </label>
          <label>
            {tx({ en: "Birth date", zh: "出生日期" })}
            <input name="child_birth_date" type="date" defaultValue={bootstrap.profile.child_birth_date ?? ""} />
          </label>
          <label>
            {tx({ en: "Due date", zh: "预产期" })}
            <input name="due_date" type="date" defaultValue={bootstrap.profile.due_date ?? ""} />
          </label>
          <label>
            {tx({ en: "Timezone", zh: "时区" })}
            <input name="timezone" defaultValue={bootstrap.profile.timezone} />
          </label>
          <label>
            {tx({ en: "Read-only title", zh: "只读标题" })}
            <input name="read_only_title" defaultValue={bootstrap.profile.read_only_title} />
          </label>
          <button className="primary" type="submit">
            {tx({ en: "Save profile", zh: "保存资料" })}
          </button>
        </form>
        <form className="stack" onSubmit={saveStableChildFacts}>
          <h3>{tx({ en: "Baby basic facts", zh: "Baby基础事实" })}</h3>
          <label>
            {tx({ en: "Nickname", zh: "昵称" })}
            <input name="nickname" defaultValue={bootstrap.stable_child_facts.nickname ?? bootstrap.profile.child_name ?? ""} />
          </label>
          <label>
            {tx({ en: "Sex", zh: "性别" })}
            <select name="sex" defaultValue={bootstrap.stable_child_facts.sex ?? ""}>
              <option value="">{tx({ en: "Not set", zh: "未填写" })}</option>
              <option value="female">{tx({ en: "Female", zh: "女" })}</option>
              <option value="male">{tx({ en: "Male", zh: "男" })}</option>
              <option value="unknown">{tx({ en: "Unknown", zh: "不确定" })}</option>
            </select>
          </label>
          <label>
            {tx({ en: "Exact birth time", zh: "准确出生时间" })}
            <input
              name="birth_datetime"
              type="datetime-local"
              defaultValue={bootstrap.stable_child_facts.birth_datetime ? localInputValueInTimezone(bootstrap.stable_child_facts.birth_datetime, bootstrap.profile.timezone) : ""}
            />
          </label>
          <label>
            {tx({ en: "Birth date", zh: "出生日期" })}
            <input name="birth_date" type="date" defaultValue={bootstrap.stable_child_facts.birth_date ?? bootstrap.profile.child_birth_date ?? ""} />
          </label>
          <label>
            {tx({ en: "Birth weight g", zh: "出生体重 g" })}
            <input name="birth_weight_g" type="number" min="300" max="8000" step="1" defaultValue={numberInputValue(bootstrap.stable_child_facts.birth_weight_g)} />
          </label>
          <label>
            {tx({ en: "Birth length cm", zh: "出生身长 cm" })}
            <input name="birth_length_cm" type="number" min="20" max="80" step="0.1" defaultValue={numberInputValue(bootstrap.stable_child_facts.birth_length_cm)} />
          </label>
          <label>
            {tx({ en: "Birth head circumference cm", zh: "出生头围 cm" })}
            <input
              name="birth_head_circumference_cm"
              type="number"
              min="15"
              max="60"
              step="0.1"
              defaultValue={numberInputValue(bootstrap.stable_child_facts.birth_head_circumference_cm)}
            />
          </label>
          <label>
            {tx({ en: "Gestational age", zh: "孕周" })}
            <input name="gestational_age_label" placeholder={tx({ en: "e.g. 38+6", zh: "例如 38+6" })} defaultValue={bootstrap.stable_child_facts.gestational_age_label ?? ""} />
          </label>
          <label>
            {tx({ en: "Delivery mode", zh: "生产方式" })}
            <input name="delivery_mode" placeholder={tx({ en: "e.g. vaginal / c-section", zh: "例如 vaginal / c-section" })} defaultValue={bootstrap.stable_child_facts.delivery_mode ?? ""} />
          </label>
          <label>
            Apgar
            <input name="apgar" placeholder={tx({ en: "e.g. 10/10/10", zh: "例如 10/10/10" })} defaultValue={bootstrap.stable_child_facts.apgar ?? ""} />
          </label>
          <label>
            {tx({ en: "Current feeding mode", zh: "当前喂养模式" })}
            <input
              name="current_feeding_mode"
              placeholder={tx({ en: "e.g. formula_primary_with_breastfeeding_recovery", zh: "例如 formula_primary_with_breastfeeding_recovery" })}
              defaultValue={bootstrap.stable_child_facts.current_feeding_mode ?? ""}
            />
          </label>
          <button className="secondary" type="submit">
            {tx({ en: "Save baby basic facts", zh: "保存Baby基础事实" })}
          </button>
        </form>
        <form className="stack password-form" onSubmit={savePasswords}>
          <label>
            {tx({ en: "New admin password", zh: "新 admin 密码" })}
            <input name="admin_password" type="password" autoComplete="new-password" />
          </label>
          <label>
            {tx({ en: "New read-only password", zh: "新 read-only 密码" })}
            <input name="read_password" type="password" autoComplete="new-password" />
          </label>
          <button className="secondary" type="submit">
            {tx({ en: "Update passwords", zh: "更新密码" })}
          </button>
        </form>
        <div className="token-row">
          <code>{bootstrap.profile.machine_token ?? tx({ en: "Machine token not generated yet", zh: "尚未生成 machine token" })}</code>
          <button className="secondary small" type="button" onClick={() => void rotateToken()}>
            {tx({ en: "Regenerate machine token", zh: "重新生成 machine token" })}
          </button>
        </div>
      </section>

      {sheet?.kind === "milestone" ? (
        <Sheet title={tx({ en: "Record milestone", zh: "记录里程碑" })} onClose={() => setSheet(null)}>
          <form className="stack" onSubmit={submitMilestone}>
            <label>
              {tx({ en: "Title", zh: "标题" })}
              <input name="title" defaultValue={sheet.seed ? milestoneTitle(sheet.seed) : ""} required />
            </label>
            <label>
              {tx({ en: "Type", zh: "类型" })}
              <select name="milestone_type" defaultValue={sheet.seed?.milestone_type ?? "custom"}>
                <option value="custom">{milestoneTypeLabel("custom")}</option>
                <option value="social">{milestoneTypeLabel("social")}</option>
                <option value="motor">{milestoneTypeLabel("motor")}</option>
                <option value="language">{milestoneTypeLabel("language")}</option>
              </select>
            </label>
            <label>
              {tx({ en: "Date", zh: "日期" })}
              <input name="observed_on" type="date" defaultValue={todayDateInputValueInTimezone(bootstrap.profile.timezone)} required />
            </label>
            <label>
              {tx({ en: "Note", zh: "备注" })}
              <textarea name="note" />
            </label>
            {sheetError ? <p className="error-text">{sheetError}</p> : null}
            <div className="sheet-actions">
              <button className="ghost" type="button" onClick={() => setSheet(null)}>
                {tx({ en: "Cancel", zh: "取消" })}
              </button>
              <button className="primary" type="submit">
                {tx({ en: "Save", zh: "保存" })}
              </button>
            </div>
          </form>
        </Sheet>
      ) : null}

      {sheet?.kind === "secondary" ? (
        <Sheet title={secondaryTitle(sheet.type)} onClose={() => setSheet(null)}>
          <form className="stack" onSubmit={submitSecondary}>
            <label>
              {tx({ en: "Time", zh: "时间" })}
              <input name="occurred_at" type="datetime-local" defaultValue={localInputValueInTimezone(undefined, bootstrap.profile.timezone)} required />
            </label>
            {secondaryFields(sheet.type)}
            {sheetError ? <p className="error-text">{sheetError}</p> : null}
            <div className="sheet-actions">
              <button className="ghost" type="button" onClick={() => setSheet(null)}>
                {tx({ en: "Cancel", zh: "取消" })}
              </button>
              <button className="primary" type="submit">
                {tx({ en: "Save", zh: "保存" })}
              </button>
            </div>
          </form>
        </Sheet>
      ) : null}
    </>
  );
}

const milestoneText: Record<string, { title: LocalizedText; age?: LocalizedText }> = {
  ms_social_smile: {
    title: { en: "First social smile", zh: "第一次社交性微笑" },
    age: { en: "Around 2 months", zh: "约 2 月龄" }
  },
  ms_head_control: {
    title: { en: "Steadier head control", zh: "抬头和头部控制更稳定" },
    age: { en: "Around 2-4 months", zh: "约 2-4 月龄" }
  },
  ms_roll_over: {
    title: { en: "First roll over", zh: "第一次翻身" },
    age: { en: "Around 4-6 months", zh: "约 4-6 月龄" }
  },
  ms_sit_without_support: {
    title: { en: "Sits without support", zh: "能独坐" },
    age: { en: "Around 6-9 months", zh: "约 6-9 月龄" }
  },
  ms_crawl: {
    title: { en: "Starts crawling", zh: "开始爬行" },
    age: { en: "Around 8-10 months", zh: "约 8-10 月龄" }
  },
  ms_pull_to_stand: {
    title: { en: "Pulls to stand", zh: "扶站" },
    age: { en: "Around 9-12 months", zh: "约 9-12 月龄" }
  },
  ms_first_word: {
    title: { en: "First meaningful word", zh: "第一次有意义地叫词" },
    age: { en: "Around 9-15 months", zh: "约 9-15 月龄" }
  },
  ms_independent_steps: {
    title: { en: "First independent steps", zh: "第一次独立迈步" },
    age: { en: "Around 12-18 months", zh: "约 12-18 月龄" }
  }
};

function milestoneTitle(item: Partial<MilestoneRecord>): string {
  const key = milestoneSeedKey(item);
  if (key && milestoneText[key]) return localizedText(milestoneText[key].title);
  return item.title ?? "";
}

function milestoneAgeLabel(item: Partial<MilestoneRecord>): string {
  const key = milestoneSeedKey(item);
  if (key && milestoneText[key]?.age) return localizedText(milestoneText[key].age);
  return item.suggested_age_label ?? "";
}

function milestoneSeedKey(item: Partial<MilestoneRecord>): string | null {
  if (item.id && milestoneText[item.id]) return item.id;
  if (item.source_ref && milestoneText[item.source_ref]) return item.source_ref;
  const match = Object.entries(milestoneText).find(([, value]) => value.title.en === item.title || value.title.zh === item.title);
  return match?.[0] ?? null;
}

function milestoneTypeLabel(type: MilestoneRecord["milestone_type"] | undefined): string {
  if (type === "social") return localizedText({ en: "Social", zh: "社交" });
  if (type === "motor") return localizedText({ en: "Motor", zh: "运动" });
  if (type === "language") return localizedText({ en: "Language", zh: "语言" });
  return localizedText({ en: "Custom", zh: "自定义" });
}

function secondaryFields(type: Extract<EventType, "symptom" | "tummy_time" | "growth_measurement">) {
  if (type === "symptom") {
    return (
      <>
        <label>
          {localizedText({ en: "Symptom tags", zh: "症状标签" })}
          <input name="symptom_tags" placeholder={localizedText({ en: "e.g. cough, rash", zh: "例如 cough, rash" })} />
        </label>
        <label>
          {localizedText({ en: "Severity", zh: "程度" })}
          <select name="severity" defaultValue="unknown">
            <option value="unknown">{localizedText({ en: "Unknown", zh: "不确定" })}</option>
            <option value="mild">{localizedText({ en: "Mild", zh: "轻" })}</option>
            <option value="moderate">{localizedText({ en: "Moderate", zh: "中" })}</option>
            <option value="severe">{localizedText({ en: "Severe", zh: "重" })}</option>
          </select>
        </label>
        <label>
          {localizedText({ en: "Note", zh: "备注" })}
          <textarea name="note" />
        </label>
      </>
    );
  }

  if (type === "tummy_time") {
    return (
      <>
        <label>
          {localizedText({ en: "End time", zh: "结束时间" })}
          <input name="ended_at" type="datetime-local" />
        </label>
        <label>
          {localizedText({ en: "Duration (minutes)", zh: "时长（分钟）" })}
          <input name="duration_min" type="number" min="0" step="1" inputMode="numeric" />
        </label>
        <label>
          {localizedText({ en: "Note", zh: "备注" })}
          <textarea name="note" />
        </label>
      </>
    );
  }

  return (
    <>
      <label>
        {localizedText({ en: "Type", zh: "类型" })}
        <select name="measure_type" defaultValue="weight_kg" required>
          <option value="weight_kg">{localizedText({ en: "Weight kg", zh: "体重 kg" })}</option>
          <option value="length_cm">{localizedText({ en: "Length cm", zh: "身长 cm" })}</option>
          <option value="head_circumference_cm">{localizedText({ en: "Head circumference cm", zh: "头围 cm" })}</option>
        </select>
      </label>
      <label>
        {localizedText({ en: "Value", zh: "数值" })}
        <input name="amount_value" type="number" step="0.001" inputMode="decimal" required />
      </label>
      <label>
        {localizedText({ en: "Note", zh: "备注" })}
        <textarea name="note" />
      </label>
    </>
  );
}

function secondaryPayload(type: Extract<EventType, "symptom" | "tummy_time" | "growth_measurement">, formData: FormData, timezone: string): JsonRecord {
  const occurredAt = toIsoFromLocalInputInTimezone(requiredText(formData, "occurred_at"), timezone);
  const details: JsonRecord = {};

  if (type === "symptom") {
    const tags = text(formData, "symptom_tags")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const note = text(formData, "note");
    if (!tags.length && !note) throw new Error(localizedText({ en: "Please enter symptom tags or a note", zh: "请填写症状标签或备注" }));
    if (tags.length) details.symptom_tags = tags;
    details.severity = text(formData, "severity") || "unknown";
    return {
      event_type: type,
      occurred_at: occurredAt,
      note: note || null,
      details_json: details
    };
  }

  if (type === "tummy_time") {
    const duration = text(formData, "duration_min");
    if (duration) details.duration_min = Number(duration);
    return {
      event_type: type,
      occurred_at: occurredAt,
      ended_at: text(formData, "ended_at") ? toIsoFromLocalInputInTimezone(text(formData, "ended_at"), timezone) : null,
      note: text(formData, "note") || null,
      details_json: details
    };
  }

  details.measure_type = requiredText(formData, "measure_type");
  return {
    event_type: type,
    occurred_at: occurredAt,
    amount_value: Number(requiredText(formData, "amount_value")),
    note: text(formData, "note") || null,
    details_json: details
  };
}

function secondaryTitle(type: Extract<EventType, "symptom" | "tummy_time" | "growth_measurement">): string {
  if (type === "symptom") return localizedText({ en: "Record symptom", zh: "记录症状" });
  if (type === "tummy_time") return localizedText({ en: "Record tummy time", zh: "记录趴趴时间" });
  return localizedText({ en: "Record growth measurement", zh: "记录生长测量" });
}

function requiredText(formData: FormData, key: string): string {
  const value = text(formData, key);
  if (!value) throw new Error(localizedText({ en: "Please fill in the required field", zh: "请填写必填字段" }));
  return value;
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function numberOrNull(formData: FormData, key: string): number | null {
  const value = text(formData, key);
  return value ? Number(value) : null;
}

function numberInputValue(value: number | null): string {
  return value == null ? "" : String(value);
}
