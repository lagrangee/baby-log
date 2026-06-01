import { describe, expect, test } from "vitest";
import { ChecklistService } from "../../src/server/services/checklist-service";
import { createMemoryStore } from "../../src/server/testing/memory-store";

const nowIso = "2026-04-25T02:00:00.000Z";

describe("checklist localization", () => {
  test("returns English checklist templates without changing the Chinese seed source", async () => {
    const store = createMemoryStore();
    const service = new ChecklistService(store);

    const templates = await service.listTemplates(nowIso, "en");
    const firstWeek = templates.find((template) => template.template_code === "aap_first_week_v1");
    const wellVisit = firstWeek?.items.find((item) => item.key === "well_visit_3_5_days");

    expect(firstWeek?.title).toBe("First week after birth");
    expect(wellVisit?.title).toBe("Complete the 3-5 day pediatric/well-child visit");
    expect(wellVisit?.description).toBe("Bring the discharge summary, birth weight, feeding/diaper log, jaundice notes, and screening results.");

    const templatesZh = await service.listTemplates(nowIso, "zh");
    expect(templatesZh.find((template) => template.template_code === "aap_first_week_v1")?.title).toBe("出生后第 1 周");
  });

  test("localizes imported template-backed checklist items at read time", async () => {
    const store = createMemoryStore({
      profile: {
        child_birth_date: "2026-04-22",
        phase: "newborn_or_baby"
      }
    });
    const service = new ChecklistService(store);

    await service.importTemplate({ template_code: "aap_first_week_v1" }, nowIso);

    const stored = await store.getChecklistItemByTemplateKey("aap_first_week_v1", "1.0.0", "well_visit_3_5_days");
    expect(stored?.title).toBe("完成出生后3–5天儿科/儿保随访");

    const sections = await service.listSections(nowIso, "en");
    const localized = [...sections.current, ...sections.upcoming, ...sections.reference].find((item) => item.template_item_key === "well_visit_3_5_days");

    expect(localized?.title).toBe("Complete the 3-5 day pediatric/well-child visit");
    expect(localized?.description).toBe("Bring the discharge summary, birth weight, feeding/diaper log, jaundice notes, and screening results.");
  });
});
