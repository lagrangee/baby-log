import { describe, expect, it } from "vitest";
import type { ReferenceTargetItem } from "../../src/client/types";
import { referenceBadgeText, referenceForSlot, referenceStatusClass } from "../../src/client/utils/reference-targets";

function target(key: string, target_label: string | null, status: ReferenceTargetItem["status"] = "reference_only"): ReferenceTargetItem {
  return {
    key,
    category: "feeding",
    title: key,
    reference_text: "",
    why_it_matters: "",
    target_label,
    current_value: null,
    unit: null,
    status,
    message: "",
    severity: "reference",
    source_basis: []
  };
}

describe("reference target card helpers", () => {
  it("selects the applicable wet diaper target for summary cards", () => {
    const item = target("wet_diapers_day_3_4", "4–8 wet diapers/24h", "below_reference");

    expect(referenceForSlot([item], "pee")).toBe(item);
    expect(referenceBadgeText(item)).toBe("4–8 wet");
    expect(referenceStatusClass(item)).toBe("attention");
  });

  it("uses compact daily labels for common newborn card targets", () => {
    expect(referenceBadgeText(target("feeding_frequency_newborn_0_30d", "≥ 8 times/24h"))).toBe("8-12 feeds");
    expect(referenceBadgeText(target("newborn_sleep_0_30d", "840–1020 min/24h"))).toBe("14-17 hr");
  });

  it("falls back to stage reference when a target has no numeric label", () => {
    expect(referenceBadgeText(target("wet_diapers_early_day_1_2_reference_only", null))).toBe("Stage reference");
  });
});
