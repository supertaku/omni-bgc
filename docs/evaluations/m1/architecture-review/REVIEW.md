# M1 independent architectural review

Advice: **ACCEPT the bounded M1 engineering contract.** No blocking review findings remain in the exact files hashed in `verification.json`. Scope is the M1 engineering contract, not external data/legal approval or production mobile acceptance. Parent alone accepts integration.

## Findings and disposition

The initial candidate needed changes despite its passing owner tests. `initial-probe-results.json` preserves actual counterexamples; `initial-independent-tests.log` records a later intermediate run after some concurrent fixes. These are historical evidence, not claims about the final candidate.

1. **P1 — identity replacement/recycling.** `INSERT OR REPLACE` changed a place entity to building with a clean foreign-key check, and deleting/reinserting a fact changed its property under the same UUID. Update-only guards were insufficient. Added insert/delete guards now reject those paths even under default recursive-trigger settings. Keep identity tombstones and explicit reviewed migrations; do not use ordinary UPSERT for canonical identities.
2. **P1 — rights gate disagreement and missing metadata.** SQL exported records whose owner was UNASSIGNED, license was spaced UNKNOWN, source was categorically public OSMF raster, or review date lacked UTC time. Governance also accepted whitespace/lowercase unknown metadata. Later probes included unknown policy evidence and spaced raster kind. Normalization and explicit UTC checks were added by owners/parent. The independent matrix checks both gates against 35 required-metadata variants, plus policy-reference/source-ID and raster variants.
3. **P1 — dangling relationship export.** A place with NULL normalized building_id exported an asserted building fact pointing to a nonexistent UUID. Relationship facts now must agree with normalized association and eligible target; the independent regression requires the dangling fact absent.

## Architectural assessment

The split between normalized staging and compact mobile identity/fact/point/citation/FTS schemas is appropriate for this bounded milestone. The mobile exporter is explicitly a local candidate tool. It does not implement later polygon packs, route graph runtime, transit scheduling, user-history APIs or native pack installation. Those are later migrations, not M1 acceptance prerequisites.

Exact snapshot UUID, source/hash and intended use constrain SQL rights. Data permission does not clear menus: the independent menu case lacks menu_text policy and is excluded. A second snapshot with identical bytes has no inherited SQL policy and is excluded. Expired rights, pending evidence, conflicting names and a coordinate fact attached to the wrong subject are separately rejected. Same-name branches retain two distinct UUIDs and export as two entities. Source and extract versions remain distinct. Taxonomy is versioned and proposed rather than silently treated as released; release workflows must explicitly approve it. Generic fact properties still need property-specific validation and reviewed content workflows as M3/M4 add real inputs.

The service rectangle is openly project-defined, with inclusive membership and a metric ingest buffer explicitly unmaterialized. Manifest scope references are distinct from domain UUIDs; the documented reviewed reference-to-UUID mapping is required before M3 database import. No engineering coverage boundary establishes route safety, authoritative district limits or data completeness.

The native ownership plan correctly preserves M0's bounded conclusion: an owner serializes work/close, drains operations, finalizes application statements, then awaits close. The hidden Expo option is a pinned workaround requiring re-audit, not broad platform approval. This reviewer did no device/build operations. Desktop SQLite tests cannot establish Android/iOS lifecycle stability, signed release readiness or production offline assets; the documented M5/M7 follow-ups remain necessary.

Source governance keeps internal raw OSM intake separate from redistribution. Historical raw allowlists require fresh byte/sidecar/query checks; zero canonical source rows do not become approved data through successful tests. No legal classification, merchant consent, image rights, source acquisition, dataset publishing or safe geographic route is approved here.

## Evidence and reproduction

Run from repository root:

- `python -B -m unittest discover -s docs/evaluations/m1/architecture-review -p "test_*.py" -v`
- `python -B -m unittest discover -s tests/data-quality/m1 -p "test_*.py" -v`
- `python -B -m unittest discover -s pipelines/sources -p "test_governance.py" -v`
- `python -B docs/evaluations/m1/architecture-review/probe_contracts.py`

The independent fixture constructs its own synthetic SQL/source/evidence rows; it does not import owner tests. It imports the production exporter and governance gate under review. Positive controls prevent a blanket deny implementation passing as correct. No real records are fabricated or acquired.

Final verification: **15 independent tests, 25 contract regression tests and 14 governance tests passed (54 total)** on Python3.13.7 / SQLite3.50.4. The original independent probe now denies all invalid-positive cases and rejects both identity bypasses. Implementation hashes stayed stable across these checks. `verify_review.py` records commands, exit codes and exact reviewed hashes in `verification.json`. The contracts manifest (21 records) and parent governance revision manifest (19 records) both match current bytes; see `owner-manifest-check.json`. Evidence manifest covers review artifacts separately. Re-review if reviewed implementation bytes change. Changed paths for this reviewer are limited to `docs/evaluations/m1/architecture-review/**`; no implementation or shared journal files modified.
