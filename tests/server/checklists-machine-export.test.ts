import { describe, expect, test } from "vitest";
import { createMemoryStore } from "../../src/server/testing/memory-store";
import { ChecklistService } from "../../src/server/services/checklist-service";
import { EventService } from "../../src/server/services/event-service";
import { MilestoneService } from "../../src/server/services/milestone-service";
import { createMachineEndpointResponse } from "../../src/server/routes";
import { buildMachineDaysPayload, buildMachineEventsPayload, buildMachinePayload } from "../../src/server/services/machine-service";
import { createFullExportZip } from "../../src/server/services/export-service";
import { getStableChildFacts, updateStableChildFacts } from "../../src/server/services/stable-child-facts-service";
import { ValidationError } from "../../src/shared/content";

const STAGED_TEMPLATE_CODES = [
  "aap_prenatal_late_v1",
  "aap_birth_hospital_v1",
  "aap_first_week_v1",
  "aap_first_month_v1",
  "aap_infant_1_3m_v1",
  "aap_infant_4_7m_v1",
  "aap_infant_8_12m_v1",
  "aap_toddler_12_18m_v1",
  "aap_toddler_18_24m_v1",
  "aap_toddler_24_30m_v1",
  "aap_toddler_3y_v1",
  "aap_preschool_4_5y_v1",
  "aap_school_entry_6y_bridge_v1",
  "aap_cross_cutting_v1"
];

describe("checklists, machine payload, and export", () => {
  test("template library returns only the allowed Checklist 2.0 templates", async () => {
    const checklists = new ChecklistService(createMemoryStore());

    const library = await checklists.listTemplates();

    expect(library.map((template) => template.template_code)).toEqual(STAGED_TEMPLATE_CODES);
    expect(library.reduce((total, template) => total + template.item_count, 0)).toBe(83);
    expect(library.find((template) => template.template_code === "aap_prenatal_late_v1")).toMatchObject({
      template_code: "aap_prenatal_late_v1",
      requires_confirmation: false,
      item_count: 7
    });
    expect(new Set(library.flatMap((template) => template.items.map((item) => item.item_type)))).toEqual(
      new Set(["well_visit", "screening", "vaccine", "admin", "safety", "feeding_plan", "custom"])
    );
    expect(library.find((template) => template.template_code === "aap_prenatal_late_v1")?.items.find((item) => item.key === "choose_pediatric_provider")).toMatchObject({
      template_code: "aap_prenatal_late_v1",
      template_item_key: "choose_pediatric_provider",
      title: "确认儿科医生/儿保机构与联系方式",
      category: "visit_prep",
      activation: "core_auto",
      priority: "high",
      due_rule_json: { trigger: "before_birth" },
      details_json: {
        parent_task: "记录儿科医生、夜间咨询方式、急诊/医院路径和首诊预约方式。",
        source_basis: "aap_book"
      }
    });
  });

  test("template library marks current recommendations, future templates, and import status", async () => {
    const store = createMemoryStore({
      profile: {
        child_birth_date: null,
        due_date: "2026-05-20",
        phase: "pregnancy_prebirth",
        timezone: "Asia/Shanghai"
      }
    });
    const checklists = new ChecklistService(store);

    const beforeImport = await checklists.listTemplates("2026-04-24T02:00:00Z");
    expect(beforeImport.find((template) => template.template_code === "aap_prenatal_late_v1")).toMatchObject({
      recommended_now: true,
      future: false,
      stage_status: "current_stage",
      imported_status: "not_imported"
    });
    expect(beforeImport.find((template) => template.template_code === "aap_first_week_v1")).toMatchObject({
      recommended_now: false,
      future: true,
      stage_status: "future_stage",
      imported_status: "not_imported"
    });

    await store.insertChecklistItem({
      id: "partial:choose_pediatric_provider",
      title: "出生后 3-5 天随访",
      description: null,
      item_type: "admin",
      phase: "prenatal",
      source_basis: "aap_book",
      template_code: "aap_prenatal_late_v1",
      template_item_key: "choose_pediatric_provider",
      template_version: "1.0.0",
      due_date: null,
      due_rule_json: {},
      details_json: { activation: "core_auto" },
      status: "pending",
      priority: "high",
      note: null,
      completed_at: null,
      skipped_at: null,
      archived_at: null,
      sort_order: 10,
      created_at: "2026-04-24T02:00:00Z",
      updated_at: "2026-04-24T02:00:00Z"
    });

    const partial = await checklists.listTemplates("2026-04-24T02:10:00Z");
    expect(partial.find((template) => template.template_code === "aap_prenatal_late_v1")).toMatchObject({
      imported_status: "partially_imported"
    });

    await checklists.importTemplate({ template_code: "aap_prenatal_late_v1" }, "2026-04-24T02:15:00Z");
    const afterImport = await checklists.listTemplates("2026-04-24T02:20:00Z");
    expect(afterImport.find((template) => template.template_code === "aap_prenatal_late_v1")).toMatchObject({
      imported_status: "imported"
    });
  });

  test("birth hospital and first week templates are gently recommended after birth without auto-import", async () => {
    const store = createMemoryStore({
      profile: {
        child_birth_date: "2026-04-26",
        due_date: "2026-05-20",
        phase: "newborn_or_baby",
        timezone: "Asia/Shanghai"
      }
    });
    const checklists = new ChecklistService(store);

    const library = await checklists.listTemplates("2026-04-26T02:00:00Z");

    expect(library.find((template) => template.template_code === "aap_birth_hospital_v1")).toMatchObject({
      recommended_now: true,
      imported_status: "not_imported"
    });
    expect(library.find((template) => template.template_code === "aap_first_week_v1")).toMatchObject({
      recommended_now: true,
      imported_status: "not_imported"
    });
    expect(await store.listChecklistItems({ includeArchived: true })).toHaveLength(0);
  });

  test("template library distinguishes past, current, future, and reference-only groups", async () => {
    const store = createMemoryStore({
      profile: {
        child_birth_date: "2024-04-24",
        due_date: null,
        phase: "newborn_or_baby",
        timezone: "Asia/Shanghai"
      }
    });
    const checklists = new ChecklistService(store);

    const library = await checklists.listTemplates("2026-04-24T02:00:00Z");

    expect(library.find((template) => template.template_code === "aap_prenatal_late_v1")).toMatchObject({
      recommended_now: false,
      future: false,
      stage_status: "past_stage"
    });
    expect(library.find((template) => template.template_code === "aap_toddler_18_24m_v1")).toMatchObject({
      recommended_now: true,
      future: false,
      stage_status: "current_stage"
    });
    expect(library.find((template) => template.template_code === "aap_toddler_3y_v1")).toMatchObject({
      recommended_now: false,
      future: true,
      stage_status: "future_stage"
    });
    expect(library.find((template) => template.template_code === "aap_cross_cutting_v1")).toMatchObject({
      reference_only: true
    });
  });

  test("custom checklist creation validates phase, source_basis, item_type, and status", async () => {
    const store = createMemoryStore();
    const checklists = new ChecklistService(store);

    const item = await checklists.createCustom(
      {
        title: "准备待产包",
        description: "按家庭情况补充",
        item_type: "admin",
        phase: "prenatal",
        source_basis: "custom",
        priority: "high",
        due_date: "2026-04-30",
        note: "先列清单"
      },
      "2026-04-24T00:00:00Z"
    );

    expect(item).toMatchObject({
      title: "准备待产包",
      description: "按家庭情况补充",
      item_type: "admin",
      phase: "prenatal",
      source_basis: "custom",
      template_code: null,
      template_item_key: null,
      template_version: null,
      status: "pending",
      note: "先列清单"
    });
    expect(item).not.toHaveProperty("source_kind");
    expect(item).not.toHaveProperty("source_ref");
    expect(item).not.toHaveProperty("window_end_date");

    await expect(checklists.createCustom({ title: "x", item_type: "symptom", phase: "prenatal" } as never, "2026-04-24T00:00:00Z")).rejects.toBeInstanceOf(ValidationError);
    await expect(checklists.createCustom({ title: "x", item_type: "custom", phase: "wrong" } as never, "2026-04-24T00:00:00Z")).rejects.toBeInstanceOf(ValidationError);
    await expect(checklists.createCustom({ title: "x", item_type: "custom", phase: "prenatal", source_basis: "doctor" } as never, "2026-04-24T00:00:00Z")).rejects.toBeInstanceOf(ValidationError);
    await expect(checklists.update(item.id, { status: "hidden" } as never, "2026-04-24T00:01:00Z")).rejects.toBeInstanceOf(ValidationError);
  });

  test("template import is item-level idempotent and does not overwrite user state", async () => {
    const store = createMemoryStore();
    const checklists = new ChecklistService(store);

    const first = await checklists.importTemplate({ template_code: "aap_prenatal_late_v1" }, "2026-04-24T00:00:00Z");
    expect(first).toMatchObject({
      template_code: "aap_prenatal_late_v1",
      item_count: 7,
      created_count: 6,
      skipped_existing_count: 0
    });

    await checklists.update(
      "aap_prenatal_late_v1:1.0.0:choose_pediatric_provider",
      { status: "done", note: "保留用户备注" },
      "2026-04-24T00:10:00Z"
    );
    await checklists.update(
      "aap_prenatal_late_v1:1.0.0:prepare_birth_contacts",
      { status: "skipped", note: "暂不需要", archived: true },
      "2026-04-24T00:11:00Z"
    );

    const second = await checklists.importTemplate({ template_code: "aap_prenatal_late_v1" }, "2026-04-24T00:20:00Z");
    expect(second).toMatchObject({
      created_count: 0,
      skipped_existing_count: 6
    });

    const items = await store.listChecklistItems({});
    const allItems = await store.listChecklistItems({ includeArchived: true });
    const completed = allItems.find((item) => item.id === "aap_prenatal_late_v1:1.0.0:choose_pediatric_provider");
    const skippedHidden = allItems.find((item) => item.id === "aap_prenatal_late_v1:1.0.0:prepare_birth_contacts");

    expect(items.filter((item) => item.template_code === "aap_prenatal_late_v1")).toHaveLength(5);
    expect(allItems.filter((item) => item.template_code === "aap_prenatal_late_v1")).toHaveLength(6);
    expect(completed).toMatchObject({
      status: "done",
      note: "保留用户备注",
      completed_at: "2026-04-24T00:10:00Z"
    });
    expect(skippedHidden).toMatchObject({
      status: "skipped",
      note: "暂不需要",
      skipped_at: "2026-04-24T00:11:00Z",
      archived_at: "2026-04-24T00:11:00Z"
    });
  });

  test("template import idempotency includes template_version", async () => {
    const store = createMemoryStore();
    const checklists = new ChecklistService(store);
    await store.insertChecklistItem({
      id: "aap_prenatal_late_v1:0.9.0:choose_pediatric_provider",
      title: "旧版本任务",
      description: null,
      item_type: "admin",
      phase: "prenatal",
      source_basis: "aap_book",
      template_code: "aap_prenatal_late_v1",
      template_item_key: "choose_pediatric_provider",
      template_version: "0.9.0",
      due_date: null,
      due_rule_json: { trigger: "before_birth" },
      details_json: { activation: "core_auto", category: "visit_prep" },
      status: "done",
      priority: "high",
      note: "旧版本已完成",
      completed_at: "2026-04-23T00:00:00Z",
      skipped_at: null,
      archived_at: null,
      sort_order: 1,
      created_at: "2026-04-23T00:00:00Z",
      updated_at: "2026-04-23T00:00:00Z"
    });

    const result = await checklists.importTemplate({ template_code: "aap_prenatal_late_v1" }, "2026-04-24T00:00:00Z");
    const allItems = await store.listChecklistItems({ includeArchived: true });

    expect(result.created_count).toBe(6);
    expect(result.skipped_existing_count).toBe(0);
    expect(allItems.filter((item) => item.template_code === "aap_prenatal_late_v1" && item.template_item_key === "choose_pediatric_provider")).toHaveLength(2);
    expect(allItems.find((item) => item.id === "aap_prenatal_late_v1:0.9.0:choose_pediatric_provider")).toMatchObject({
      status: "done",
      note: "旧版本已完成"
    });
  });

  test("manual optional vaccine placeholders are listed but not created as active items by default", async () => {
    const store = createMemoryStore();
    const checklists = new ChecklistService(store);
    const library = await checklists.listTemplates("2026-04-24T00:00:00Z");

    expect(library.flatMap((template) => template.items).find((item) => item.key === "vaccination_record_shell")).toMatchObject({
      activation: "manual_optional",
      item_type: "vaccine"
    });

    await checklists.importTemplate({ template_code: "aap_prenatal_late_v1" }, "2026-04-24T00:01:00Z");
    await checklists.importTemplate({ template_code: "aap_infant_1_3m_v1" }, "2026-04-24T00:02:00Z");
    await checklists.importTemplate({ template_code: "aap_toddler_24_30m_v1" }, "2026-04-24T00:03:00Z");
    const result = await checklists.importTemplate({ template_code: "aap_school_entry_6y_bridge_v1" }, "2026-04-24T00:04:00Z");
    const items = await store.listChecklistItems({});

    expect(result.created_count).toBe(2);
    expect(items.map((item) => item.template_item_key)).not.toContain("vaccination_record_shell");
    expect(items.map((item) => item.template_item_key)).not.toContain("vaccine_record_2m");
    expect(items.map((item) => item.template_item_key)).not.toContain("toilet_training_if_ready");
    expect(items.map((item) => item.template_item_key)).not.toContain("six_year_vaccine_verify_only");
  });

  test("manual optional template items can be manually enabled one item at a time", async () => {
    const store = createMemoryStore();
    const checklists = new ChecklistService(store);

    await expect(
      checklists.importTemplate({ template_code: "aap_prenatal_late_v1", template_item_key: "vaccination_record_shell" }, "2026-04-24T00:00:00Z")
    ).rejects.toBeInstanceOf(ValidationError);

    const first = await checklists.importTemplate(
      { template_code: "aap_prenatal_late_v1", template_item_key: "vaccination_record_shell", confirmed: true },
      "2026-04-24T00:01:00Z"
    );
    const second = await checklists.importTemplate(
      { template_code: "aap_prenatal_late_v1", template_item_key: "vaccination_record_shell", confirmed: true },
      "2026-04-24T00:02:00Z"
    );
    const items = await store.listChecklistItems({ includeArchived: true });

    expect(first).toMatchObject({ item_count: 1, created_count: 1, skipped_existing_count: 0 });
    expect(second).toMatchObject({ item_count: 1, created_count: 0, skipped_existing_count: 1 });
    expect(items.filter((item) => item.template_item_key === "vaccination_record_shell")).toHaveLength(1);
    expect(items.find((item) => item.template_item_key === "vaccination_record_shell")).toMatchObject({
      item_type: "vaccine",
      details_json: expect.objectContaining({ activation: "manual_optional" })
    });
  });

  test("manually enabled optional items are visible in checklist sections", async () => {
    const store = createMemoryStore({
      profile: {
        child_birth_date: null,
        due_date: "2026-05-20",
        phase: "pregnancy_prebirth",
        timezone: "Asia/Shanghai"
      }
    });
    const checklists = new ChecklistService(store);

    await checklists.importTemplate(
      { template_code: "aap_prenatal_late_v1", template_item_key: "vaccination_record_shell", confirmed: true },
      "2026-04-24T00:01:00Z"
    );
    const sections = await checklists.listSections("2026-04-24T02:10:00Z");

    expect(sections.current.map((item) => item.template_item_key)).toContain("vaccination_record_shell");
    expect(sections.upcoming.map((item) => item.template_item_key)).not.toContain("vaccination_record_shell");
  });

  test("future manually enabled optional items are visible as upcoming", async () => {
    const store = createMemoryStore({
      profile: {
        child_birth_date: "2026-04-21",
        due_date: null,
        phase: "newborn_or_baby",
        timezone: "Asia/Shanghai"
      }
    });
    const checklists = new ChecklistService(store);

    await checklists.importTemplate(
      { template_code: "aap_infant_1_3m_v1", template_item_key: "vaccine_record_2m", confirmed: true },
      "2026-04-24T00:01:00Z"
    );
    const sections = await checklists.listSections("2026-04-24T02:10:00Z");

    expect(sections.current.map((item) => item.template_item_key)).not.toContain("vaccine_record_2m");
    expect(sections.upcoming.map((item) => item.template_item_key)).toContain("vaccine_record_2m");
  });

  test("cross-cutting template is reference-only and cannot be imported as active tasks", async () => {
    const checklists = new ChecklistService(createMemoryStore());

    await expect(checklists.importTemplate({ template_code: "aap_cross_cutting_v1" }, "2026-04-24T00:00:00Z")).rejects.toBeInstanceOf(ValidationError);
  });

  test("unknown template import is rejected", async () => {
    const checklists = new ChecklistService(createMemoryStore());

    await expect(checklists.importTemplate({ template_code: "not_real" }, "2026-04-24T00:00:00Z")).rejects.toBeInstanceOf(ValidationError);
  });

  test("sections group current, upcoming, completed, and skipped hidden items", async () => {
    const store = createMemoryStore();
    const checklists = new ChecklistService(store);
    const current = await checklists.createCustom({ title: "今天处理", item_type: "custom", phase: "prenatal", due_date: "2026-04-24" }, "2026-04-24T00:00:00Z");
    const upcoming = await checklists.createCustom({ title: "下周处理", item_type: "custom", phase: "prenatal", due_date: "2026-05-01" }, "2026-04-24T00:00:00Z");
    const completed = await checklists.createCustom({ title: "已完成", item_type: "custom", phase: "prenatal" }, "2026-04-24T00:00:00Z");
    const skipped = await checklists.createCustom({ title: "已跳过", item_type: "custom", phase: "prenatal" }, "2026-04-24T00:00:00Z");

    await checklists.update(completed.id, { status: "done" }, "2026-04-24T00:10:00Z");
    await checklists.update(skipped.id, { status: "skipped", archived: true }, "2026-04-24T00:11:00Z");

    const sections = await checklists.listSections("2026-04-24T02:00:00Z");

    expect(sections.current.map((item) => item.id)).toEqual([current.id]);
    expect(sections.upcoming.map((item) => item.id)).toEqual([upcoming.id]);
    expect(sections.completed.map((item) => item.id)).toEqual([completed.id]);
    expect(sections.skipped_hidden.map((item) => item.id)).toEqual([skipped.id]);
    expect(sections.summary).toMatchObject({
      current_count: 1,
      upcoming_count: 1,
      completed_count: 1,
      skipped_hidden_count: 1
    });
  });

  test("prenatal checklist phase keeps prenatal core and recommended template items current", async () => {
    const store = createMemoryStore({
      profile: {
        child_birth_date: null,
        due_date: "2026-05-20",
        phase: "pregnancy_prebirth",
        timezone: "Asia/Shanghai"
      }
    });
    const checklists = new ChecklistService(store);

    await checklists.importTemplate({ template_code: "aap_prenatal_late_v1" }, "2026-04-24T02:00:00Z");
    const sections = await checklists.listSections("2026-04-24T02:10:00Z");
    const currentKeys = sections.current.map((item) => item.template_item_key);

    expect(currentKeys).toEqual(expect.arrayContaining(["choose_pediatric_provider", "prepare_feeding_support"]));
    expect(currentKeys).not.toContain("vaccination_record_shell");
    expect(sections.current.find((item) => item.template_item_key === "choose_pediatric_provider")).toMatchObject({
      details_json: expect.objectContaining({ activation: "core_auto", category: "visit_prep" })
    });
  });

  test("prenatal checklist phase keeps future child phases out of current", async () => {
    const store = createMemoryStore({
      profile: {
        child_birth_date: null,
        due_date: "2026-05-20",
        phase: "pregnancy_prebirth",
        timezone: "Asia/Shanghai"
      }
    });
    const checklists = new ChecklistService(store);

    await checklists.importTemplate({ template_code: "aap_first_week_v1" }, "2026-04-24T02:00:00Z");
    await checklists.importTemplate({ template_code: "aap_first_month_v1" }, "2026-04-24T02:01:00Z");
    await checklists.importTemplate({ template_code: "aap_toddler_3y_v1" }, "2026-04-24T02:02:00Z");
    const sections = await checklists.listSections("2026-04-24T02:10:00Z");
    const currentKeys = sections.current.map((item) => item.template_item_key);
    const upcomingKeys = sections.upcoming.map((item) => item.template_item_key);
    const materializedKeys = (await store.listChecklistItems({ includeArchived: true })).map((item) => item.template_item_key);

    expect(materializedKeys).not.toContain("well_visit_4_years");
    expect(materializedKeys).not.toContain("well_visit_5_years");
    expect(materializedKeys).not.toContain("well_visit_6_years");
    expect(currentKeys).not.toContain("well_visit_3_5_days");
    expect(currentKeys).not.toContain("well_visit_1_month");
    expect(currentKeys).not.toContain("well_visit_3_years");
    expect(upcomingKeys).toEqual(expect.arrayContaining(["well_visit_3_5_days", "well_visit_1_month", "well_visit_3_years"]));
  });

  test("first week checklist phase shows 3-5 day follow-up as current and later phases as upcoming", async () => {
    const store = createMemoryStore({
      profile: {
        child_birth_date: "2026-04-21",
        due_date: null,
        phase: "newborn_or_baby",
        timezone: "Asia/Shanghai"
      }
    });
    const checklists = new ChecklistService(store);

    await checklists.importTemplate({ template_code: "aap_first_week_v1" }, "2026-04-24T02:00:00Z");
    await checklists.importTemplate({ template_code: "aap_first_month_v1" }, "2026-04-24T02:01:00Z");
    const sections = await checklists.listSections("2026-04-24T02:10:00Z");
    const currentKeys = sections.current.map((item) => item.template_item_key);
    const upcomingKeys = sections.upcoming.map((item) => item.template_item_key);

    expect(currentKeys).toContain("well_visit_3_5_days");
    expect(currentKeys).not.toContain("well_visit_1_month");
    expect(sections.current.find((item) => item.template_item_key === "well_visit_3_5_days")).toMatchObject({
      due_date: "2026-04-24"
    });
    expect(sections.upcoming.find((item) => item.template_item_key === "well_visit_1_month")).toMatchObject({
      due_date: "2026-05-21"
    });
    expect(upcomingKeys).toEqual(expect.arrayContaining(["well_visit_1_month"]));
  });

  test("six-year bridge phase stays distinct from preschool 4-5 years", async () => {
    const store = createMemoryStore({
      profile: {
        child_birth_date: "2021-04-24",
        due_date: null,
        phase: "newborn_or_baby",
        timezone: "Asia/Shanghai"
      }
    });
    const checklists = new ChecklistService(store);

    await checklists.importTemplate({ template_code: "aap_preschool_4_5y_v1" }, "2026-04-24T02:00:00Z");
    await checklists.importTemplate({ template_code: "aap_school_entry_6y_bridge_v1" }, "2026-04-24T02:01:00Z");
    const sections = await checklists.listSections("2026-04-24T02:10:00Z");
    const currentKeys = sections.current.map((item) => item.template_item_key);
    const upcomingKeys = sections.upcoming.map((item) => item.template_item_key);

    expect(currentKeys).toContain("well_visit_5_years");
    expect(currentKeys).not.toContain("well_visit_6_years");
    expect(upcomingKeys).toContain("well_visit_6_years");
  });

  test("reference items are imported but shown outside current and upcoming tasks", async () => {
    const store = createMemoryStore({
      profile: {
        child_birth_date: "2026-04-21",
        due_date: null,
        phase: "newborn_or_baby",
        timezone: "Asia/Shanghai"
      }
    });
    const checklists = new ChecklistService(store);

    await checklists.importTemplate({ template_code: "aap_first_week_v1" }, "2026-04-24T02:00:00Z");
    const sections = await checklists.listSections("2026-04-24T02:10:00Z");

    expect(sections.current.map((item) => item.template_item_key)).not.toContain("safe_sleep_reference");
    expect(sections.upcoming.map((item) => item.template_item_key)).not.toContain("safe_sleep_reference");
    expect(sections.reference.map((item) => item.template_item_key)).toContain("safe_sleep_reference");
    expect(sections.summary.reference_count).toBe(sections.reference.length);
  });

  test("checklist and milestone date validation rejects impossible dates", async () => {
    const store = createMemoryStore();
    const checklists = new ChecklistService(store);
    const milestones = new MilestoneService(store);

    await expect(checklists.createCustom({ title: "日期有效", item_type: "custom", phase: "prenatal", due_date: "2024-02-29" }, "2026-04-24T00:00:00Z")).resolves.toMatchObject({
      due_date: "2024-02-29"
    });
    await expect(checklists.createCustom({ title: "日期无效", item_type: "custom", phase: "prenatal", due_date: "2026-02-31" }, "2026-04-24T00:00:00Z")).rejects.toBeInstanceOf(ValidationError);
    await expect(
      milestones.create({ title: "无效里程碑日期", milestone_type: "custom", observed_on: "2026-02-29" }, "2026-04-24T00:00:00Z")
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("checklist patch updates status, notes, skipped_at, completed_at, and archived_at", async () => {
    const store = createMemoryStore();
    const checklists = new ChecklistService(store);
    const item = await checklists.createCustom({ title: "可更新任务", item_type: "custom", phase: "prenatal" }, "2026-04-24T00:00:00Z");

    const done = await checklists.update(item.id, { status: "done", note: "完成了" }, "2026-04-24T00:01:00Z");
    const skipped = await checklists.update(item.id, { status: "skipped", archived: true }, "2026-04-24T00:02:00Z");

    expect(done).toMatchObject({
      status: "done",
      note: "完成了",
      completed_at: "2026-04-24T00:01:00Z",
      skipped_at: null
    });
    expect(skipped).toMatchObject({
      status: "skipped",
      completed_at: null,
      skipped_at: "2026-04-24T00:02:00Z",
      archived_at: "2026-04-24T00:02:00Z"
    });
  });

  test("machine payload requires token and limits recent events", async () => {
    const store = createMemoryStore({
      profile: {
        machine_token: "machine-secret"
      }
    });
    const events = new EventService(store);
    const checklists = new ChecklistService(store);

    for (let index = 0; index < 35; index += 1) {
      await events.create(
        {
          event_type: "diaper_pee",
          occurred_at: `2026-04-24T00:${String(index).padStart(2, "0")}:00Z`
        },
        "dad",
        "2026-04-24T01:00:00Z"
      );
    }
    await checklists.createCustom({ title: "当前 prenatal 清单", item_type: "custom", phase: "prenatal" }, "2026-04-24T01:10:00Z");
    await checklists.importTemplate({ template_code: "aap_prenatal_late_v1" }, "2026-04-24T01:20:00Z");

    await expect(buildMachinePayload(store, "wrong-token", "2026-04-24T02:00:00Z")).rejects.toThrow(/token/);

    const payload = await buildMachinePayload(store, "machine-secret", "2026-04-24T02:00:00Z");

    expect(payload.schema_version).toBe("1");
    expect(payload.machine_payload_version).toBe("chatgpt_automation_1");
    expect(payload.timezone).toBe("Asia/Shanghai");
    expect(payload.capabilities).toMatchObject({
      has_days_endpoint: true,
      has_events_endpoint: true,
      max_days_range: 60,
      default_days_range: 7,
      max_events_limit: 1000,
      default_events_limit: 300,
      supports_event_type_filter: true,
      supports_cursor_pagination: false
    });
    expect(payload.links.current).toBe("/machine/v1/machine-secret/current.json");
    expect(payload.links.days_7d).toContain("/machine/v1/machine-secret/days.json?from=");
    expect(payload.links.events_24h).toContain("/machine/v1/machine-secret/events.json?since=");
    expect(payload.data_range).toMatchObject({
      first_event_at: "2026-04-24T00:00:00Z",
      latest_event_at: "2026-04-24T00:34:00Z",
      event_count: 35,
      available_from_local_date: "2026-04-24",
      available_to_local_date: "2026-04-24"
    });
    expect(payload.event_window_meta).toMatchObject({
      recent_events_limit: 30,
      oldest_recent_event_at: "2026-04-24T00:05:00Z",
      newest_recent_event_at: "2026-04-24T00:34:00Z",
      has_more_recent_events: true
    });
    expect(payload.recent_events).toHaveLength(30);
    expect(payload.open_checklists.map((item) => item.title)).toContain("当前 prenatal 清单");
    expect(payload.open_checklists.map((item) => item.template_item_key)).not.toContain("well_visit_3_years");
    expect(JSON.stringify(payload)).not.toMatch(/password|cookie|yb_admin_session|yb_read_session/i);
  });

  test("machine current data range reports empty active event coverage", async () => {
    const store = createMemoryStore({
      profile: {
        machine_token: "machine-secret"
      }
    });

    const payload = await buildMachinePayload(store, "machine-secret", "2026-04-24T02:00:00Z");

    expect(payload.data_range).toEqual({
      first_event_at: null,
      latest_event_at: null,
      event_count: 0,
      available_from_local_date: null,
      available_to_local_date: null
    });
  });

  test("stable child facts can be saved, cleared, and exposed to machine current", async () => {
    const store = createMemoryStore({
      profile: {
        child_name: "Demo Baby",
        child_birth_date: "2026-01-10",
        machine_token: "machine-secret"
      }
    });

    await updateStableChildFacts(
      store,
      {
        sex: "female",
        birth_datetime: "2026-01-10T10:42:00Z",
        birth_weight_g: 3200,
        birth_length_cm: 50,
        birth_head_circumference_cm: null,
        gestational_age_label: "39+0",
        delivery_mode: "vaginal",
        apgar: "10/10/10",
        current_feeding_mode: "mixed_feeding"
      },
      "2026-01-21T01:00:00Z"
    );

    const saved = await getStableChildFacts(store);
    expect(saved).toMatchObject({
      nickname: "Demo Baby",
      birth_date: "2026-01-10",
      sex: "female",
      birth_datetime: "2026-01-10T10:42:00Z",
      birth_weight_g: 3200,
      birth_length_cm: 50,
      gestational_age_label: "39+0",
      delivery_mode: "vaginal",
      apgar: "10/10/10",
      current_feeding_mode: "mixed_feeding"
    });

    const machine = await buildMachinePayload(store, "machine-secret", "2026-01-21T02:00:00Z");
    expect(machine.stable_child_facts).toMatchObject(saved);

    await updateStableChildFacts(store, { sex: "", birth_weight_g: "" }, "2026-01-21T01:10:00Z");
    expect(await getStableChildFacts(store)).toMatchObject({
      nickname: "Demo Baby",
      birth_date: "2026-01-10",
      sex: null,
      birth_weight_g: null
    });
  });

  test("stable child facts reject invalid saved values", async () => {
    const store = createMemoryStore();

    await expect(updateStableChildFacts(store, { sex: "other" }, "2026-05-18T01:00:00Z")).rejects.toThrow(/sex/);
    await expect(updateStableChildFacts(store, { birth_datetime: "not-a-date" }, "2026-05-18T01:00:00Z")).rejects.toThrow(/birth_datetime/);
    await expect(updateStableChildFacts(store, { birth_weight_g: 50000 }, "2026-05-18T01:00:00Z")).rejects.toThrow(/birth_weight_g/);
  });

  test("machine days payload uses local date ranges and exposes series", async () => {
    const store = createMemoryStore({
      profile: {
        machine_token: "machine-secret",
        child_birth_date: "2026-04-23",
        phase: "newborn_or_baby",
        timezone: "Asia/Shanghai"
      }
    });
    const events = new EventService(store);

    await events.create({ event_type: "feed_bottle", occurred_at: "2026-04-23T16:30:00Z", amount_value: 40, amount_unit: "ml" }, "dad", "2026-04-24T02:00:00Z");
    await events.create({ event_type: "diaper_pee", occurred_at: "2026-04-24T01:00:00Z" }, "mom", "2026-04-24T02:00:00Z");

    const payload = await buildMachineDaysPayload(store, "machine-secret", "2026-04-24T02:00:00Z", { from: "2026-04-24", to: "2026-04-25" });

    expect(payload.range).toEqual({ from: "2026-04-24", to: "2026-04-25", day_count: 2 });
    expect(payload.days.map((day) => day.local_date)).toEqual(["2026-04-24", "2026-04-25"]);
    expect(payload.days[0].age_days).toBe(1);
    expect(payload.days[0].feeding.bottle_ml_total).toBe(40);
    expect(payload.days[0].diaper.pee_count).toBe(1);
    expect(payload.series.local_dates).toEqual(["2026-04-24", "2026-04-25"]);
    expect(payload.series.bottle_ml_total).toEqual([40, 0]);
    await expect(buildMachineDaysPayload(store, "machine-secret", "2026-04-24T02:00:00Z", { from: "2026-01-01", to: "2026-03-15" })).rejects.toThrow(
      /60 days/
    );
  });

  test("machine events payload filters, trims, and paginates active events", async () => {
    const store = createMemoryStore({
      profile: {
        machine_token: "machine-secret"
      }
    });
    const events = new EventService(store);

    await events.create(
      {
        event_type: "note",
        occurred_at: "2026-04-24T00:10:00Z",
        note: "x".repeat(180),
        details_json: { short: "ok", long: "y".repeat(180) }
      },
      "dad",
      "2026-04-24T02:00:00Z"
    );
    const pee = await events.create({ event_type: "diaper_pee", occurred_at: "2026-04-24T00:20:00Z" }, "mom", "2026-04-24T02:00:00Z");
    await events.delete(pee.id, "2026-04-24T02:30:00Z");
    await events.create({ event_type: "feed_bottle", occurred_at: "2026-04-24T00:30:00Z", amount_value: 50, amount_unit: "ml" }, "dad", "2026-04-24T02:00:00Z");

    const payload = await buildMachineEventsPayload(store, "machine-secret", "2026-04-24T02:00:00Z", {
      since: "2026-04-24T00:00:00Z",
      until: "2026-04-24T01:00:00Z",
      limit: 1
    });

    expect(payload.events.map((event) => event.event_type)).toEqual(["feed_bottle"]);
    expect(payload.pagination).toEqual({ has_more: true, next_cursor: null });

    const notes = await buildMachineEventsPayload(store, "machine-secret", "2026-04-24T02:00:00Z", {
      since: "2026-04-24T00:00:00Z",
      until: "2026-04-24T01:00:00Z",
      event_type: "note"
    });
    expect(notes.events[0].note).toHaveLength(160);
    expect(notes.events[0].details_json).toEqual({ short: "ok" });
  });

  test("machine endpoint handles HEAD without falling through to the app shell", async () => {
    const store = createMemoryStore({
      profile: {
        machine_token: "machine-secret"
      }
    });

    const response = await createMachineEndpointResponse(store, "current", "machine-secret", new URLSearchParams(), "HEAD", "2026-04-24T02:00:00Z");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(await response.text()).toBe("");
  });

  test("machine GET endpoints return pretty JSON bodies with manifest fields and machine headers", async () => {
    const store = createMemoryStore({
      profile: {
        machine_token: "machine-secret"
      }
    });

    const currentResponse = await createMachineEndpointResponse(store, "current", "machine-secret", new URLSearchParams(), "GET", "2026-04-24T02:00:00Z");
    const daysResponse = await createMachineEndpointResponse(
      store,
      "days",
      "machine-secret",
      new URLSearchParams("from=2026-04-18&to=2026-04-24"),
      "GET",
      "2026-04-24T02:00:00Z"
    );
    const eventsResponse = await createMachineEndpointResponse(
      store,
      "events",
      "machine-secret",
      new URLSearchParams("since=2026-04-23T02%3A00%3A00Z&until=2026-04-24T02%3A00%3A00Z"),
      "GET",
      "2026-04-24T02:00:00Z"
    );

    const currentBody = await expectPrettyMachineJson(currentResponse);
    expect(currentBody).toMatchObject({
      machine_payload_version: "chatgpt_automation_1",
      data_range: expect.any(Object),
      capabilities: expect.any(Object),
      links: expect.any(Object)
    });
    expect((currentBody.links as Json).current).toBe("/machine/v1/machine-secret/current.json");

    await expectPrettyMachineJson(daysResponse);
    await expectPrettyMachineJson(eventsResponse);
  });

  test("machine current text endpoint returns parseable pretty JSON as text/plain", async () => {
    const store = createMemoryStore({
      profile: {
        machine_token: "machine-secret"
      }
    });

    const getResponse = await createMachineEndpointResponse(store, "current-text", "machine-secret", new URLSearchParams(), "GET", "2026-04-24T02:00:00Z");
    const body = await expectPrettyMachineText(getResponse);

    expect(body).toMatchObject({
      machine_payload_version: "chatgpt_automation_1",
      data_range: expect.any(Object),
      capabilities: expect.any(Object),
      links: expect.any(Object)
    });

    const headResponse = await createMachineEndpointResponse(store, "current-text", "machine-secret", new URLSearchParams(), "HEAD", "2026-04-24T02:00:00Z");
    expect(headResponse.status).toBe(200);
    expect(headResponse.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(headResponse.headers.get("cache-control")).toBe("no-store");
    expect(headResponse.headers.get("x-robots-tag")).toBe("noindex");
    expect(await headResponse.text()).toBe("");
  });

  test("machine current html endpoint returns readable summary and complete payload HTML", async () => {
    const store = createMemoryStore({
      profile: {
        machine_token: "machine-secret",
        child_name: "Baby",
        child_birth_date: "2026-04-23",
        timezone: "Asia/Shanghai"
      }
    });
    const events = new EventService(store);
    await events.create({ event_type: "feed_bottle", occurred_at: "2026-04-24T00:10:00Z", amount_value: 50, amount_unit: "ml" }, "dad", "2026-04-24T02:00:00Z");
    await events.create({ event_type: "diaper_pee", occurred_at: "2026-04-24T00:20:00Z" }, "mom", "2026-04-24T02:00:00Z");
    await events.create({ event_type: "note", occurred_at: "2026-04-24T00:30:00Z", note: "<script>unsafe</script>" }, "dad", "2026-04-24T02:00:00Z");

    const response = await createMachineEndpointResponse(store, "current-html", "machine-secret", new URLSearchParams(), "GET", "2026-04-24T02:00:00Z");
    const body = await response.text();
    const jsonPayload = JSON.stringify(await buildMachinePayload(store, "machine-secret", "2026-04-24T02:00:00Z"), null, 2);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(body).toContain("<!doctype html>");
    expect(body).toContain("<h1>baby-log-current: ok</h1>");
    expect(body).toContain("<dt>machine_payload_version</dt>");
    expect(body).toContain("<dd>chatgpt_automation_1</dd>");
    expect(body).toContain("<dt>latest_event_at</dt>");
    expect(body).toContain("days_7d");
    expect(body).toContain("events_24h");
    expect(body).toContain("bottle_ml_total");
    expect(body).toContain('<pre id="current-payload-json">');
    expect(body).toContain("&quot;recent_events_preview&quot;");
    expect(body).toContain("&quot;recent_events&quot;");
    expect(body).toContain("&quot;open_checklists&quot;");
    expect(body).toContain("&quot;machine_payload_version&quot;: &quot;chatgpt_automation_1&quot;");
    expect(body).toContain("&lt;script&gt;unsafe&lt;/script&gt;");
    expect(body.length).toBeGreaterThan(jsonPayload.length);
    expect(body.split("\n").length).toBeGreaterThan(20);
    expect(Math.max(...body.split("\n").map((line) => line.length))).toBeLessThan(320);

    const headResponse = await createMachineEndpointResponse(store, "current-html", "machine-secret", new URLSearchParams(), "HEAD", "2026-04-24T02:00:00Z");
    expect(headResponse.status).toBe(200);
    expect(headResponse.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(headResponse.headers.get("cache-control")).toBe("no-store");
    expect(headResponse.headers.get("x-robots-tag")).toBe("noindex");
    expect(await headResponse.text()).toBe("");
  });

  test("machine days and events html endpoints return complete payload HTML", async () => {
    const store = createMemoryStore({
      profile: {
        machine_token: "machine-secret",
        child_name: "Baby",
        child_birth_date: "2026-04-23",
        timezone: "Asia/Shanghai"
      }
    });
    const events = new EventService(store);
    await events.create({ event_type: "feed_bottle", occurred_at: "2026-04-24T00:10:00Z", amount_value: 50, amount_unit: "ml" }, "dad", "2026-04-24T02:00:00Z");
    await events.create({ event_type: "note", occurred_at: "2026-04-24T00:30:00Z", note: "<script>unsafe</script>" }, "dad", "2026-04-24T02:00:00Z");

    const daysResponse = await createMachineEndpointResponse(
      store,
      "days-html",
      "machine-secret",
      new URLSearchParams("from=2026-04-24&to=2026-04-24"),
      "GET",
      "2026-04-24T02:00:00Z"
    );
    const eventsResponse = await createMachineEndpointResponse(
      store,
      "events-html",
      "machine-secret",
      new URLSearchParams("since=2026-04-24T00%3A00%3A00Z&until=2026-04-24T01%3A00%3A00Z&event_type=note"),
      "GET",
      "2026-04-24T02:00:00Z"
    );

    const daysBody = await expectMachineHtml(daysResponse, "days-payload-json");
    expect(daysBody).toContain("<h1>baby-log-days: ok</h1>");
    expect(daysBody).toContain("<dt>from</dt>");
    expect(daysBody).toContain("<dd>2026-04-24</dd>");
    expect(daysBody).toContain("&quot;series&quot;");
    expect(daysBody).toContain("&quot;bottle_ml_total&quot;");

    const eventsBody = await expectMachineHtml(eventsResponse, "events-payload-json");
    expect(eventsBody).toContain("<h1>baby-log-events: ok</h1>");
    expect(eventsBody).toContain("<dt>event_type</dt>");
    expect(eventsBody).toContain("<dd>note</dd>");
    expect(eventsBody).toContain("&quot;pagination&quot;");
    expect(eventsBody).toContain("&lt;script&gt;unsafe&lt;/script&gt;");

    const daysHeadResponse = await createMachineEndpointResponse(
      store,
      "days-html",
      "machine-secret",
      new URLSearchParams("from=2026-04-24&to=2026-04-24"),
      "HEAD",
      "2026-04-24T02:00:00Z"
    );
    const eventsHeadResponse = await createMachineEndpointResponse(
      store,
      "events-html",
      "machine-secret",
      new URLSearchParams("since=2026-04-24T00%3A00%3A00Z&until=2026-04-24T01%3A00%3A00Z"),
      "HEAD",
      "2026-04-24T02:00:00Z"
    );
    for (const response of [daysHeadResponse, eventsHeadResponse]) {
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-robots-tag")).toBe("noindex");
      expect(await response.text()).toBe("");
    }
  });

  test("machine test endpoint returns simple text lines", async () => {
    const store = createMemoryStore({
      profile: {
        machine_token: "machine-secret"
      }
    });

    const response = await createMachineEndpointResponse(store, "test", "machine-secret", new URLSearchParams(), "GET", "2026-04-24T02:00:00Z");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(await response.text()).toBe(["baby-log-machine-test: ok", "generated_at: 2026-04-24T02:00:00Z", "endpoint: /machine/v1/{token}/test"].join("\n"));

    const headResponse = await createMachineEndpointResponse(store, "test", "machine-secret", new URLSearchParams(), "HEAD", "2026-04-24T02:00:00Z");
    expect(headResponse.status).toBe(200);
    expect(headResponse.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await headResponse.text()).toBe("");

    await expect(createMachineEndpointResponse(store, "test", "wrong-token", new URLSearchParams(), "GET", "2026-04-24T02:00:00Z")).rejects.toMatchObject({
      status: 401
    });
  });

  test("machine days and events endpoints handle HEAD with machine headers", async () => {
    const store = createMemoryStore({
      profile: {
        machine_token: "machine-secret"
      }
    });

    const daysResponse = await createMachineEndpointResponse(
      store,
      "days",
      "machine-secret",
      new URLSearchParams("from=2026-04-18&to=2026-04-24"),
      "HEAD",
      "2026-04-24T02:00:00Z"
    );
    const eventsResponse = await createMachineEndpointResponse(
      store,
      "events",
      "machine-secret",
      new URLSearchParams("since=2026-04-23T02%3A00%3A00Z&until=2026-04-24T02%3A00%3A00Z"),
      "HEAD",
      "2026-04-24T02:00:00Z"
    );

    for (const response of [daysResponse, eventsResponse]) {
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-robots-tag")).toBe("noindex");
      expect(await response.text()).toBe("");
    }
  });

  test("legacy machine path is a JSON 404", async () => {
    const store = createMemoryStore({
      profile: {
        machine_token: "machine-secret"
      }
    });

    const response = await createMachineEndpointResponse(store, "legacy", "machine-secret", new URLSearchParams(), "GET", "2026-04-24T02:00:00Z");

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    await expect(response.json()).resolves.toEqual({ error: "Machine current endpoint moved to /machine/v1/{token}/current.json" });
  });

  test("machine endpoint preserves internal errors as 500", async () => {
    const store = createMemoryStore({
      profile: {
        machine_token: "machine-secret"
      }
    });
    const brokenStore = {
      ...store,
      listEvents: async () => {
        throw new Error("database unavailable");
      }
    };

    await expect(createMachineEndpointResponse(brokenStore, "current", "machine-secret", new URLSearchParams(), "GET", "2026-04-24T02:00:00Z")).rejects.toMatchObject({
      status: 500
    });
  });

  test("full export is a zip with required JSON and CSV files", async () => {
    const store = createMemoryStore();
    const events = new EventService(store);
    const checklists = new ChecklistService(store);
    await events.create({ event_type: "diaper_pee", occurred_at: "2026-04-24T00:00:00Z" }, "dad", "2026-04-24T00:00:00Z");
    await checklists.createCustom({ title: "导出任务", item_type: "custom", phase: "prenatal", source_basis: "custom" }, "2026-04-24T00:00:00Z");

    const zip = await createFullExportZip(store, "2026-04-24T01:00:00Z");
    const binaryText = new TextDecoder("latin1").decode(zip);
    const exportedChecklistItems = JSON.parse(extractZipText(zip, "checklist_items.json"));

    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(binaryText).toContain("profile.json");
    expect(binaryText).toContain("events.json");
    expect(binaryText).toContain("events.csv");
    expect(binaryText).toContain("checklist_items.json");
    expect(binaryText).toContain("checklist_items.csv");
    expect(binaryText).toContain("milestones.json");
    expect(binaryText).toContain("milestones.csv");
    expect(binaryText).toContain("schema_version.json");
    expect(exportedChecklistItems[0]).toMatchObject({
      title: "导出任务",
      phase: "prenatal",
      source_basis: "custom",
      template_item_key: null,
      template_version: null,
      skipped_at: null
    });
    expect(exportedChecklistItems[0]).not.toHaveProperty("window_end_date");
  });

  test("full export does not truncate large event or milestone sets", async () => {
    const store = createMemoryStore();
    const events = new EventService(store);

    for (let index = 0; index < 250; index += 1) {
      const event = await events.create(
        {
          event_type: "diaper_pee",
          occurred_at: `2026-04-24T${String(Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}:00Z`
        },
        "dad",
        "2026-04-24T00:00:00Z"
      );
      if (index < 5) await events.delete(event.id, "2026-04-24T01:00:00Z");
    }

    const milestones = new MilestoneService(store);
    for (let index = 0; index < 250; index += 1) {
      await milestones.create(
        {
          title: `Milestone ${index}`,
          milestone_type: "custom",
          observed_on: "2026-04-24"
        },
        "2026-04-24T00:00:00Z"
      );
    }

    const zip = await createFullExportZip(store, "2026-04-24T01:00:00Z");
    const exportedEvents = JSON.parse(extractZipText(zip, "events.json"));
    const exportedMilestones = JSON.parse(extractZipText(zip, "milestones.json"));

    expect(exportedEvents).toHaveLength(250);
    expect(exportedEvents.filter((event: Json) => event.deleted_at)).toHaveLength(5);
    expect(exportedMilestones).toHaveLength(250);
  });
});

type Json = Record<string, unknown>;

async function expectPrettyMachineJson(response: Response): Promise<Json> {
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-robots-tag")).toBe("noindex");
  const body = await response.text();
  expect(body.length).toBeGreaterThan(0);
  expect(body).toContain("\n");
  return JSON.parse(body) as Json;
}

async function expectPrettyMachineText(response: Response): Promise<Json> {
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-robots-tag")).toBe("noindex");
  const body = await response.text();
  expect(body.length).toBeGreaterThan(0);
  expect(body).toContain("\n");
  return JSON.parse(body) as Json;
}

async function expectMachineHtml(response: Response, preId: string): Promise<string> {
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-robots-tag")).toBe("noindex");
  const body = await response.text();
  expect(body).toContain("<!doctype html>");
  expect(body).toContain(`<pre id="${preId}">`);
  expect(body).toContain("&quot;machine_payload_version&quot;: &quot;chatgpt_automation_1&quot;");
  expect(body.split("\n").length).toBeGreaterThan(20);
  return body;
}

function extractZipText(zip: Uint8Array, entryName: string): string {
  const decoder = new TextDecoder();
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let offset = 0;
  while (offset < zip.byteLength && view.getUint32(offset, true) === 0x04034b50) {
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = decoder.decode(zip.slice(nameStart, nameStart + fileNameLength));
    const dataStart = nameStart + fileNameLength + extraLength;
    if (name === entryName) {
      return decoder.decode(zip.slice(dataStart, dataStart + compressedSize));
    }
    offset = dataStart + compressedSize;
  }
  throw new Error(`ZIP entry not found: ${entryName}`);
}
