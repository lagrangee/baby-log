/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import recordItemsSeed from "../../src/server/data/record-items.json";
import milestoneSeed from "../../src/server/data/milestones.json";
import checklistTemplatesSeed from "../../src/server/data/checklist-templates.json";

type SeedItem = {
  template_item_key?: string;
  key?: string;
  title?: string;
  category?: string;
  phase?: string;
  activation?: string;
  source_basis?: string;
  due_rule_json?: Record<string, unknown>;
  details_json?: Record<string, unknown>;
};

describe("Checklist 2.2 seed catalog", () => {
  test("seed loads and keeps the public checklist key set stable", () => {
    const items = checklistTemplatesSeed.templates.flatMap((template) => template.items as SeedItem[]);
    const keys = items.map((item) => item.template_item_key ?? item.key);

    expect(items).toHaveLength(83);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual([
      "choose_pediatric_provider",
      "install_rear_facing_car_seat",
      "setup_safe_sleep_surface",
      "prepare_feeding_support",
      "prepare_birth_contacts",
      "family_roles_first_two_weeks",
      "vaccination_record_shell",
      "skin_to_skin_first_feed",
      "newborn_prevention_record",
      "newborn_screenings_record",
      "discharge_followup_plan",
      "safe_ride_home",
      "well_visit_3_5_days",
      "feeding_diaper_weight_watch",
      "jaundice_watch",
      "cord_bathing_basic",
      "temperature_plan",
      "safe_sleep_reference",
      "parent_help_plan",
      "well_visit_1_month",
      "growth_feeding_review_1m",
      "bowel_urine_reference",
      "crying_colic_plan",
      "tummy_time_awake",
      "first_month_safety_check",
      "well_visit_2_months",
      "vaccine_record_2m",
      "feeding_sleep_review_1_3m",
      "development_obs_1_3m",
      "safety_falls_burns_choking_1_3m",
      "breathing_fever_feeding_red_flags",
      "well_visit_4_months",
      "well_visit_6_months",
      "solid_food_readiness",
      "supplement_review_4_7m",
      "teething_dental_start",
      "development_obs_4_7m",
      "safety_rolling_choking_water",
      "well_visit_9_months",
      "developmental_screening_9m",
      "well_visit_12_months",
      "cup_feeding_transition",
      "teeth_brushing_questions",
      "development_obs_8_12m",
      "childproofing_mobile_baby",
      "discipline_redirect_start",
      "well_visit_15_months",
      "well_visit_18_months",
      "screening_18m",
      "nutrition_transition_1y",
      "toilet_readiness_only",
      "tantrum_response_rule",
      "safety_one_year_old",
      "well_visit_24_months",
      "autism_screening_24m",
      "language_social_obs_2y",
      "toilet_readiness_2y",
      "sleep_discipline_2y",
      "dental_hygiene_2y",
      "safety_two_year_old",
      "well_visit_30_months",
      "developmental_screening_30m",
      "toilet_training_if_ready",
      "nutrition_picky_eating_review",
      "well_visit_3_years",
      "preschool_readiness_3y",
      "development_obs_3y",
      "bedwetting_reference_3y",
      "discipline_sleep_3y",
      "safety_three_year_old",
      "well_visit_4_years",
      "well_visit_5_years",
      "kindergarten_readiness",
      "development_obs_4_5y",
      "healthy_lifestyle_review",
      "discipline_emotion_4_5y",
      "safety_travel_4_5y",
      "well_visit_6_years",
      "school_entry_documents",
      "six_year_vaccine_verify_only",
      "doctor_question_list_before_visit",
      "record_growth_after_visit",
      "no_auto_diagnosis_rule"
    ]);
  });

  test("every seed item has required family task fields", () => {
    const items = checklistTemplatesSeed.templates.flatMap((template) => template.items as SeedItem[]);

    for (const item of items) {
      expect(item.template_item_key ?? item.key).toEqual(expect.any(String));
      expect(item.title).toEqual(expect.any(String));
      expect(item.category).toEqual(expect.any(String));
      expect(item.phase).toEqual(expect.any(String));
      expect(item.activation).toEqual(expect.any(String));
      expect(item.source_basis ?? item.details_json?.source_basis).toEqual(expect.any(String));
      expect(item.due_rule_json).toEqual(expect.any(Object));
      expect(Object.keys(item.due_rule_json ?? {})).not.toHaveLength(0);
      expect(item.details_json).toEqual(expect.any(Object));
      expect(Object.keys(item.details_json ?? {})).not.toHaveLength(0);
      expect(item.details_json?.parent_task).toEqual(expect.any(String));
    }
  });

  test("seed exposes expanded checklist phases", () => {
    expect(checklistTemplatesSeed.allowed_phase).toEqual(
      expect.arrayContaining([
        "toddler_12_18m",
        "toddler_18_24m",
        "toddler_24_30m",
        "toddler_3y",
        "preschool_4_5y",
        "early_school_6y"
      ])
    );
    expect(checklistTemplatesSeed.allowed_phase).not.toEqual(expect.arrayContaining(["toddler_1y", "toddler_2y", "preschool_3_5y"]));
  });

  test("legacy static JSON imports used by runtime are present", () => {
    expect(recordItemsSeed).toEqual(expect.objectContaining({ items: expect.any(Array) }));
    expect(recordItemsSeed.items.length).toBeGreaterThan(0);
    expect(milestoneSeed).toEqual(expect.objectContaining({ items: expect.any(Array) }));
    expect(milestoneSeed.items.length).toBeGreaterThan(0);
  });
});
