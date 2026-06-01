# AGENTS.md

This repository implements the Baby Log Family Log project.

Codex must treat this project as a scope-controlled family care tool, not as an open-ended product. Do not invent features, medical rules, event types, pages, checklist templates, or data models beyond the explicit task.

## Core product identity

This is a family baby-care log for one child and one family.

The product supports:
- fast daily recording
- checklist and milestone tracking
- a simplified read-only family view
- a machine-readable endpoint for ChatGPT / Tasks
- full export

The product is not:
- a medical diagnosis system
- a clinical decision support tool
- a social product
- a multi-tenant SaaS
- a complex account system
- an attachment/photo management system in V1/V1.1

## Non-negotiable architecture rules

- Cloudflare Worker + Static Assets + D1 remains the architecture.
- D1 is the only source of truth.
- Do not use KV as the primary database.
- Do not introduce a daily summary table as source of truth.
- Daily summary must be derived from events.
- Do not implement station-internal attachment uploads unless explicitly requested.
- Machine endpoint must be standalone JSON and must not depend on cookie login.
- All stored timestamps must be UTC.
- `local_date` must be derived server-side from `app_profile.timezone`.

## Product scope constraints

Do not add system-level event types unless explicitly requested.

Allowed primary quick actions:
- breast feeding
- bottle feeding
- pee
- poop
- sleep start / wake up
- temperature
- medicine
- note

Allowed secondary event types:
- symptom
- tummy time
- growth measurement

Do not add extra pages unless explicitly requested.

Do not auto-enable vaccine templates unless explicitly requested by the user.

## Medical and parenting content rules

The system may help the family observe, record, summarize, and prepare questions for clinicians.

The system must not:
- diagnose conditions
- prescribe medication
- decide whether vaccines should or should not be given
- claim a child is developmentally delayed
- replace pediatrician advice

AAP / HealthyChildren / CDC / local doctor guidance can inform templates, but the product must remain conservative.

AAP content should be converted into practical checklist templates only when:
- the action is concrete
- the family can reasonably complete or confirm it
- it is not a diagnosis or treatment instruction
- it does not create unnecessary daily anxiety

The AAP book itself states its information should complement, not substitute for, pediatrician advice, and immunization recommendations can change; therefore, anything clinical must remain advisory and editable.

## Implementation discipline

Before editing:
- inspect the relevant files
- identify existing patterns
- avoid broad rewrites unless the task explicitly requires them

When editing:
- preserve existing behavior unless the task says otherwise
- avoid unnecessary dependencies
- add tests or manual verification notes when behavior changes
- do not swallow errors with broad catch blocks
- do not use default production passwords

When done:
- list files changed
- list tests run
- list any risks or follow-up items

## V1.1 priority

V1.1 is a stabilization release. It must not include V2 feature expansion.

V1.1 fixes:
- full export correctness
- machine endpoint headers and error semantics
- sleep-state UI
- sleep cross-midnight summary
- pee undo feedback
- poop sheet-before-create behavior
- validation errors
- HTML escaping
- production default password fail-closed

## V2 priority

V2 is a product and UX upgrade.

V2 must be planned before implementation. Do not jump directly into coding V2 unless the user explicitly approves the V2 implementation plan.