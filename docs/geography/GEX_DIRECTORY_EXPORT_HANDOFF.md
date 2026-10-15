# GEX-3 scope-aware approved directory projection

2026-10-15, Asia/Manila. Ready for parent review of the content-only projection adapter. The accepted engineering scope remains separate from record and distribution approval. This task creates no approved real business/building/organization records and grants no rights.

Owned implementation: `packages/database/export_geographic.py`, `tests/data-quality/gex/test_geographic_export.py`, this handoff. Generated immutable internal candidates live in ignored `data/generated/m4/comprehensive/geography/gex-directory-*`. Existing `export_mobile.py`, schema migrations, staging/canonical IDs, office/food research and permissions were not changed. No installed database, saved place, itinerary or other local user state is edited.

The adapter calls the unchanged M1 `export_mobile(staging, now)` first. All existing current fact, entity review, source evidence, exact snapshot policy, source rights, conflicts and parent relationship gates remain mandatory. It then filters the resulting fresh memory database against the exact reviewed service/search Polygon or MultiPolygon. Accepted scope status, CRS/axis order, closed valid rings, exact scope geometry, exact parent-review bytes, parent ACCEPT and engineering-only rights flags are checked. The buffer, context ring and bounding box never admit directory destinations.

Buildings, places, public facilities, entrances and transit stops require their own current approved source point inside the service polygon; the exact boundary is inclusive. Unknown points and outside points are suppressed. An original source identity listed in the manifest's explicit exclusions is suppressed even when a conflicting point happens to lie inside. Dependent entity chains, facts, points/RTree, FTS documents, lineage and orphan source snapshots are removed from the new projection in FK-safe order. Nonspatial businesses are retained only as independently eligible original organizations linked to retained branches. Global transit metadata with no scoped descendant is suppressed. No point is borrowed from a parent centroid or entrance.

An approved office branch additionally requires its existing reviewed, retained building parent. The organization UUID remains the original independently eligible business identity; no organization schema migration or inferred company/building link is introduced. A missing or ungrounded building removes the branch and its dependent data. Existing floors/branches and identity separation remain intact.

Category and floor FTS documents reference original accepted fact IDs with exported lineage. Category eligibility uses the base exporter's approved taxonomy binding. Floor text additionally must match the existing place-to-floor-to-building binding, the exported reviewed building parent and an approved floor identity. An asserted floor claim with a missing, contradictory, unreviewed or malformed binding is suppressed rather than presented/indexed. No candidate field is promoted into the search index.

`pack_metadata` adds `service_area_id`, `service_area_sha256` (SHA256 of exact service manifest bytes), `scope_geometry_sha256`, `parent_scope_review_sha256`, `geographic_export_contract=gex-content-scope-v1`, and `user_state_included=false`. These scope keys cannot be updated, deleted, replaced or upserted in the new content database. Insert and old/new update-key guards prevent SQLite `OR REPLACE` bypasses even with recursive triggers disabled. Additive metadata guards apply only to this projection, without changing migration files; schema version remains 1. The base `distribution_status=LOCAL_CANDIDATE_REQUIRES_PARENT_ACCEPT` remains intact. File outputs use a new immutable revision directory and never overwrite an existing revision.

## Actual artifact and honest data status

`data/generated/m4/comprehensive/geography/gex-directory-r2/main.sqlite` is a 110,592-byte, scope-bound empty content proposal. It contains zero entities, facts, source snapshots and destinations. Input status is explicitly `NO_REVIEWED_STAGING_INPUT`: no legitimate reviewed staging input was supplied to this task. This is not an assertion that BGC has no businesses, and no synthetic test data or fabricated rights entered the artifact. Earlier r1 is preserved and superseded after self-review strengthened metadata guards against `OR REPLACE`; only r2 is the final artifact.

SQLite SHA256: `0f72ceb90f91fc8c2c6600f0e8d0bf3139817df6f40790eac017ea468930f479`. Export manifest SHA256: `18168a8cc90df8eb34f658c8c68f739cb0582c7b10dfadf95cd99c411c40ad84`. Service manifest SHA256: `f6cbcc7b33ad4a53821858dc4c3c56e13f30997aad082fcb9fb189eddc5f9db9`. Scope ID: `omni-bgc:service-area:bgc-commercial-v2`. Scope geometry SHA256: `06b06e54c70905f6f665d14214de421cf6fabb97da7834808842bd0beb82e4ba`. Exact parent review SHA256: `12ddafa702a9030eb6a049f5b324d6ff0f0838e3c4db76f28eb5dc6e7adf7fc5`.

Both `main.sqlite` and `export-manifest.json` are byte-identical to a separate `gex-directory-r2-rebuild` run at the same explicit time. Migration application time is deterministic. Generated metadata/export manifest mark publication/navigation unauthorized and omit user state. Original snapshots and full fact/evidence lineage are retained when eligible content exists; the empty artifact has no invented snapshots.

## Validation and reproduction

21 synthetic scope/export integration tests PASS. They exercise exact IDs/lineage, holes despite bbox inclusion, inclusive polygon boundary, offscope/unknown points, original source exclusions, building/facility/entrance destinations, dependent menu/food chains, unchanged saved places and byte-identical caller staging, mandatory base rights/staleness, conflicting coordinates, incomplete building links, accepted category and floor FTS, invalid/unreviewed floor suppression, office organization/building links, immutable scope metadata, scope hash/rights tamper rejection, immutable paths and exact SQLite regeneration. All 25 unchanged M1 contract regressions PASS.

Actual candidate SQLite `PRAGMA integrity_check=ok`; foreign-key checks report zero errors; empty FTS/RTree are consistent. Tests with populated synthetic projections execute FTS integrity checks and preserve original fact and organization IDs. Existing runtime reused without installation/upgrades: Python 3.13.7 with SQLite/FTS5 and Shapely 2.2.0 from `pipelines/map-pack/.venv`.

From repository root:

```powershell
& pipelines/map-pack/.venv/Scripts/python.exe -m unittest discover -s tests/data-quality/gex -p test_geographic_export.py -v
& pipelines/map-pack/.venv/Scripts/python.exe -m unittest discover -s tests/data-quality/m1 -v
& pipelines/map-pack/.venv/Scripts/python.exe packages/database/export_geographic.py --empty --output data/generated/m4/comprehensive/geography/gex-directory-NEW_REVISION --now 2026-10-14T16:00:00Z
```

`--db` instead of `--empty` opens an explicitly supplied staging database read-only, reuses the same unchanged fact/rights gates and returns another internal proposal. It does not publish or approve data. A reviewed distribution workflow must still independently bind retained intake/evidence bytes and grant the concrete release permission before any public content delivery.

Task success criteria were a fresh scope-bound projection, conservative suppression, unchanged IDs/lineage and user state, evidence-gated FTS, deterministic bytes and no false real records. These host criteria pass. Remaining product gates: independently approved/current-world directory inputs, parent artifact acceptance, integration review, physical Android offline/runtime evidence and public release rights. No USB debugging, app/device interaction, AI runtime interaction, commit, push or merge occurred.
