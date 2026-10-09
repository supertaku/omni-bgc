# M4 place intake — parent review proposal

Tooling status: PENDING_PARENT_REVIEW. Full M4: BLOCKED. Real approved inventory, source-supported restaurant/menu records and field-verified entrances: **0**. Synthetic fixtures establish engineering behavior only. No acquired merchant data, consent, source-register rows, geographic reuse or publication is claimed.

## Interface and identity

`pipelines/etl/place-intake/intake.py` is a Python standard-library CLI/API adapter to accepted M1 staging schema version 1. It creates no new SQL schema and has no network operations. `init`, `ingest`, `resolve`, `promote`, `coverage`, `qa` are separate commands. Always supply an explicit full UTC `--now`. Database artifacts belong under ignored `data/generated/m4/`; never import fixtures into a production pack.

An intake JSON has format_version, exact M1 source fields, snapshot metadata, retained raw bytes, per-use policies, evidence, entities, facts and optional place_category/place_entrance/menu_tag rows. The complete runnable contract example is `data/fixtures/m4/synthetic-intake-v1.json`, explicitly synthetic. Coordinates are M1 objects `{longitude,latitude,crs:"EPSG:4326"}`; future GeoJSON serialization uses `[longitude,latitude]`. Entities must be ordered parent before child. Keys are provider-issued persistent identifiers, never derived from names or coordinates. All keys in a provider namespace must be unique; fact/evidence keys include revision identity. An exact bundle replays existing UUIDs without writes. A new extract version can attach new fact/evidence versions to the same branch UUID. Snapshot, fact and evidence replacement/recycling is rejected. Explicit move/split changes require a separately reviewed plan; this CLI intentionally refuses changes to existing branch/building/floor associations or relation pointers.

Random UUIDv4 allocation is persisted transactionally in M1 external_reference. Entity kind is immutable. Names and aliases receive NFC/whitespace normalization; matching uses NFKC/casefold without stripping accents. Alias facts and place_alias entities are separate; same-name mall branches/floors remain distinct entities. Equal normalized names create symmetric review queues, with no automatic merge. Conflicting current properties, stale facts and closure/move observations create queues. Resolving a queue records reviewer/reason/date in append-only audit; it does not overwrite or choose a fact. Conflicting approved facts remain conservatively excluded by M1 exporter until a reviewed factual resolution exists.

## Evidence and approval

Intake refuses unresolved source redistribution rights, UNKNOWN essential metadata, unapproved sources, absent data-use policy, unknown/blocked offline retention, absent human rights review, mismatched raw hash and unbound/future evidence. Every raw, permission and fact-evidence file is retained inside the bundle directory and checked against actual SHA256. Policies bind the current snapshot/hash and intended use. Menu/cuisine/price/ingredient/allergen claims require menu_text permission; absent ingredients/allergens remain explicit unknown with null values. No dish-name inference exists. Entrance coordinate evidence requires field_survey, never a polygon centroid. WGS84 range and M1 point-value/subtype/floor-parent constraints remain active. **Service-polygon QA, entrance proximity/accuracy and safe routability remain independent M3/field gates; range validation cannot verify them.**

All SQL rows enter candidate/unknown state even when input authority/rights metadata are positive. The complete immutable intake, source/fact metadata and UUID mapping are stored in append-only audit_event. Snapshot/evidence/fact byte identities survive review. Ingest is atomic: a missing relation, subtype, floor mismatch or identity conflict rolls back all provider/mapping/entities/facts/audit writes. No name-derived UUID or temporary out-of-transaction mapping file is used.

Separate promotion rechecks exact intake hash, retained files, current dates, authoritative fact evidence, no unresolved queues, rights obligations, human rights review, parent engineering review, explicit user distribution authorization and reviewer/reason. Unknown facts remain candidate. Synthetic promotion is permitted only inside isolated in-memory test databases. Promotion approves identities/facts but is **not a publishing command or milestone acceptance**. Location-quality verification is applied only to explicit coordinate subjects. M1 mobile exporter independently checks all release gates, taxonomy approval, relation facts and parent chain; a promotion result does not claim mobile export success. Additional cuisine/allergen properties are retained in staging; accepted M1 exporter only supports its enumerated properties, so later mobile exposure needs an explicitly reviewed contract extension or source-supported tag encoding.

Source acquisition fields in each intake must exactly mirror its snapshot. The source table retains its initial acquisition summary while subsequent versions are recorded in immutable source_snapshot and complete intake audit; it is never silently updated. Stable provider/rights metadata revisions require a separately reviewed register update if metadata differs; the tool does not silently update source rights. Current relation/point revisions are refused, preserving lineage; operator must submit a parent-reviewed move/correction plan. M13 remains owner of complete pack update/rollback and admin workflows.

## Collection and independent QA

`collection-forms.json` provides blank merchant rights, menu, field survey and operator census forms; `docs/evaluations/m4/intake/EXTERNAL_EVIDENCE_CHECKLIST.md` defines required retained records. These forms are requests for evidence, not facts or grants. No merchant contact is authorized or performed.

`qa` reports per-source license/status/snapshot hash/extract version, provider mapping counts, review queue, and deterministic property sample. Mapping counts include all entity kinds and are not POI counts. No duplicate is automatically rejected or merged; `rejected_duplicates=0` describes this behavior, with potential duplicates listed for review. Coverage reports identity status/category counts; current verified-world counts need fact-level audit. Denominator and percentage remain null. The automated sample is tooling QA; field reviewers must stratify by category/zone and include branch, floor, closed/stale, boundary/outside and accessibility adversaries. No inventory completeness claim is made.

## Commands

From repository root:

```powershell
python -m unittest discover -s tests/data-quality/m4 -v
python -m unittest discover -s tests/data-quality/m1 -v
python docs/evaluations/m4/intake/build_evidence.py
python pipelines/etl/place-intake/intake.py init --db data/generated/m4/candidates.sqlite --now 2026-10-09T12:00:00Z
python pipelines/etl/place-intake/intake.py ingest --db data/generated/m4/candidates.sqlite --bundle <retained-approved-source-directory>/intake-v1.json --now <UTC>
python pipelines/etl/place-intake/intake.py qa --db data/generated/m4/candidates.sqlite --now <UTC>
```

Create the ignored database parent directory first. Concrete real intake/promotion commands require retained approved evidence; placeholders above are not executable evidence or grants. No GIS data is used until its source gate passes parent review.
