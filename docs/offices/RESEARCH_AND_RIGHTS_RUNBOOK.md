# Local research and refresh runbook

2026-10-15: the complete current workflow, including manual review, geography,
canonical intake/promotion/export, packs, correction/revocation and mobile use,
is in [OPERATIONS.md](OPERATIONS.md). The foundation commands below remain valid;
their earlier implementation-only limitations are historical.

Run from the repository root with Python 3.13 and Node 22. No new dependency,
network, account, inference model or phone is needed for this foundation.

```powershell
python pipelines/etl/offices/import_directory.py --csv 'C:\Users\joshu\Downloads\BGC_Company_Offices_Directory_EXPANDED_2026-10-14 (1).csv' --xlsx 'C:\Users\joshu\Downloads\BGC_Company_Offices_Directory_EXPANDED_2026-10-14 (1).xlsx'
```

Use the returned output path as `$officeSnapshotPath`. All output paths stay
below ignored `data/generated/offices/`; do not override .gitignore or stage raw
workbooks, candidates, retained third-party evidence or permission documents.

```powershell
python pipelines/etl/offices/verify_snapshot.py --snapshot $officeSnapshotPath --seed-v2
python pipelines/etl/review-dashboard/dashboard.py --offices "$officeSnapshotPath/import-report.json" --output data/generated/offices/review
```

The same dashboard can combine accepted staging data with the office report via
`--db <staging.sqlite> --offices <report>`. It opens staging with `mode=ro` and
`query_only`; it never writes identities, rights or facts. Office summaries,
districts, building groups, sources, rejects and duplicate/alias suggestions are
separate sections. Search/filters run locally. With JavaScript disabled the full
table and research disclosures remain readable. Visual/browser acceptance is
pending in this session; current tests cover HTML escaping and script behavior.

For a later supplied CSV, create a new immutable snapshot and compare reports:

```powershell
python pipelines/etl/offices/refresh_diff.py --previous "$previousOfficeSnapshot/import-report.json" --current "$currentOfficeSnapshot/import-report.json" --output data/generated/offices/refresh/review-v2-v3.json
```

Diffs compare raw-row multiset fingerprints; reorder preserves unchanged value
counts without asserting stable row identity. Added/removed values and possible
same-name changes require human review. A missing row does not prove closure; a
changed building does not prove a move. Do not edit old artifacts. Roll back a
research view by regenerating it from the previous checksum-verified snapshot;
no mobile saved state or public pack is involved. This is research rollback,
not accepted production pack rollback.

Research review roles and next actions:

1. Research/Data Steward: inspect all rejects, company/site duplicates, legal
   affiliates, uncertain presence and unknown floor labels. Resolve identities
   with immutable mapping/audit, never force a same-name merge. Scope all discovery
   by approved zones and a independently sourced building/industry inventory.
2. Rights Reviewer: check exact source terms, permitted access/retention, transform
   and offline reuse. Record named reviewer, policy proof, reviewed UTC, exact
   snapshot/hash, attribution, validity, expiry and revocation. Public URL or a
   High evidence label grants none of these uses. Do not fetch a page until its
   intended access/retention policy permits it. Use existing permitted-local-
   export `pipelines/etl/research/capture.py`, with its bound permission contract.
3. Fact Reviewer: retain per-property evidence locators and substantiated observed/
   publication/verification dates. Company, presence, building and floor are
   distinct claims. The two Accenture Ireland URLs require replacement/support;
   generic contacts, job/association listings and stale reports need current
   occupancy corroboration. Claims and conflicts do not disappear on queue close.
4. GIS Reviewer/map agent: provide approved area/property geometry with lineage,
   precision and available offline coverage. Keep display centroids separate
   from separately observed public entrances. No bulk hosted geocoder or tile
   cache, no synthetic polygon, pin or walking route.
5. Parent Reviewer: review the additive staging/read projection proposal against
   existing M1/M4 rights/binding/export gates and validate with independent
   evidence before ACCEPT. Provisional Postgres migrations are not proof of
   accepted runtime support. The implemented additive SQLite office adapter now
   reuses M1/M4 gates; it does not imply actual record/release acceptance.
6. Mobile/QA: only after cleared facts/projection, preserve UX V2.1 behind an
   opt-in gate. Measure offline search, coverage notices, shared-building list,
   details/citations, favorites, pack lifecycle and accessibility. Request USB
   debugging permission before device inventory or any ADB action, and schedule
   around the user's other AI agent. Publication needs separate user authority.

Proposed quarterly address and monthly conflict refresh are human review queues,
not an automation or crawler created here. Assign accountable owners before
operation. Keep source expiry, closure/move history and revoked rights visible;
rebuild/export only through accepted exact-snapshot gates.
