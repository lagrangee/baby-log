import { useCallback, useEffect, useState } from "react";
import { api, isUnauthorized } from "../api";
import { Sheet } from "../components/Sheet";
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
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

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
      showToast("资料已保存");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "保存失败");
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
      showToast("密码已更新");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "更新失败");
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
      showToast("Baby基础事实已保存");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function rotateToken() {
    try {
      await api("/api/machine-token/rotate", { method: "POST" });
      await load();
      showToast("machine token 已更新，请同步更新读取端");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "更新失败");
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
      showToast("里程碑已记录");
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : "保存失败");
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
      showToast("已记录");
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : "保存失败");
    }
  }

  if (loading) return <div className="loading">正在加载更多...</div>;
  if (error || !bootstrap || !milestones) {
    return (
      <section className="panel">
        <h1>更多</h1>
        <p className="error-text">{error || "加载失败"}</p>
        <button className="primary" type="button" onClick={() => void load()}>
          重试
        </button>
      </section>
    );
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">设置、导出与里程碑</p>
          <h1>更多</h1>
        </div>
        <button className="ghost small" type="button" onClick={onLogout}>
          退出
        </button>
      </header>

      <section className="panel">
        <h2>更多记录</h2>
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

      <section className="panel">
        <div className="section-head">
          <h2>里程碑</h2>
          <button className="primary small" type="button" onClick={() => setSheet({ kind: "milestone" })}>
            新增
          </button>
        </div>
        <div className="simple-list">
          {milestones.seed_items.map((item) => (
            <article key={item.id}>
              <strong>{item.title}</strong>
              <p>{item.suggested_age_label ?? ""}</p>
              <button
                className="secondary small"
                type="button"
                onClick={() => setSheet({ kind: "milestone", seed: { ...item, source_ref: item.id } })}
              >
                记录
              </button>
            </article>
          ))}
        </div>
        <h3>已记录</h3>
        {milestones.items.length ? (
          <div className="simple-list">
            {milestones.items.map((item) => (
              <article key={item.id}>
                <strong>{item.title}</strong>
                <p>
                  {item.observed_on}
                  {item.note ? ` · ${item.note}` : ""}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty">还没有记录里程碑。</p>
        )}
      </section>

      <section className="panel">
        <h2>导出</h2>
        <a className="button primary" href="/api/export/full">
          下载 ZIP
        </a>
      </section>

      <section className="panel">
        <h2>资料</h2>
        <p className="muted">V1 暂不提供站内资料上传。关键资料可继续保留在 ChatGPT 项目中供分析。</p>
      </section>

      <section className="panel">
        <h2>设置</h2>
        <form className="stack" onSubmit={saveProfile}>
          <label>
            Baby名字
            <input name="child_name" defaultValue={bootstrap.profile.child_name ?? ""} />
          </label>
          <label>
            出生日期
            <input name="child_birth_date" type="date" defaultValue={bootstrap.profile.child_birth_date ?? ""} />
          </label>
          <label>
            预产期
            <input name="due_date" type="date" defaultValue={bootstrap.profile.due_date ?? ""} />
          </label>
          <label>
            时区
            <input name="timezone" defaultValue={bootstrap.profile.timezone} />
          </label>
          <label>
            只读标题
            <input name="read_only_title" defaultValue={bootstrap.profile.read_only_title} />
          </label>
          <button className="primary" type="submit">
            保存资料
          </button>
        </form>
        <form className="stack" onSubmit={saveStableChildFacts}>
          <h3>Baby基础事实</h3>
          <label>
            昵称
            <input name="nickname" defaultValue={bootstrap.stable_child_facts.nickname ?? bootstrap.profile.child_name ?? ""} />
          </label>
          <label>
            性别
            <select name="sex" defaultValue={bootstrap.stable_child_facts.sex ?? ""}>
              <option value="">未填写</option>
              <option value="female">女</option>
              <option value="male">男</option>
              <option value="unknown">不确定</option>
            </select>
          </label>
          <label>
            准确出生时间
            <input
              name="birth_datetime"
              type="datetime-local"
              defaultValue={bootstrap.stable_child_facts.birth_datetime ? localInputValueInTimezone(bootstrap.stable_child_facts.birth_datetime, bootstrap.profile.timezone) : ""}
            />
          </label>
          <label>
            出生日期
            <input name="birth_date" type="date" defaultValue={bootstrap.stable_child_facts.birth_date ?? bootstrap.profile.child_birth_date ?? ""} />
          </label>
          <label>
            出生体重 g
            <input name="birth_weight_g" type="number" min="300" max="8000" step="1" defaultValue={numberInputValue(bootstrap.stable_child_facts.birth_weight_g)} />
          </label>
          <label>
            出生身长 cm
            <input name="birth_length_cm" type="number" min="20" max="80" step="0.1" defaultValue={numberInputValue(bootstrap.stable_child_facts.birth_length_cm)} />
          </label>
          <label>
            出生头围 cm
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
            孕周
            <input name="gestational_age_label" placeholder="例如 38+6" defaultValue={bootstrap.stable_child_facts.gestational_age_label ?? ""} />
          </label>
          <label>
            生产方式
            <input name="delivery_mode" placeholder="例如 vaginal / c-section" defaultValue={bootstrap.stable_child_facts.delivery_mode ?? ""} />
          </label>
          <label>
            Apgar
            <input name="apgar" placeholder="例如 10/10/10" defaultValue={bootstrap.stable_child_facts.apgar ?? ""} />
          </label>
          <label>
            当前喂养模式
            <input
              name="current_feeding_mode"
              placeholder="例如 formula_primary_with_breastfeeding_recovery"
              defaultValue={bootstrap.stable_child_facts.current_feeding_mode ?? ""}
            />
          </label>
          <button className="secondary" type="submit">
            保存Baby基础事实
          </button>
        </form>
        <form className="stack password-form" onSubmit={savePasswords}>
          <label>
            新 admin 密码
            <input name="admin_password" type="password" autoComplete="new-password" />
          </label>
          <label>
            新 read-only 密码
            <input name="read_password" type="password" autoComplete="new-password" />
          </label>
          <button className="secondary" type="submit">
            更新密码
          </button>
        </form>
        <div className="token-row">
          <code>{bootstrap.profile.machine_token ?? "尚未生成 machine token"}</code>
          <button className="secondary small" type="button" onClick={() => void rotateToken()}>
            重新生成 machine token
          </button>
        </div>
      </section>

      {sheet?.kind === "milestone" ? (
        <Sheet title="记录里程碑" onClose={() => setSheet(null)}>
          <form className="stack" onSubmit={submitMilestone}>
            <label>
              标题
              <input name="title" defaultValue={sheet.seed?.title ?? ""} required />
            </label>
            <label>
              类型
              <select name="milestone_type" defaultValue={sheet.seed?.milestone_type ?? "custom"}>
                <option value="custom">custom</option>
                <option value="social">social</option>
                <option value="motor">motor</option>
                <option value="language">language</option>
              </select>
            </label>
            <label>
              日期
              <input name="observed_on" type="date" defaultValue={todayDateInputValueInTimezone(bootstrap.profile.timezone)} required />
            </label>
            <label>
              备注
              <textarea name="note" />
            </label>
            {sheetError ? <p className="error-text">{sheetError}</p> : null}
            <div className="sheet-actions">
              <button className="ghost" type="button" onClick={() => setSheet(null)}>
                取消
              </button>
              <button className="primary" type="submit">
                保存
              </button>
            </div>
          </form>
        </Sheet>
      ) : null}

      {sheet?.kind === "secondary" ? (
        <Sheet title={secondaryTitle(sheet.type)} onClose={() => setSheet(null)}>
          <form className="stack" onSubmit={submitSecondary}>
            <label>
              时间
              <input name="occurred_at" type="datetime-local" defaultValue={localInputValueInTimezone(undefined, bootstrap.profile.timezone)} required />
            </label>
            {secondaryFields(sheet.type)}
            {sheetError ? <p className="error-text">{sheetError}</p> : null}
            <div className="sheet-actions">
              <button className="ghost" type="button" onClick={() => setSheet(null)}>
                取消
              </button>
              <button className="primary" type="submit">
                保存
              </button>
            </div>
          </form>
        </Sheet>
      ) : null}
    </>
  );
}

function secondaryFields(type: Extract<EventType, "symptom" | "tummy_time" | "growth_measurement">) {
  if (type === "symptom") {
    return (
      <>
        <label>
          症状标签
          <input name="symptom_tags" placeholder="例如 cough, rash" />
        </label>
        <label>
          程度
          <select name="severity" defaultValue="unknown">
            <option value="unknown">不确定</option>
            <option value="mild">轻</option>
            <option value="moderate">中</option>
            <option value="severe">重</option>
          </select>
        </label>
        <label>
          备注
          <textarea name="note" />
        </label>
      </>
    );
  }

  if (type === "tummy_time") {
    return (
      <>
        <label>
          结束时间
          <input name="ended_at" type="datetime-local" />
        </label>
        <label>
          时长（分钟）
          <input name="duration_min" type="number" min="0" step="1" inputMode="numeric" />
        </label>
        <label>
          备注
          <textarea name="note" />
        </label>
      </>
    );
  }

  return (
    <>
      <label>
        类型
        <select name="measure_type" defaultValue="weight_kg" required>
          <option value="weight_kg">体重 kg</option>
          <option value="length_cm">身长 cm</option>
          <option value="head_circumference_cm">头围 cm</option>
        </select>
      </label>
      <label>
        数值
        <input name="amount_value" type="number" step="0.001" inputMode="decimal" required />
      </label>
      <label>
        备注
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
    if (!tags.length && !note) throw new Error("请填写症状标签或备注");
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
  if (type === "symptom") return "记录症状";
  if (type === "tummy_time") return "记录趴趴时间";
  return "记录生长测量";
}

function requiredText(formData: FormData, key: string): string {
  const value = text(formData, key);
  if (!value) throw new Error("请填写必填字段");
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
