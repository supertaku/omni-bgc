# M1–M14 execution contract — 2026-10-09

User authorization: execute M1 through M14 in dependency order; parent may advance after independent acceptance. Existing M0 handoff remains historical. This authorization supersedes its requirement to stop before M1, without granting publication, purchases, legal clearance or destructive operations.

Branch: `codex/m1-m14`, based on clean `795179d`. No merge to main or external publication. Validated milestones receive separate commits; blocked drafts are identified explicitly.

## Initial tasks and success criteria

1. M1 contracts owner: `m1_contracts`, Sol Medium (Terra unavailable). Own domain/database/geo packages and contract tests. Require normalized staging/mobile schemas, immutable identities, provenance/permission gates, explicit unknown states and independent adversarial review.
2. M1 governance owner: `m1_governance`, Sol Medium. Own source register/policy, migration, engineering service boundary and license evidence. Require preservation of legacy fields, versioned migration, fail-closed rights and no approval by inference.
3. Independent M2 design owner: `m2_design`, Sol High. Own UI tokens/brand assets/design evidence. Require reviewable accessible flows; Figma and actual participant gates remain mandatory and may block acceptance.
4. Parent: inspect all changes, rerun deterministic tests, add independent counterexamples, review visual evidence, update append-only decisions/tool rationale and current risk/status registers. Parent alone commits accepted milestones.

Only three implementation agents initially. Shared journals, milestone handoffs and integration branch metadata are parent-owned. No agent may silently change another owner's schema. Reviewers do not modify implementation during review.

## Model availability

Harness lists `gpt-6.1-sol`, `gpt-6-astra`, `gpt-6-sol`, `gpt-6-luna`, `gpt-5.6-sol`; the documented Terra and 5.6-Luna are unavailable. Explicit Sol Medium fallback for ETL/database is recorded, rather than claiming Terra use. Actual spawn success verifies selected agent models. Parent model/effort cannot be introspected or changed through this harness; no claim of a runtime override. Astra Low is reserved for an independent architecture/native review if needed.

## Risks and gating

- M0 had zero approved/acquired raw datasets and unresolved merchant/menu/transit redistribution. Public access does not clear rights; no distribution.
- Prior entity checksum mismatch and source-code rights remain quarantined. Processed path buffers are not graph topology. Build new pipelines against approved raw data only.
- Project-defined pilot scope is an engineering rectangle, never an official BGC boundary or coverage claim.
- Physical Android must be checked at native integration gates; historical screenshots do not validate new code. macOS/iOS, real field checks, Figma and real participants may require external access.
- Security advisories and the hidden Expo SQLite finalization workaround require explicit disposition and lifecycle regressions before production acceptance.
- If an acceptance requirement fails, mark milestone BLOCKED; start only work genuinely independent of its deliverable. Never substitute fixtures for approved places, maps, field routes or successful device evidence.
- Preserve pre-AI scope and optional location; no precise-position uploads.

## Evidence discipline

Each owner supplies task plan, changed paths, manifest/checksums, source permissions/counts where relevant, exact commands/tool versions, actual results, journal/ADR proposals and unresolved risks. Parent handoff records ACCEPT / CHANGES_REQUESTED / REJECT separately from dataset or production approval. Missing real usability, field, offline or native verification is NOT_RUN / BLOCKED, never PASS.
