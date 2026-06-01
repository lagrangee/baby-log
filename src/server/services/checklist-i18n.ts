import type { Language } from "../../shared/i18n";
import type { ChecklistItemRecord } from "../types";
import type { ChecklistTemplateLibraryEntry, ChecklistTemplateLibraryItem } from "./checklist-service";

interface ChecklistText {
  title: string;
  description?: string;
}

const templateTexts: Record<string, ChecklistText> = {
  aap_prenatal_late_v1: {
    title: "Late pregnancy / before birth",
    description: "A static family checklist adapted from AAP / HealthyChildren guidance. It does not provide diagnosis, treatment, medication advice, or a complete vaccine schedule."
  },
  aap_birth_hospital_v1: {
    title: "Birth day through hospital stay",
    description: "A static family checklist adapted from AAP / HealthyChildren guidance. It does not provide diagnosis, treatment, medication advice, or a complete vaccine schedule."
  },
  aap_first_week_v1: {
    title: "First week after birth",
    description: "A static family checklist adapted from AAP / HealthyChildren guidance. It does not provide diagnosis, treatment, medication advice, or a complete vaccine schedule."
  },
  aap_first_month_v1: {
    title: "First month",
    description: "A static family checklist adapted from AAP / HealthyChildren guidance. It does not provide diagnosis, treatment, medication advice, or a complete vaccine schedule."
  },
  aap_infant_1_3m_v1: {
    title: "1-3 months",
    description: "A static family checklist adapted from AAP / HealthyChildren guidance. It does not provide diagnosis, treatment, medication advice, or a complete vaccine schedule."
  },
  aap_infant_4_7m_v1: {
    title: "4-7 months",
    description: "A static family checklist adapted from AAP / HealthyChildren guidance. It does not provide diagnosis, treatment, medication advice, or a complete vaccine schedule."
  },
  aap_infant_8_12m_v1: {
    title: "8-12 months",
    description: "A static family checklist adapted from AAP / HealthyChildren guidance. It does not provide diagnosis, treatment, medication advice, or a complete vaccine schedule."
  },
  aap_toddler_12_18m_v1: {
    title: "12-18 months",
    description: "A static family checklist adapted from AAP / HealthyChildren guidance. It does not provide diagnosis, treatment, medication advice, or a complete vaccine schedule."
  },
  aap_toddler_18_24m_v1: {
    title: "18-24 months",
    description: "A static family checklist adapted from AAP / HealthyChildren guidance. It does not provide diagnosis, treatment, medication advice, or a complete vaccine schedule."
  },
  aap_toddler_24_30m_v1: {
    title: "24-30 months",
    description: "A static family checklist adapted from AAP / HealthyChildren guidance. It does not provide diagnosis, treatment, medication advice, or a complete vaccine schedule."
  },
  aap_toddler_3y_v1: {
    title: "3 years",
    description: "A static family checklist adapted from AAP / HealthyChildren guidance. It does not provide diagnosis, treatment, medication advice, or a complete vaccine schedule."
  },
  aap_preschool_4_5y_v1: {
    title: "4-5 years",
    description: "A static family checklist adapted from AAP / HealthyChildren guidance. It does not provide diagnosis, treatment, medication advice, or a complete vaccine schedule."
  },
  aap_school_entry_6y_bridge_v1: {
    title: "6-year school-entry bridge",
    description: "A static family checklist adapted from AAP / HealthyChildren guidance. It does not provide diagnosis, treatment, medication advice, or a complete vaccine schedule."
  },
  aap_cross_cutting_v1: {
    title: "Cross-stage rules",
    description: "A static family checklist adapted from AAP / HealthyChildren guidance. It does not provide diagnosis, treatment, medication advice, or a complete vaccine schedule."
  }
};

const itemTexts: Record<string, ChecklistText> = {
  choose_pediatric_provider: {
    title: "Confirm the pediatrician / well-child clinic and contact paths",
    description: "Record the pediatrician, after-hours advice options, emergency/hospital route, and first-visit booking process."
  },
  install_rear_facing_car_seat: {
    title: "Install and check the newborn rear-facing car seat",
    description: "Install it in the back seat and, where possible, ask a trained checker or hospital resource to review the installation."
  },
  setup_safe_sleep_surface: {
    title: "Prepare a separate safe sleep surface",
    description: "Prepare a crib, bassinet, or portable crib with a firm flat surface and no pillows, loose bedding, bumper pads, or soft toys."
  },
  prepare_feeding_support: {
    title: "Confirm the early feeding plan and support resources",
    description: "Record whether breastfeeding is planned, whether a pump is needed, and lactation consultant or hospital feeding-support contacts."
  },
  prepare_birth_contacts: {
    title: "Organize the birth and discharge contact list",
    description: "Organize hospital, obstetric, pediatric, family, caregiver, transportation, and document details."
  },
  family_roles_first_two_weeks: {
    title: "Assign family roles for the first two weeks after birth",
    description: "Clarify who handles night diaper changes, meals, parent rest, follow-up visits, and feeding/diaper logs."
  },
  vaccination_record_shell: {
    title: "Create a vaccine-record placeholder, not a complete vaccine schedule",
    description: "Keep only a record entry point; after birth, enter plans from the local clinic or pediatrician."
  },
  skin_to_skin_first_feed: {
    title: "Record skin-to-skin contact and the first feed",
    description: "Record whether skin-to-skin contact happened, the first breastfeeding/feeding attempt, and whether feeding support was needed."
  },
  newborn_prevention_record: {
    title: "Record vitamin K, eye prophylaxis, first hepatitis B dose, and other hospital measures",
    description: "Record completion, timing, and hospital notes only; do not make medication or vaccine decisions here."
  },
  newborn_screenings_record: {
    title: "Record newborn screening results or pending results",
    description: "Record hearing, metabolic, heart, jaundice, and other screening completion, plus when the hospital expects results."
  },
  discharge_followup_plan: {
    title: "Confirm the 24-48 hour or 3-5 day post-discharge follow-up plan",
    description: "Before discharge, confirm the first pediatric/well-child visit time, with attention to weight, jaundice, and feeding."
  },
  safe_ride_home: {
    title: "Confirm car-seat use for the ride home before discharge",
    description: "On the ride-home day, recheck rear-facing installation, harness height, and how the baby is secured."
  },
  well_visit_3_5_days: {
    title: "Complete the 3-5 day pediatric/well-child visit",
    description: "Bring the discharge summary, birth weight, feeding/diaper log, jaundice notes, and screening results."
  },
  feeding_diaper_weight_watch: {
    title: "Check feeding, wet diapers, stools, and weight trend daily",
    description: "Record feeding count, wet diapers, stools, unusual sleepiness, or weak sucking; show the log at follow-up."
  },
  jaundice_watch: {
    title: "Watch jaundice, alertness, and feeding ability",
    description: "If yellowing worsens, alertness is poor, feeding is poor, or the doctor asks for recheck, follow medical instructions."
  },
  cord_bathing_basic: {
    title: "Record cord care and bathing arrangements",
    description: "Keep the cord area clean and dry; follow hospital or pediatric guidance for bathing frequency and method."
  },
  temperature_plan: {
    title: "Prepare temperature checks and fever-response rules",
    description: "Confirm a usable thermometer at home; newborn fever, poor alertness, or feeding difficulty should prompt contact with a doctor."
  },
  safe_sleep_reference: {
    title: "Use safe-sleep principles for every sleep",
    description: "Place baby on the back on a separate sleep surface and avoid soft items or loose bedding; keep this as a standing reference, not a daily task."
  },
  parent_help_plan: {
    title: "Create a help plan for when parents are overwhelmed",
    description: "List people who can take over baby care, prepare food, or accompany medical visits; if crying feels unmanageable, first place baby in a safe place."
  },
  well_visit_1_month: {
    title: "Prepare for and complete the 1-month pediatric/well-child visit",
    description: "Bring feeding, diaper, weight, sleep, jaundice/skin, screening results, and a question list."
  },
  growth_feeding_review_1m: {
    title: "Review whether feeding is stable in the first month",
    description: "Check feeding frequency, swallowing/satiety, wet diapers, stools, and weight gain; bring concerns to the doctor."
  },
  bowel_urine_reference: {
    title: "Set a reference for normal pee and poop variation",
    description: "Record meaningful changes; interpret them together with alertness, feeding, and weight rather than worrying over one stool interval."
  },
  crying_colic_plan: {
    title: "Define steps for crying / colic episodes",
    description: "Check hunger, diaper, temperature, burping, holding, white noise, and brief safe placement; never shake the baby."
  },
  tummy_time_awake: {
    title: "Start supervised tummy time while awake",
    description: "Do short, repeated sessions each day while baby is awake and supervised; sleep should still be on the back."
  },
  first_month_safety_check: {
    title: "Complete the first-month home safety check",
    description: "Check the car seat, bath-water temperature, changing table, choking risks, fire/burn risks, cords/necklace risks, and head/neck support."
  },
  well_visit_2_months: {
    title: "Prepare for and complete the 2-month pediatric/well-child visit",
    description: "Bring feeding, diaper, sleep, development observations, and vaccine record; record the doctor's next plan."
  },
  vaccine_record_2m: {
    title: "2-month vaccines: verify and record the local/doctor plan only",
    description: "Do not let the system generate doses automatically; record the clinic or doctor's vaccine names, dates, and reaction observations."
  },
  feeding_sleep_review_1_3m: {
    title: "Review feeding and sleep rhythm at 1-3 months",
    description: "Check whether feeding is stable, nights are gradually lengthening, and daytime naps have a basic pattern."
  },
  development_obs_1_3m: {
    title: "Record 1-3 month development observations",
    description: "Observe head lifting/body movement, looking at people and objects, sound response, vocalizing, smiling, and interaction."
  },
  safety_falls_burns_choking_1_3m: {
    title: "Complete the 1-3 month fall, burn, and choking risk check",
    description: "Do not place infant seats on high surfaces; keep hot drinks and stoves away from baby; check toys for small parts and sharp edges."
  },
  breathing_fever_feeding_red_flags: {
    title: "Keep red-flag reminders for breathing, fever, and feeding difficulty",
    description: "For labored breathing, fever, poor alertness, or clearly reduced feeding, follow doctor or emergency-care rules."
  },
  well_visit_4_months: {
    title: "Prepare for and complete the 4-month pediatric/well-child visit",
    description: "Bring feeding, sleep, rolling/movement, vocalizing, visual interaction, and vaccine-record notes."
  },
  well_visit_6_months: {
    title: "Prepare for and complete the 6-month pediatric/well-child visit",
    description: "Prepare questions about solids, sleep, teething, motor development, safety, and the vaccine plan."
  },
  solid_food_readiness: {
    title: "Prepare the solid-food introduction plan",
    description: "Confirm with the pediatrician whether baby is ready for solids; record first foods, allergy observations, and feeding rhythm."
  },
  supplement_review_4_7m: {
    title: "Review vitamin, iron, fluoride, and other supplement advice",
    description: "Record doctor recommendations only; do not let the system suggest doses automatically."
  },
  teething_dental_start: {
    title: "Start teething and oral-care notes",
    description: "Record teething signs, cleaning method, nighttime milk/oral-care questions, and ask at well-child visits."
  },
  development_obs_4_7m: {
    title: "Record 4-7 month development observations",
    description: "Observe rolling/support, grasping, visual tracking, babbling, social interaction, and object exploration."
  },
  safety_rolling_choking_water: {
    title: "Complete post-rolling safety, solid-food choking, and water safety checks",
    description: "Fall risk rises after rolling; avoid large hard food pieces; supervise the entire bath."
  },
  well_visit_9_months: {
    title: "Prepare for and complete the 9-month pediatric/well-child visit",
    description: "Bring development observations, solids/water/cup notes, sleep, teeth, safety, and vaccine record."
  },
  developmental_screening_9m: {
    title: "Record whether the 9-month developmental screening was completed",
    description: "At the 9-month visit, confirm whether developmental screening was completed and save results or doctor feedback."
  },
  well_visit_12_months: {
    title: "Prepare for and complete the 12-month pediatric/well-child visit",
    description: "Bring diet, cup, sleep, teeth, crawling/standing, language, social, and vaccine records."
  },
  cup_feeding_transition: {
    title: "Practice cup use and transition toward richer family foods",
    description: "Record cup practice, solid texture changes, swallowing/choking, allergy signs, or stool changes."
  },
  teeth_brushing_questions: {
    title: "Record tooth eruption and brushing/dental questions",
    description: "Record teething, cleaning method, night milk/cavity-risk questions, and ask about dental advice at well-child visits."
  },
  development_obs_8_12m: {
    title: "Record 8-12 month development observations",
    description: "Observe crawling/pulling to stand/sitting, fine finger movements, name response, repeated syllables, finding hidden objects, and separation anxiety."
  },
  childproofing_mobile_baby: {
    title: "Complete whole-home safety upgrades after crawling or pulling to stand",
    description: "Check outlets, cabinet doors, medicines/cleaners, heat sources, furniture anchoring, small objects, stairs/gates, and water sources."
  },
  discipline_redirect_start: {
    title: "Align on early rules: no hitting, no yelling, redirect and limit",
    description: "Use brief limits and redirection for unsafe behavior; keep family responses consistent."
  },
  well_visit_15_months: {
    title: "Prepare for and complete the 15-month pediatric/well-child visit",
    description: "Bring diet, sleep, walking/hand movement, language, emotions, safety, and vaccine record."
  },
  well_visit_18_months: {
    title: "Prepare for and complete the 18-month pediatric/well-child visit",
    description: "Prepare questions about developmental screening, autism screening, language, emotions, diet, sleep, and toilet-readiness."
  },
  screening_18m: {
    title: "Record whether the 18-month developmental and autism screenings were completed",
    description: "Save screening results; if the doctor recommends referral or recheck, turn it into a custom doctor task."
  },
  nutrition_transition_1y: {
    title: "Review diet and milk structure after age 1",
    description: "Record family foods, milk/water/juice, picky eating, meal rhythm, and bring concerns to the well-child visit."
  },
  toilet_readiness_only: {
    title: "Observe toilet readiness only; do not force training",
    description: "Record whether the child can communicate, stay dry briefly, and show interest in the potty; do not create training tasks before readiness."
  },
  tantrum_response_rule: {
    title: "Align family responses to tantrums, biting, and grabbing",
    description: "Write consistent rules in advance: keep safe, use brief language, redirect, and review afterward."
  },
  safety_one_year_old: {
    title: "Complete the age-1 sleep, toy, water, car, home, and outdoor safety check",
    description: "As walking and exploration increase, focus on water sources, medicines, cleaners, small objects, car risks, and outdoor risks."
  },
  well_visit_24_months: {
    title: "Prepare for and complete the 24-month pediatric/well-child visit",
    description: "Bring language, social, movement, diet, sleep, toilet, behavior, and vaccine records."
  },
  autism_screening_24m: {
    title: "Record whether the 24-month autism screening was completed",
    description: "Save screening results; if the doctor recommends further evaluation, turn it into a doctor task."
  },
  language_social_obs_2y: {
    title: "Record language and social observations around age 2",
    description: "Observe simple-instruction understanding, expressing needs, pointing, imitation, and caregiver interaction; ask the doctor if concerned."
  },
  toilet_readiness_2y: {
    title: "Review whether the child is entering the toilet-training window",
    description: "Start only when readiness signals appear; record potty use, stool pattern, resistance level, and family execution cost."
  },
  sleep_discipline_2y: {
    title: "Review age-2 sleep and rule consistency",
    description: "Record night waking, bedtime routine, boundary testing, tantrum triggers, and effective approaches."
  },
  dental_hygiene_2y: {
    title: "Set up age-2 oral-care and dental follow-up notes",
    description: "Record brushing, sugary drinks, night milk, tooth concerns, and dental advice."
  },
  safety_two_year_old: {
    title: "Complete the age-2 fall, burn, poisoning, and car-safety check",
    description: "Focus on climbing, kitchen, medicines/cleaners, windows, car seats, and outdoor risks."
  },
  well_visit_30_months: {
    title: "Prepare for and complete the 30-month pediatric/well-child visit",
    description: "Bring development, language, behavior, toilet, sleep, diet, and family concerns."
  },
  developmental_screening_30m: {
    title: "Record whether the 30-month developmental screening was completed",
    description: "Save screening results and note language, motor, social, and behavior advice."
  },
  toilet_training_if_ready: {
    title: "Toilet training: enable only when ready",
    description: "If readiness signals are present, enable a toilet-training sub-checklist; otherwise keep observing."
  },
  nutrition_picky_eating_review: {
    title: "Review picky eating, snacks, drinks, and meal boundaries",
    description: "Record one week of diet structure, picky-eating triggers, snacks/sugary drinks, and family table rules."
  },
  well_visit_3_years: {
    title: "Prepare for and complete the 3-year annual pediatric/well-child visit",
    description: "Bring language, movement, social, emotional, sleep, diet, toilet, preschool adjustment, and safety questions."
  },
  preschool_readiness_3y: {
    title: "Assess preschool / early-learning adjustment readiness",
    description: "Record separation anxiety, peer interaction, language expression, self-care, schedule, and allergy/health information."
  },
  development_obs_3y: {
    title: "Record 3-year development observations",
    description: "Observe conversation, whether most speech is understandable to others, running/jumping/climbing, drawing/blocks, pretend play, turn-taking, and emotion regulation."
  },
  bedwetting_reference_3y: {
    title: "Night wetting / bedwetting: observe only, no default intervention",
    description: "Bedwetting can vary normally; record frequency and accompanying symptoms, and ask the doctor if concerned."
  },
  discipline_sleep_3y: {
    title: "Review age-3 discipline, sleep, and emotional boundaries",
    description: "Record bedtime delay, nightmares/night terrors, tantrums, and whether family rules are consistent."
  },
  safety_three_year_old: {
    title: "Complete the age-3 fall, burn, car, water, poisoning, and choking safety check",
    description: "Focus on outdoors, kitchen, water sources, car seats, medicines/cleaners, and small objects."
  },
  well_visit_4_years: {
    title: "Prepare for and complete the 4-year annual pediatric/well-child visit",
    description: "Bring preschool performance, language, movement, social, sleep, diet, safety, and vaccine records."
  },
  well_visit_5_years: {
    title: "Prepare for and complete the 5-year annual pediatric/well-child visit",
    description: "Bring school readiness, vision/hearing/teeth/nutrition/movement, social-emotional, and safety questions."
  },
  kindergarten_readiness: {
    title: "Prepare the kindergarten / school-entry readiness checklist",
    description: "Record self-care, rule-following, turn-taking, expressing needs, answering story questions, and health/vaccine-document needs."
  },
  development_obs_4_5y: {
    title: "Record 4-5 year development observations",
    description: "Observe pretend play, storytelling, conversation, fine motor skills, body coordination, peer play, following rules, and turn-taking."
  },
  healthy_lifestyle_review: {
    title: "Review healthy lifestyle at ages 4-5",
    description: "Record diet, movement, sleep, screen use, outdoor activity, and family routines."
  },
  discipline_emotion_4_5y: {
    title: "Review rules, emotions, and social conflicts at ages 4-5",
    description: "Record common conflicts, effective rules, reward/consequence consistency, and whether preschool life is affected."
  },
  safety_travel_4_5y: {
    title: "Complete the age 4-5 safety and travel check",
    description: "Recheck car travel, swimming/water edges, biking/helmets, outdoors, unfamiliar animals, travel medications, and documents."
  },
  well_visit_6_years: {
    title: "Prepare for and complete the 6-year annual physical / school-entry exam",
    description: "Bring height/weight, vision/hearing/teeth, sleep, diet, movement, school adjustment, vaccine record, and parent questions."
  },
  school_entry_documents: {
    title: "Organize school-entry health documents and vaccine records",
    description: "Organize physical forms, vaccine records, allergy/chronic-condition notes, and emergency contacts according to school/community requirements."
  },
  six_year_vaccine_verify_only: {
    title: "Age-6 vaccines: verify the local/doctor plan and record it only",
    description: "Do not auto-generate vaccine content; current China DTaP schedules have changed and must follow the local vaccine clinic or doctor's plan."
  },
  doctor_question_list_before_visit: {
    title: "Generate 3-5 questions before each well-child visit",
    description: "Use recent records to generate the most important 3-5 questions across feeding, sleep, stool/urine, development, safety, and behavior."
  },
  record_growth_after_visit: {
    title: "Record height, weight, head circumference, and doctor advice after each visit",
    description: "Enter measurements, percentile/doctor notes, and next recheck or referral plan."
  },
  no_auto_diagnosis_rule: {
    title: "Health reminders are risk prompts only, not diagnosis or medication advice",
    description: "Checklist may remind the family to record and discuss care thresholds, but must not provide diagnosis, treatment, doses, or substitute for doctor advice."
  }
};

export function localizeChecklistTemplate<T extends ChecklistTemplateLibraryEntry>(template: T, language: Language): T {
  if (language === "zh") return template;
  const text = templateTexts[template.template_code];
  return {
    ...template,
    title: text?.title ?? template.title,
    description: text?.description ?? template.description,
    items: template.items.map((item) => localizeChecklistTemplateItem(item, language))
  };
}

export function localizeChecklistTemplateItem<T extends ChecklistTemplateLibraryItem>(item: T, language: Language): T {
  if (language === "zh") return item;
  const text = itemTexts[item.key] ?? itemTexts[item.template_item_key];
  if (!text) return item;
  return {
    ...item,
    title: text.title,
    description: text.description ?? item.description,
    details_json: {
      ...item.details_json,
      parent_task: text.description ?? item.details_json.parent_task
    }
  };
}

export function localizeChecklistItemRecord<T extends ChecklistItemRecord>(item: T, language: Language): T {
  if (language === "zh" || !item.template_item_key) return item;
  const text = itemTexts[item.template_item_key];
  if (!text) return item;
  return {
    ...item,
    title: text.title,
    description: text.description ?? item.description,
    details_json: {
      ...item.details_json,
      parent_task: text.description ?? item.details_json?.parent_task
    }
  };
}
