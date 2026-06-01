import milestoneSeed from "../data/milestones.json";
import { ValidationError } from "../../shared/content";
import type { MilestoneRecord, Store } from "../types";
import { isValidDateOnly } from "../utils/time";

const ALLOWED_MILESTONE_TYPES = new Set(["social", "motor", "language", "custom"]);

export class MilestoneService {
  constructor(private readonly store: Store) {}

  listSeedItems() {
    return milestoneSeed.items;
  }

  async create(input: {
    title: string;
    milestone_type: string;
    observed_on: string;
    note?: string | null;
    source_ref?: string | null;
  }, nowIso: string): Promise<MilestoneRecord> {
    if (!input.title.trim()) throw new ValidationError("title is required");
    if (!ALLOWED_MILESTONE_TYPES.has(input.milestone_type)) throw new ValidationError("milestone_type is not allowed");
    if (!isValidDateOnly(input.observed_on)) throw new ValidationError("observed_on must be YYYY-MM-DD");
    const record: MilestoneRecord = {
      id: crypto.randomUUID(),
      milestone_type: input.milestone_type as MilestoneRecord["milestone_type"],
      title: input.title.trim(),
      observed_on: input.observed_on,
      note: input.note ?? null,
      source_kind: input.source_ref ? "seed" : "custom",
      source_ref: input.source_ref ?? null,
      details_json: {},
      created_at: nowIso,
      updated_at: nowIso
    };
    return this.store.insertMilestone(record);
  }
}
