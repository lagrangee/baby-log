import checklistTemplatesSeed from "../data/checklist-templates.json";
import { ValidationError } from "../../shared/content";
import { normalizeLanguage, type Language } from "../../shared/i18n";
import { localizeChecklistItemRecord, localizeChecklistTemplate, localizeChecklistTemplateItem } from "./checklist-i18n";
import type {
  AppProfile,
  ChecklistActivation,
  ChecklistItemRecord,
  ChecklistItemType,
  ChecklistPhase,
  ChecklistSections,
  ChecklistSourceBasis,
  ChecklistStatus,
  Priority,
  Store
} from "../types";
import { isValidDateOnly, localDateForTimezone } from "../utils/time";

const seed = checklistTemplatesSeed as ChecklistTemplateSeedFile;
const ALLOWED_ITEM_TYPES = new Set<ChecklistItemType>(seed.allowed_item_type as ChecklistItemType[]);
const ALLOWED_PHASES = new Set<ChecklistPhase>(seed.allowed_phase as ChecklistPhase[]);
const ALLOWED_SOURCE_BASIS = new Set<ChecklistSourceBasis>(seed.allowed_source_basis as ChecklistSourceBasis[]);
const ALLOWED_STATUSES = new Set<ChecklistStatus>(["pending", "done", "skipped"]);
const ALLOWED_PRIORITIES = new Set<Priority>(["low", "normal", "high"]);
const ALLOWED_ACTIVATIONS = new Set<ChecklistActivation>(["core_auto", "recommended", "reference", "manual_optional"]);
const CHECKLIST_PHASE_ORDER: ChecklistPhase[] = [
  "prenatal",
  "birth_hospital",
  "first_week",
  "first_month",
  "infant_1_3m",
  "infant_4_7m",
  "infant_8_12m",
  "toddler_12_18m",
  "toddler_18_24m",
  "toddler_24_30m",
  "toddler_3y",
  "preschool_4_5y",
  "early_school_6y"
];
const checklistPhaseRank = new Map<ChecklistPhase, number>(CHECKLIST_PHASE_ORDER.map((phase, index) => [phase, index]));
const STAGED_TEMPLATE_GROUPS = [
  { template_code: "aap_prenatal_late_v1", source_phase: "prenatal_late", phase: "prenatal", title: "孕晚期 / 出生前" },
  { template_code: "aap_birth_hospital_v1", source_phase: "birth_hospital", phase: "birth_hospital", title: "出生当天到住院期" },
  { template_code: "aap_first_week_v1", source_phase: "newborn_first_week", phase: "first_week", title: "出生后第 1 周" },
  { template_code: "aap_first_month_v1", source_phase: "newborn_first_month", phase: "first_month", title: "第 1 个月" },
  { template_code: "aap_infant_1_3m_v1", source_phase: "infant_1_3m", phase: "infant_1_3m", title: "1-3 月龄" },
  { template_code: "aap_infant_4_7m_v1", source_phase: "infant_4_7m", phase: "infant_4_7m", title: "4-7 月龄" },
  { template_code: "aap_infant_8_12m_v1", source_phase: "infant_8_12m", phase: "infant_8_12m", title: "8-12 月龄" },
  { template_code: "aap_toddler_12_18m_v1", source_phase: "toddler_12_18m", phase: "toddler_12_18m", title: "12-18 月龄" },
  { template_code: "aap_toddler_18_24m_v1", source_phase: "toddler_18_24m", phase: "toddler_18_24m", title: "18-24 月龄" },
  { template_code: "aap_toddler_24_30m_v1", source_phase: "toddler_24_30m", phase: "toddler_24_30m", title: "24-30 月龄" },
  { template_code: "aap_toddler_3y_v1", source_phase: "toddler_3y", phase: "toddler_3y", title: "3 岁" },
  { template_code: "aap_preschool_4_5y_v1", source_phase: "preschool_4_5y", phase: "preschool_4_5y", title: "4-5 岁" },
  { template_code: "aap_school_entry_6y_bridge_v1", source_phase: "early_school_6y", phase: "early_school_6y", title: "6 岁入学桥接" },
  { template_code: "aap_cross_cutting_v1", source_phase: "cross_cutting", phase: "prenatal", title: "跨阶段规则" }
] as const satisfies ReadonlyArray<{ template_code: string; source_phase: string; phase: ChecklistPhase; title: string }>;

export interface ChecklistTemplateLibraryItem {
  key: string;
  template_code: string;
  template_version: string;
  template_item_key: string;
  title: string;
  description: string | null;
  category: string;
  activation: ChecklistActivation;
  item_type: ChecklistItemType;
  phase: ChecklistPhase;
  source_basis: ChecklistSourceBasis;
  priority: Priority;
  sort_order: number;
  details_json: Record<string, unknown>;
  due_rule_json: Record<string, unknown>;
  due_date: string | null;
  note: string | null;
}

export interface ChecklistTemplateLibraryEntry {
  template_code: string;
  template_version: string;
  title: string;
  description: string | null;
  phase: ChecklistPhase;
  source_basis: ChecklistSourceBasis;
  auto_apply: false;
  import_policy: "manual";
  requires_confirmation: boolean;
  recommended_now: boolean;
  future: boolean;
  stage_status: "past_stage" | "current_stage" | "future_stage";
  reference_only: boolean;
  imported_status: "not_imported" | "partially_imported" | "imported";
  item_count: number;
  imported_item_count: number;
  latest_imported_at: string | null;
  items: ChecklistTemplateLibraryItem[];
}

export interface ChecklistImportResult {
  template_code: string;
  template_version: string;
  item_count: number;
  created_count: number;
  skipped_existing_count: number;
  items: ChecklistItemRecord[];
}

interface CreateCustomInput {
  title: string;
  description?: string | null;
  item_type?: string;
  phase?: string;
  source_basis?: string;
  priority?: string;
  due_date?: string | null;
  due_rule_json?: Record<string, unknown> | null;
  details_json?: Record<string, unknown> | null;
  note?: string | null;
}

interface UpdateInput {
  title?: string;
  description?: string | null;
  item_type?: string;
  phase?: string;
  source_basis?: string;
  status?: string;
  priority?: string;
  due_date?: string | null;
  due_rule_json?: Record<string, unknown> | null;
  details_json?: Record<string, unknown> | null;
  note?: string | null;
  archived?: boolean;
  archived_at?: string | null;
}

interface ImportTemplateInput {
  template_code?: string;
  template_item_key?: string;
  confirmed?: boolean;
}

export class ChecklistService {
  constructor(private readonly store: Store) {}

  async listTemplates(nowIso = new Date().toISOString(), languageInput: unknown = "zh"): Promise<ChecklistTemplateLibraryEntry[]> {
    const language = normalizeLanguage(languageInput, "zh");
    const profile = await this.store.getProfile();
    const today = localDateForTimezone(nowIso, profile.timezone);
    const currentPhase = inferChecklistPhase(profile, today);
    const items = await this.store.listChecklistItems({ includeArchived: true });
    const imports = await this.store.listChecklistTemplateImports();

    return stagedTemplates()
      .map((template) => {
        validateTemplate(template);
        const latestImport = imports
          .filter((item) => item.template_code === template.template_code && item.template_version === template.template_version)
          .sort((a, b) => b.imported_at.localeCompare(a.imported_at))[0];
        const normalizedItems = template.items.map((item, index) => localizeChecklistTemplateItem(normalizeTemplateItem(template, item, index), language));
        const importableItems = normalizedItems.filter(shouldCreateOnTemplateImport);
        const importedItems = items.filter(
          (item) =>
            item.template_code === template.template_code &&
            item.template_version === template.template_version &&
            normalizedItems.some((libraryItem) => libraryItem.key === item.template_item_key)
        );
        const stageStatus = getStageStatus(template.phase as ChecklistPhase, currentPhase);
        const referenceOnly = isReferenceOnlyTemplate(template);
        const recommendedNow = !referenceOnly && (stageStatus === "current_stage" || isBirthStartupTemplateRecommendation(template, profile, today));
        const importedStatus = getImportedStatus(importedItems.length, importableItems.length);

        return localizeChecklistTemplate({
          template_code: template.template_code,
          template_version: template.template_version,
          title: template.title,
          description: template.description ?? null,
          phase: template.phase as ChecklistPhase,
          source_basis: template.source_basis as ChecklistSourceBasis,
          auto_apply: false,
          import_policy: "manual",
          requires_confirmation: template.requires_confirmation === true,
          recommended_now: recommendedNow,
          future: stageStatus === "future_stage",
          stage_status: stageStatus,
          reference_only: referenceOnly,
          imported_status: importedStatus,
          item_count: template.items.length,
          imported_item_count: importedItems.length,
          latest_imported_at: latestImport?.imported_at ?? null,
          items: normalizedItems
        }, language);
      });
  }

  async importTemplate(input: ImportTemplateInput, nowIso: string): Promise<ChecklistImportResult> {
    const templateCode = requireText(input.template_code, "template_code");
    const template = stagedTemplates().find((item) => item.template_code === templateCode);
    if (!template) {
      throw new ValidationError("Unknown checklist template");
    }
    validateTemplate(template);
    if (input.template_item_key) {
      return this.importTemplateItem(template, input, nowIso);
    }
    if (isReferenceOnlyTemplate(template)) {
      throw new ValidationError("This checklist template is reference-only");
    }
    if (template.requires_confirmation && input.confirmed !== true) {
      throw new ValidationError("confirmed true is required for this checklist template");
    }

    const profile = await this.store.getProfile();
    const created: ChecklistItemRecord[] = [];
    let skippedExistingCount = 0;
    for (const [index, item] of template.items.entries()) {
      const normalized = normalizeTemplateItem(template, item, index);
      if (!shouldCreateOnTemplateImport(normalized)) continue;
      const existing = await this.store.getChecklistItemByTemplateKey(template.template_code, template.template_version, normalized.key);
      if (existing) {
        skippedExistingCount += 1;
        continue;
      }
      created.push(
        await this.store.insertChecklistItem({
          id: `${template.template_code}:${template.template_version}:${normalized.key}`,
          title: normalized.title,
          description: normalized.description,
          item_type: normalized.item_type,
          phase: normalized.phase,
          source_basis: normalized.source_basis,
          template_code: template.template_code,
          template_item_key: normalized.key,
          template_version: template.template_version,
          status: "pending",
          priority: normalized.priority,
          due_date: normalized.due_date ?? dueDateFromRules(profile, normalized.due_rule_json, normalized.details_json) ?? null,
          due_rule_json: normalized.due_rule_json,
          details_json: normalized.details_json,
          note: normalized.note,
          completed_at: null,
          skipped_at: null,
          archived_at: null,
          sort_order: normalized.sort_order,
          created_at: nowIso,
          updated_at: nowIso
        })
      );
    }

    await this.store.insertChecklistTemplateImport({
      id: `${template.template_code}:${crypto.randomUUID()}`,
      template_code: template.template_code,
      template_version: template.template_version,
      imported_at: nowIso,
      imported_by: "system",
      item_count: template.items.length,
      created_count: created.length,
      skipped_existing_count: skippedExistingCount,
      details_json: {}
    });

    return {
      template_code: template.template_code,
      template_version: template.template_version,
      item_count: template.items.length,
      created_count: created.length,
      skipped_existing_count: skippedExistingCount,
      items: created
    };
  }

  private async importTemplateItem(template: ChecklistTemplateSeed, input: ImportTemplateInput, nowIso: string): Promise<ChecklistImportResult> {
    const key = requireText(input.template_item_key, "template_item_key");
    const itemIndex = template.items.findIndex((item) => (item.template_item_key ?? item.key) === key);
    const item = itemIndex >= 0 ? template.items[itemIndex] : null;
    if (!item) throw new ValidationError("Unknown checklist template item");
    const normalized = normalizeTemplateItem(template, item, itemIndex);
    if (normalized.activation !== "manual_optional") {
      throw new ValidationError("Only manual optional template items can be manually enabled");
    }
    if (normalized.item_type === "vaccine" && input.confirmed !== true) {
      throw new ValidationError("confirmed true is required for this vaccine placeholder");
    }

    const existing = await this.store.getChecklistItemByTemplateKey(template.template_code, template.template_version, normalized.key);
    if (existing) {
      await this.store.insertChecklistTemplateImport({
        id: `${template.template_code}:${crypto.randomUUID()}`,
        template_code: template.template_code,
        template_version: template.template_version,
        imported_at: nowIso,
        imported_by: "system",
        item_count: 1,
        created_count: 0,
        skipped_existing_count: 1,
        details_json: { template_item_key: normalized.key, manual_optional: true }
      });
      return {
        template_code: template.template_code,
        template_version: template.template_version,
        item_count: 1,
        created_count: 0,
        skipped_existing_count: 1,
        items: []
      };
    }

    const profile = await this.store.getProfile();
    const created = await this.store.insertChecklistItem({
      id: `${template.template_code}:${template.template_version}:${normalized.key}`,
      title: normalized.title,
      description: normalized.description,
      item_type: normalized.item_type,
      phase: normalized.phase,
      source_basis: normalized.source_basis,
      template_code: template.template_code,
      template_item_key: normalized.key,
      template_version: template.template_version,
      status: "pending",
      priority: normalized.priority,
      due_date: normalized.due_date ?? dueDateFromRules(profile, normalized.due_rule_json, normalized.details_json) ?? null,
      due_rule_json: normalized.due_rule_json,
      details_json: normalized.details_json,
      note: normalized.note,
      completed_at: null,
      skipped_at: null,
      archived_at: null,
      sort_order: normalized.sort_order,
      created_at: nowIso,
      updated_at: nowIso
    });

    await this.store.insertChecklistTemplateImport({
      id: `${template.template_code}:${crypto.randomUUID()}`,
      template_code: template.template_code,
      template_version: template.template_version,
      imported_at: nowIso,
      imported_by: "system",
      item_count: 1,
      created_count: 1,
      skipped_existing_count: 0,
      details_json: { template_item_key: normalized.key, manual_optional: true }
    });

    return {
      template_code: template.template_code,
      template_version: template.template_version,
      item_count: 1,
      created_count: 1,
      skipped_existing_count: 0,
      items: [created]
    };
  }

  async createCustom(input: CreateCustomInput, nowIso: string): Promise<ChecklistItemRecord> {
    const profile = await this.store.getProfile();
    const title = requireText(input.title, "title");
    const phase = validatePhase(input.phase ?? (profile.child_birth_date ? "first_week" : "prenatal"));
    const itemType = validateItemType(input.item_type ?? "custom");
    const sourceBasis = validateSourceBasis(input.source_basis ?? "custom");
    const priority = validatePriority(input.priority ?? "normal");
    const dueDate = normalizeDate(input.due_date);

    return this.store.insertChecklistItem({
      id: `custom:${crypto.randomUUID()}`,
      title,
      description: nullableTrim(input.description),
      item_type: itemType,
      phase,
      source_basis: sourceBasis,
      template_code: null,
      template_item_key: null,
      template_version: null,
      status: "pending",
      priority,
      due_date: dueDate,
      due_rule_json: input.due_rule_json ?? {},
      details_json: input.details_json ?? {},
      note: nullableTrim(input.note),
      completed_at: null,
      skipped_at: null,
      archived_at: null,
      sort_order: 0,
      created_at: nowIso,
      updated_at: nowIso
    });
  }

  async update(id: string, input: UpdateInput, nowIso: string): Promise<ChecklistItemRecord | null> {
    const patch: Partial<ChecklistItemRecord> = {};
    if ("title" in input) patch.title = requireText(input.title, "title");
    if ("description" in input) patch.description = nullableTrim(input.description);
    if ("item_type" in input) patch.item_type = validateItemType(input.item_type);
    if ("phase" in input) patch.phase = validatePhase(input.phase);
    if ("source_basis" in input) patch.source_basis = validateSourceBasis(input.source_basis);
    if ("priority" in input) patch.priority = validatePriority(input.priority);
    if ("due_date" in input) patch.due_date = normalizeDate(input.due_date);
    if ("due_rule_json" in input) patch.due_rule_json = input.due_rule_json ?? {};
    if ("details_json" in input) patch.details_json = input.details_json ?? {};
    if ("note" in input) patch.note = nullableTrim(input.note);

    if ("status" in input) {
      const status = validateStatus(input.status);
      patch.status = status;
      patch.completed_at = status === "done" ? nowIso : null;
      patch.skipped_at = status === "skipped" ? nowIso : null;
    }
    if ("archived" in input) {
      patch.archived_at = input.archived ? nowIso : null;
    } else if ("archived_at" in input) {
      patch.archived_at = input.archived_at ?? null;
    }

    return this.store.updateChecklistItem(id, patch, nowIso);
  }

  async listSections(nowIso: string, languageInput: unknown = "zh"): Promise<ChecklistSections> {
    const language = normalizeLanguage(languageInput, "zh");
    const profile = await this.store.getProfile();
    const today = localDateForTimezone(nowIso, profile.timezone);
    const currentPhase = inferChecklistPhase(profile, today);
    const items = await this.store.listChecklistItems({ includeArchived: true });
    const activePending = items.filter((item) => item.status === "pending" && !item.archived_at);
    const actionablePending = activePending.filter((item) => isActionableChecklistItem(item));
    const reference = activePending.filter(
      (item) => getChecklistActivation(item) === "reference" && isPhaseCurrentOrEarlier(item.phase, currentPhase) && (!item.due_date || item.due_date <= today)
    );
    const current = actionablePending.filter(
      (item) => isPhaseCurrentOrEarlier(item.phase, currentPhase) && (!item.due_date || item.due_date <= today)
    );
    const upcoming = actionablePending.filter((item) => isFuturePhase(item.phase, currentPhase) || Boolean(item.due_date && item.due_date > today));
    const completed = items.filter((item) => item.status === "done" && !item.archived_at);
    const skippedHidden = items.filter((item) => item.status === "skipped" || item.archived_at);

    return {
      summary: {
        current_count: current.length,
        upcoming_count: upcoming.length,
        completed_count: completed.length,
        skipped_hidden_count: skippedHidden.length,
        reference_count: reference.length,
        total_active_count: current.length + upcoming.length
      },
      current: localizeChecklistItems(current, language),
      upcoming: localizeChecklistItems(upcoming, language),
      reference: localizeChecklistItems(reference, language),
      completed: localizeChecklistItems(completed, language),
      skipped_hidden: localizeChecklistItems(skippedHidden, language)
    };
  }
}

function localizeChecklistItems(items: ChecklistItemRecord[], language: Language): ChecklistItemRecord[] {
  return items.map((item) => localizeChecklistItemRecord(item, language));
}

function stagedTemplates(): ChecklistTemplateSeed[] {
  const catalog = seed.templates[0];
  if (!catalog) return [];
  return STAGED_TEMPLATE_GROUPS.map((group) => ({
    template_code: group.template_code,
    template_version: catalog.template_version,
    title: group.title,
    description: catalog.description,
    phase: group.phase,
    source_basis: catalog.source_basis,
    auto_apply: false,
    import_policy: "manual",
    requires_confirmation: false,
    items: catalog.items.filter((item) => item.source_phase === group.source_phase)
  })).filter((template) => template.items.length > 0);
}

function inferChecklistPhase(profile: AppProfile, today: string): ChecklistPhase {
  if (profile.phase === "pregnancy_prebirth" || !profile.child_birth_date) {
    return "prenatal";
  }

  const ageDays = daysBetweenLocalDates(profile.child_birth_date, today);
  if (ageDays < 0) return "prenatal";
  if (ageDays <= 2) return "birth_hospital";
  if (ageDays <= 6) return "first_week";
  if (ageDays <= 30) return "first_month";

  const ageMonths = wholeMonthsBetween(profile.child_birth_date, today);
  if (ageMonths <= 3) return "infant_1_3m";
  if (ageMonths <= 7) return "infant_4_7m";
  if (ageMonths <= 12) return "infant_8_12m";
  if (ageMonths <= 18) return "toddler_12_18m";
  if (ageMonths <= 24) return "toddler_18_24m";
  if (ageMonths <= 35) return "toddler_24_30m";
  if (ageMonths <= 47) return "toddler_3y";
  if (ageMonths <= 71) return "preschool_4_5y";
  return "early_school_6y";
}

function isPhaseCurrentOrEarlier(phase: ChecklistPhase, currentPhase: ChecklistPhase): boolean {
  return phaseRank(phase) <= phaseRank(currentPhase);
}

function isFuturePhase(phase: ChecklistPhase, currentPhase: ChecklistPhase): boolean {
  return phaseRank(phase) > phaseRank(currentPhase);
}

function getStageStatus(phase: ChecklistPhase, currentPhase: ChecklistPhase): ChecklistTemplateLibraryEntry["stage_status"] {
  const rank = phaseRank(phase);
  const currentRank = phaseRank(currentPhase);
  if (rank < currentRank) return "past_stage";
  if (rank > currentRank) return "future_stage";
  return "current_stage";
}

function phaseRank(phase: ChecklistPhase): number {
  return checklistPhaseRank.get(phase) ?? Number.MAX_SAFE_INTEGER;
}

function isReferenceOnlyTemplate(template: ChecklistTemplateSeed): boolean {
  return template.template_code === "aap_cross_cutting_v1";
}

function isBirthStartupTemplateRecommendation(template: ChecklistTemplateSeed, profile: AppProfile, today: string): boolean {
  if (!profile.child_birth_date) return false;
  const birthDayNumber = daysBetweenLocalDates(profile.child_birth_date, today) + 1;
  return birthDayNumber >= 1 && birthDayNumber <= 7 && (template.template_code === "aap_birth_hospital_v1" || template.template_code === "aap_first_week_v1");
}

function getImportedStatus(importedCount: number, totalCount: number): ChecklistTemplateLibraryEntry["imported_status"] {
  if (importedCount <= 0) return "not_imported";
  if (importedCount >= totalCount) return "imported";
  return "partially_imported";
}

function shouldCreateOnTemplateImport(item: Pick<ChecklistTemplateLibraryItem, "activation">): boolean {
  return item.activation !== "manual_optional";
}

function isActionableChecklistItem(item: ChecklistItemRecord): boolean {
  const activation = getChecklistActivation(item);
  return activation !== "reference";
}

function getChecklistActivation(item: ChecklistItemRecord): ChecklistActivation | null {
  const value = item.details_json.activation;
  return typeof value === "string" && ALLOWED_ACTIVATIONS.has(value as ChecklistActivation) ? (value as ChecklistActivation) : null;
}

function dueDateFromRules(profile: AppProfile, dueRule: Record<string, unknown>, details: Record<string, unknown>): string | null {
  if (!profile.child_birth_date) return null;
  const anchor = typeof dueRule.age_anchor === "string" ? dueRule.age_anchor : typeof details.age_anchor === "string" ? details.age_anchor : null;
  if (anchor) return dueDateFromAgeAnchor(profile.child_birth_date, anchor);

  const window = dueRule.age_window;
  if (window && typeof window === "object" && !Array.isArray(window)) {
    const ageWindow = window as Record<string, unknown>;
    if (typeof ageWindow.start_days === "number") return addDaysToLocalDate(profile.child_birth_date, ageWindow.start_days);
    if (typeof ageWindow.start_months === "number") return addMonthsToLocalDate(profile.child_birth_date, ageWindow.start_months);
    if (typeof ageWindow.start_years === "number") return addMonthsToLocalDate(profile.child_birth_date, ageWindow.start_years * 12);
  }

  const trigger = dueRule.trigger;
  if (trigger === "birth_to_discharge" || trigger === "discharge_day") return profile.child_birth_date;

  return null;
}

function dueDateFromAgeAnchor(birthDate: string, anchor: string): string | null {
  if (anchor === "birth_day") return birthDate;
  if (anchor === "3_5_day") return addDaysToLocalDate(birthDate, 3);

  const monthMatch = anchor.match(/^(\d+)_month$/);
  if (monthMatch) return addMonthsToLocalDate(birthDate, Number(monthMatch[1]));

  const yearMatch = anchor.match(/^(\d+)_year$/);
  if (yearMatch) return addMonthsToLocalDate(birthDate, Number(yearMatch[1]) * 12);

  return null;
}

function daysBetweenLocalDates(startDate: string, endDate: string): number {
  return Math.floor((dateOnlyToUtcMs(endDate) - dateOnlyToUtcMs(startDate)) / 86_400_000);
}

function wholeMonthsBetween(startDate: string, endDate: string): number {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  let months = (end.year - start.year) * 12 + end.month - start.month;
  if (end.day < start.day) months -= 1;
  return Math.max(months, 0);
}

function addDaysToLocalDate(date: string, days: number): string {
  return formatUtcDate(dateOnlyToUtcMs(date) + days * 86_400_000);
}

function addMonthsToLocalDate(date: string, months: number): string {
  const parsed = parseLocalDate(date);
  const targetMonthIndex = parsed.month - 1 + months;
  const targetYear = parsed.year + Math.floor(targetMonthIndex / 12);
  const targetMonth = mod(targetMonthIndex, 12) + 1;
  const day = Math.min(parsed.day, daysInMonth(targetYear, targetMonth));
  return formatLocalDateParts(targetYear, targetMonth, day);
}

function parseLocalDate(date: string): { year: number; month: number; day: number } {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match || !isValidDateOnly(date)) throw new ValidationError("date must be YYYY-MM-DD");
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function dateOnlyToUtcMs(date: string): number {
  const parsed = parseLocalDate(date);
  return Date.UTC(parsed.year, parsed.month - 1, parsed.day);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatUtcDate(ms: number): string {
  const date = new Date(ms);
  return formatLocalDateParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function formatLocalDateParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function validateTemplate(template: ChecklistTemplateSeed) {
  if (template.auto_apply !== false || template.import_policy !== "manual") {
    throw new ValidationError(`Checklist template must be manual import only: ${template.template_code}`);
  }
  validatePhase(template.phase);
  validateSourceBasis(template.source_basis);
  template.items.forEach((item, index) => normalizeTemplateItem(template, item, index));
}

function validateTemplateItem(template: ChecklistTemplateSeed, item: ChecklistTemplateItemSeed, index = 0) {
  normalizeTemplateItem(template, item, index);
}

function normalizeTemplateItem(template: ChecklistTemplateSeed, item: ChecklistTemplateItemSeed, index = 0): ChecklistTemplateLibraryItem {
  const key = requireText(item.template_item_key ?? item.key, "template item key");
  const title = requireText(item.title, "template item title");
  const details = item.details_json ?? {};
  const category = requireText(item.category ?? details.category, "template item category");
  const activation = validateActivation(item.activation ?? details.activation ?? "recommended");
  const sourceBasis = validateSourceBasis(item.source_basis ?? details.source_basis ?? template.source_basis);
  const priority = validateSeedPriority(item.priority ?? "normal");
  const parentTask = nullableTrim(details.parent_task) ?? nullableTrim(item.description);
  const detailsJson = {
    ...details,
    parent_task: parentTask ?? title,
    source_basis: sourceBasis,
    category,
    activation,
    source_phase: item.source_phase ?? details.source_phase ?? null
  };

  return {
    key,
    template_code: requireText(template.template_code, "template_code"),
    template_version: requireText(template.template_version, "template_version"),
    template_item_key: key,
    title,
    description: nullableTrim(item.description) ?? parentTask,
    category,
    activation,
    item_type: validateItemType(item.item_type),
    phase: validatePhase(item.phase),
    source_basis: sourceBasis,
    priority,
    sort_order: item.sort_order ?? index + 1,
    details_json: detailsJson,
    due_rule_json: item.due_rule_json ?? {},
    due_date: normalizeDate(item.due_date),
    note: nullableTrim(item.note)
  };
}

function validateItemType(value: unknown): ChecklistItemType {
  if (typeof value !== "string" || !ALLOWED_ITEM_TYPES.has(value as ChecklistItemType)) {
    throw new ValidationError("item_type is not allowed");
  }
  return value as ChecklistItemType;
}

function validatePhase(value: unknown): ChecklistPhase {
  if (typeof value !== "string" || !ALLOWED_PHASES.has(value as ChecklistPhase)) {
    throw new ValidationError("phase is not allowed");
  }
  return value as ChecklistPhase;
}

function validateSourceBasis(value: unknown): ChecklistSourceBasis {
  if (typeof value !== "string" || !ALLOWED_SOURCE_BASIS.has(value as ChecklistSourceBasis)) {
    throw new ValidationError("source_basis is not allowed");
  }
  return value as ChecklistSourceBasis;
}

function validateStatus(value: unknown): ChecklistStatus {
  if (typeof value !== "string" || !ALLOWED_STATUSES.has(value as ChecklistStatus)) {
    throw new ValidationError("status is not allowed");
  }
  return value as ChecklistStatus;
}

function validatePriority(value: unknown): Priority {
  if (typeof value !== "string" || !ALLOWED_PRIORITIES.has(value as Priority)) {
    throw new ValidationError("priority is not allowed");
  }
  return value as Priority;
}

function validateSeedPriority(value: unknown): Priority {
  if (value === "P0") return "high";
  if (value === "P1") return "normal";
  if (value === "P2") return "low";
  return validatePriority(value);
}

function validateActivation(value: unknown): ChecklistActivation {
  if (typeof value !== "string" || !ALLOWED_ACTIVATIONS.has(value as ChecklistActivation)) {
    throw new ValidationError("activation is not allowed");
  }
  return value as ChecklistActivation;
}

function normalizeDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !isValidDateOnly(value)) {
    throw new ValidationError("due_date must be YYYY-MM-DD");
  }
  return value;
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${field} is required`);
  }
  return value.trim();
}

function nullableTrim(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

interface ChecklistTemplateSeedFile {
  schema_version: string;
  allowed_item_type: string[];
  allowed_phase: string[];
  allowed_source_basis: string[];
  templates: ChecklistTemplateSeed[];
}

interface ChecklistTemplateSeed {
  template_code: string;
  template_version: string;
  title: string;
  description?: string;
  phase: string;
  source_basis: string;
  auto_apply: boolean;
  import_policy: string;
  requires_confirmation?: boolean;
  items: ChecklistTemplateItemSeed[];
}

interface ChecklistTemplateItemSeed {
  key?: string;
  template_code?: string;
  template_version?: string;
  template_item_key?: string;
  title?: string;
  description?: string;
  item_type: string;
  phase: string;
  source_basis: string;
  source_phase?: string;
  category?: string;
  activation?: string;
  priority_code?: string;
  priority?: string;
  sort_order?: number;
  due_date?: string | null;
  due_rule_json?: Record<string, unknown>;
  details_json?: Record<string, unknown>;
  note?: string | null;
}
