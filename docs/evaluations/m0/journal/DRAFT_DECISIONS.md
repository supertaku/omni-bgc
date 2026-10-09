# Candidate decision records for parent consideration — 2026-10-09

These are **proposals only**. They are not entries in the append-only shared `docs/DECISION_JOURNAL.md`; parent must verify, edit and explicitly choose whether to append them. They do not accept M0 or authorize M1.

### Proposed DEC-028 — Treat M0 source acceptance as evidence acceptance only

- Date / author / reviewer: 2026-10-09 / journal scribe proposal / parent review pending.
- Status: PROPOSED.
- Context and problem: The source inventory and validator passed bounded checks, while none of the reviewed records or datasets has approval to distribute or establish current BGC facts.
- Options considered: (a) interpret passing inventory validation as data approval; (b) preserve separate report/validator acceptance and dataset/source approval. Option (a) is rejected because it collapses validation and rights/factual review.
- Evidence / references and limits: `docs/evaluations/m0/parent/SOURCE_REVIEW.md` records parent ACCEPT for the bounded report/validator only, zero approved source records, nine UNKNOWN redistribution statuses, and unchanged source register. `docs/evaluations/m0/sources/work-log.md` records 11 candidate/policy records, zero raw datasets fetched, zero imported places/menu/transit/routes, and no raw dataset hashes. Public access and ODbL metadata do not alone prove permission for every asset or use.
- Decision and rationale: Proposed wording: “Acceptance of M0 source inventory/checks validates the bounded research artifact only; it does not approve any dataset or source record for product use or redistribution.”
- How implemented: No shared files edited by this scribe. Parent may record this clarification in shared decision journal and source review if accepted.
- Trade-offs, risks, rejected alternatives: Maintains explicit separation of lineage/licensing review from test success; requires per-source follow-up. Rejected treating a URL, public access, or a raw-data license as blanket approval.
- Validation / outcome: Parent source review independently reran validator (exit 0); counts as reported in the review. This validates checks, not source rights.
- Impacted systems / migration: No schema or product changes. M1 source intake must carry explicit rights/lineage evidence.
- Revisit trigger: A specific source has documented applicable terms, lineage, freshness, coverage and reviewer approval.
- Approved by: Pending parent.

### Proposed DEC-029 — Quarantine prior-project pilot entity manifest with checksum mismatch

- Date / author / reviewer: 2026-10-09 / journal scribe proposal / parent review pending.
- Status: PROPOSED.
- Context and problem: Prior-project pilot entity manifest's declared content hash differs from the recomputed hash under the repository's documented serialization method.
- Options considered: (a) silently recalculate and replace the digest; (b) block reuse until owner explains and validates content/hash lineage. Option (a) is rejected because it could mask edits or entity-ID drift.
- Evidence / references and limits: `docs/evaluations/m0/gis/GIS_REUSE_AUDIT.md` and `gis/audit-results.json` report 31 entities, 2 complexes, zero duplicate ID signals, claimed SHA256 `5e401c1814fc43e2b8bd1dfc39588f063d614ed927fc647e52236ba1cf7af652`, recomputed `30089f6af014bb4943f97efb838075e8080dfa83359cd5a5224ea81c3671640e`. Cause was not investigated; stale checksum/later edits are possibilities, not findings.
- Decision and rationale: Proposed disposition is quarantine from reuse until the prior-project owner provides a reproducible explanation and content/ID review. No repair or ID/schema change is implied.
- How implemented: No prior-project files changed; audit's output guard refused a write. Parent may record this as an explicit reuse constraint.
- Trade-offs, risks, rejected alternatives: Delays reuse; avoids silently blessing unverified identities or provenance. Rejected auto-regeneration.
- Validation / outcome: Recomputed checksum and guard are documented by the GIS audit. Parent to reproduce independently before adopting.
- Impacted systems / migration: No app schema change. Any later authorized ingest must preserve IDs/history and document transformation.
- Revisit trigger: Owner explanation plus repeatable checksum and explicit parent review of entity differences.
- Approved by: Pending parent.

### Proposed DEC-030 — Keep native and production offline-map claims gated on runtime evidence

- Date / author / reviewer: 2026-10-09 / journal scribe proposal / parent review pending.
- Status: PROPOSED; may be redundant with existing DEC-004, DEC-006, DEC-013 and parent M0 acceptance criteria.
- Context and problem: Host checks and static external-URI negative cases pass, while available native build log is incomplete and production offline asset cold-start is not demonstrated.
- Options considered: (a) infer native/offline readiness from typecheck/style checks/config review; (b) hold native, renderer, SQLite and production offline claims until the corresponding runtime evidence exists. Option (a) is rejected as unsupported.
- Evidence / references and limits: `mobile/logs/typecheck-aligned.log`, `style-check.log`, `expo-check-aligned.log` and `expo-doctor-cng.log` show host/config checks; `mobile/logs/assemble-debug.log` ends during Gradle tasks with no completion in the inspected log. `parent/TASK_PLAN.md` explicitly requires Android debug build, native local SQLite query and MapLibre render and states the physical-device invariant. `mobile/PLAN.md` says empty style is not offline geographic map proof. No final native/device output was available to this scribe.
- Decision and rationale: Proposed record should retain existing provisional/open choices until parent verifies actual native build/query/render and required device evidence; DEC-013 remains open until M5 all-local resources are tested under cold airplane-mode launch.
- How implemented: Documentation proposal only. No implementation changes.
- Trade-offs, risks, rejected alternatives: Delays claims until evidence is complete; avoids confusing JS/static validation with native behavior or a local style with offline pack support.
- Validation / outcome: Host checks observed pass; 23 dependency advisories observed; native build/device result and final parent gate remain pending in reviewed artifacts.
- Impacted systems / migration: No API/schema change. Parent should avoid duplicating/replacing existing decisions unless the new entry adds a distinct, useful condition.
- Revisit trigger: Complete build, physical-device run with native SQLite and MapLibre event evidence, and separately M5 production-style cold offline run.
- Approved by: Pending parent.
